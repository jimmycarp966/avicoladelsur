/**
 * GraphHopper Directions API Integration
 * 
 * Maneja la integración con GraphHopper Directions API para optimización de rutas.
 * Incluye manejo de rate limits, errores y conversión de respuestas a formato Google.
 * 
 * Ventajas sobre Google Maps:
 * - Mejor manejo de sentidos únicos (datos de OpenStreetMap)
 * - Correcciones más rápides (reportadas en OSM)
 * - Route Optimization API especializado en VRP
 * - Self-hosteable si se necesita control total
 */

export interface GraphHopperRequest {
  origin: { lat: number; lng: number }
  destination: { lat: number; lng: number }
  waypoints?: Array<{ lat: number; lng: number }>
  vehicle?: 'car' | 'truck' | 'small_truck' | 'hgv'
  optimize?: boolean
  alternatives?: boolean
  maxAlternatives?: number
}

/**
 * Ruta alternativa devuelta por GraphHopper
 */
export interface RutaAlternativa {
  polyline: string
  distancia: number     // metros
  duracion: number      // segundos
  resumen: string       // "via Ruta 9" o "via Av. Libertad"
  esPreferida?: boolean // Pre-seleccionada según preferencias del usuario
}

export interface GoogleDirectionsResponse {
  success: boolean
  orderedStops?: Array<{ lat: number; lng: number; waypointIndex?: number }>
  polyline?: string
  distance?: number // en metros
  duration?: number // en segundos
  rutasAlternativas?: RutaAlternativa[]
  error?: string
}

const GRAPHHOPPER_API_KEY = process.env.GRAPHHOPPER_API_KEY
const GRAPHHOPPER_API_URL = 'https://graphhopper.com/api/1/route'

/**
 * Verifica si GraphHopper está disponible
 */
export function isGraphHopperAvailable(): boolean {
  return !!GRAPHHOPPER_API_KEY
}

/**
 * Construye la URL para la API de GraphHopper
 */
function buildGraphHopperUrl(request: GraphHopperRequest): string {
  const params = new URLSearchParams()

  // API Key
  if (GRAPHHOPPER_API_KEY) {
    params.append('key', GRAPHHOPPER_API_KEY)
  }

  // Vehicle profile
  params.append('vehicle', request.vehicle || 'car')

  // Configuración de puntos
  params.append('calc_points', 'true')
  params.append('points_encoded', 'true')
  params.append('elevation', 'false')
  
  // Configuración de idioma y unidades
  params.append('locale', 'es')
  params.append('instructions', 'true')

  // Alternativas
  const maxAlt = request.maxAlternatives || (request.alternatives ? 3 : 0)
  if (maxAlt > 0) {
    params.append('alternative_routes.max_paths', String(maxAlt))
    params.append('alternative_routes.max_weight_factor', '1.4')
    params.append('alternative_routes.max_share_factor', '0.6')
  }

  // Optimización (solo funciona con waypoints)
  if (request.optimize && request.waypoints && request.waypoints.length > 2) {
    params.append('optimize', 'true')
  }

  // Construir URL con puntos
  const points = [
    `${request.origin.lng},${request.origin.lat}`,
    ...(request.waypoints || []).map(wp => `${wp.lng},${wp.lat}`),
    `${request.destination.lng},${request.destination.lat}`
  ].join(';')

  return `${GRAPHHOPPER_API_URL}/${points}?${params.toString()}`
}

/**
 * Decodifica polyline codificado de Google/GraphHopper
 * Formato: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let shift = 0
    let result = 0
    let byte

    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)

    lat += (result & 1) ? ~(result >> 1) : (result >> 1)

    shift = 0
    result = 0

    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)

    lng += (result & 1) ? ~(result >> 1) : (result >> 1)

    points.push({ lat: lat / 1e5, lng: lng / 1e5 })
  }

  return points
}

/**
 * Convierte la respuesta de GraphHopper a nuestro formato Google-compatible
 */
function parseGraphHopperResponse(data: any, request: GraphHopperRequest): GoogleDirectionsResponse {
  if (!data.paths || data.paths.length === 0) {
    return {
      success: false,
      error: 'No routes found from GraphHopper'
    }
  }

  const primaryPath = data.paths[0]

  // Extraer polyline
  const polyline = primaryPath.points || ''

  // Calcular distancia total (en metros)
  const distance = primaryPath.distance || 0

  // Calcular duración total (en segundos)
  const duration = primaryPath.time || 0

  console.log('[GraphHopper] Parseando respuesta:', {
    pathsCount: data.paths.length,
    distanceM: distance,
    durationS: duration,
    polylineLength: polyline.length
  })

  // Extraer orden optimizado de waypoints
  const orderedStops: Array<{ lat: number; lng: number; waypointIndex?: number }> = []

  if (request.waypoints && request.waypoints.length > 0) {
    // GraphHopper devuelve los puntos en orden optimizado si optimize=true
    // Necesitamos mapear los puntos intermedios a los waypoints originales
    const decodedPoints = decodePolyline(polyline)
    
    // Los puntos intermedios (excluyendo origen y destino)
    const intermediatePoints = decodedPoints.slice(1, -1)
    
    // Asignar waypoints en orden (si hay optimización, GraphHopper ya los ordenó)
    intermediatePoints.forEach((point, index) => {
      if (index < request.waypoints!.length) {
        orderedStops.push({
          lat: point.lat,
          lng: point.lng,
          waypointIndex: index
        })
      }
    })
  }

  console.log('[GraphHopper] Orden final de paradas:', orderedStops.length, 'puntos')

  // Extraer rutas alternativas
  const rutasAlternativas: RutaAlternativa[] = data.paths.map((path: any, index: number) => {
    const dist = path.distance || 0
    const dur = path.time || 0

    // Obtener resumen (nombre de la ruta principal)
    const resumen = path.instructions?.[0]?.street_name || `Ruta ${index + 1}`

    return {
      polyline: path.points || '',
      distancia: dist,
      duracion: dur,
      resumen,
      esPreferida: index === 0
    }
  })

  console.log('[GraphHopper] Rutas alternativas encontradas:', rutasAlternativas.length)

  return {
    success: true,
    orderedStops,
    polyline,
    distance,
    duration,
    rutasAlternativas: rutasAlternativas.length > 1 ? rutasAlternativas : undefined
  }
}

/**
 * Obtiene ruta optimizada desde GraphHopper API
 */
export async function getGraphHopperDirections(
  request: GraphHopperRequest
): Promise<GoogleDirectionsResponse> {
  // Verificar que la API key esté configurada
  if (!GRAPHHOPPER_API_KEY) {
    return {
      success: false,
      error: 'GRAPHHOPPER_API_KEY no está configurada. Usa fallback a Google o local.'
    }
  }

  // Validar límites de waypoints
  if (request.waypoints && request.waypoints.length > 25) {
    return {
      success: false,
      error: 'Máximo 25 waypoints permitidos por request de GraphHopper. Divide la ruta en sub-rutas.'
    }
  }

  try {
    const url = buildGraphHopperUrl(request)
    console.log('[GraphHopper] Consultando API...')
    console.log('[GraphHopper] Origin:', request.origin)
    console.log('[GraphHopper] Destination:', request.destination)
    console.log('[GraphHopper] Waypoints:', request.waypoints?.length || 0)
    console.log('[GraphHopper] Vehicle:', request.vehicle || 'car')
    console.log('[GraphHopper] Alternatives:', request.alternatives || false)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      console.error('[GraphHopper] HTTP Error:', response.status, response.statusText)
      return {
        success: false,
        error: `HTTP error: ${response.status} ${response.statusText}`
      }
    }

    const data = await response.json()
    console.log('[GraphHopper] Respuesta paths:', data.paths?.length || 0)

    // Manejar errores específicos de GraphHopper
    if (data.message) {
      console.error('[GraphHopper] API Error:', data.message)
      return {
        success: false,
        error: `GraphHopper API error: ${data.message}`
      }
    }

    return parseGraphHopperResponse(data, request)
  } catch (error: any) {
    console.error('Error al consultar GraphHopper API:', error)
    return {
      success: false,
      error: error.message || 'Error desconocido al consultar GraphHopper API'
    }
  }
}

/**
 * Obtiene ruta con fallback automático: GraphHopper → Google → Local
 */
export async function getDirectionsWithFallback(
  request: GraphHopperRequest
): Promise<{ response: GoogleDirectionsResponse; provider: 'graphhopper' | 'google' | 'local' }> {
  // Intentar GraphHopper primero
  if (isGraphHopperAvailable()) {
    const ghResponse = await getGraphHopperDirections(request)
    if (ghResponse.success) {
      console.log('[Routing] ✅ Usando GraphHopper')
      return { response: ghResponse, provider: 'graphhopper' }
    }
    console.warn('[Routing] GraphHopper falló, intentando Google...')
  }

  // Fallback a Google Directions
  try {
    const { getGoogleDirections } = await import('./google-directions')
    const googleRequest = {
      origin: request.origin,
      destination: request.destination,
      waypoints: request.waypoints || [],
      optimize: request.optimize,
      alternatives: request.alternatives
    }
    const googleResponse = await getGoogleDirections(googleRequest)
    if (googleResponse.success) {
      console.log('[Routing] ✅ Usando Google Directions (fallback)')
      return { response: googleResponse, provider: 'google' }
    }
  } catch (error) {
    console.warn('[Routing] Google Directions falló:', error)
  }

  // Fallback a local optimizer
  console.warn('[Routing] Usando local optimizer (último fallback)')
  try {
    const { optimizeRouteLocal, haversineDistance } = await import('./local-optimizer')
    
    const origin = { lat: request.origin.lat, lng: request.origin.lng, id: 'origin' }
    const destination = { lat: request.destination.lat, lng: request.destination.lng, id: 'destination' }
    const waypoints = (request.waypoints || []).map((wp, i) => ({
      lat: wp.lat,
      lng: wp.lng,
      id: `wp_${i}`
    }))

    const optimized = optimizeRouteLocal(origin, waypoints, destination)
    
    const polyline = optimized.orderedPoints
      .map(p => `${p.lat},${p.lng}`)
      .join(';')

    return {
      response: {
        success: true,
        orderedStops: optimized.orderedPoints.map((p, i) => ({
          lat: p.lat,
          lng: p.lng,
          waypointIndex: i > 0 && i < optimized.orderedPoints.length - 1 ? i - 1 : undefined
        })),
        polyline,
        distance: optimized.totalDistance * 1000, // km → m
        duration: optimized.estimatedDuration * 60 // min → s
      },
      provider: 'local'
    }
  } catch (error) {
    console.error('[Routing] Local optimizer falló:', error)
    return {
      response: {
        success: false,
        error: 'Todos los proveedores de routing fallaron'
      },
      provider: 'local'
    }
  }
}
