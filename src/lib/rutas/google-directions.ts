/**
 * Google Directions API Integration
 * 
 * Maneja la integración con Google Directions API para optimización de rutas.
 * Incluye manejo de rate limits, errores y conversión de respuestas.
 */

export interface GoogleDirectionsRequest {
  origin: { lat: number; lng: number }
  destination: { lat: number; lng: number }
  waypoints: Array<{ lat: number; lng: number }>
  optimize?: boolean
  alternatives?: boolean  // Obtener rutas alternativas (solo sin waypoints)
}

/**
 * Ruta alternativa devuelta por Google Directions
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
  rutasAlternativas?: RutaAlternativa[]  // Alternativas cuando alternatives=true
  error?: string
}

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY
const GOOGLE_DIRECTIONS_API_URL = 'https://maps.googleapis.com/maps/api/directions/json'

/**
 * Construye la URL para la API de Google Directions
 */
function buildDirectionsUrl(request: GoogleDirectionsRequest): string {
  const params = new URLSearchParams()

  // Origin
  params.append('origin', `${request.origin.lat},${request.origin.lng}`)

  // Destination
  params.append('destination', `${request.destination.lat},${request.destination.lng}`)

  // Waypoints (máximo 25 para requests estándar)
  if (request.waypoints.length > 0) {
    const waypointsStr = request.waypoints
      .map(wp => `${wp.lat},${wp.lng}`)
      .join('|')

    if (request.optimize && request.waypoints.length > 2) {
      // optimize:true solo funciona con 2+ waypoints
      params.append('waypoints', `optimize:true|${waypointsStr}`)
    } else {
      params.append('waypoints', waypointsStr)
    }
  }

  // API Key
  if (GOOGLE_MAPS_API_KEY) {
    params.append('key', GOOGLE_MAPS_API_KEY)
  }

  // Configuración adicional
  params.append('language', 'es')
  params.append('region', 'ar')
  params.append('units', 'metric')

  // Alternativas (solo funciona sin waypoints)
  if (request.alternatives && request.waypoints.length === 0) {
    params.append('alternatives', 'true')
  }

  return `${GOOGLE_DIRECTIONS_API_URL}?${params.toString()}`
}

/**
 * Convierte la respuesta de Google Directions a nuestro formato
 */
function parseGoogleResponse(data: any): GoogleDirectionsResponse {
  if (data.status !== 'OK') {
    return {
      success: false,
      error: `Google Directions API error: ${data.status} - ${data.error_message || 'Unknown error'}`
    }
  }

  if (!data.routes || data.routes.length === 0) {
    return {
      success: false,
      error: 'No routes found'
    }
  }

  const route = data.routes[0]

  // Extraer polyline
  const polyline = route.overview_polyline?.points || ''

  // Calcular distancia total (en metros) - sumando todos los legs
  const distance = route.legs.reduce((sum: number, leg: any) => sum + leg.distance.value, 0)

  // Calcular duración total (en segundos)
  const duration = route.legs.reduce((sum: number, leg: any) => sum + leg.duration.value, 0)

  console.log('[Google Directions] Parseando respuesta:', {
    status: data.status,
    legsCount: route.legs?.length,
    waypointOrder: route.waypoint_order,
    polylineLength: polyline.length,
    distanceM: distance,
    durationS: duration
  })

  // Extraer orden optimizado de waypoints
  // Google devuelve waypoint_order que es el índice original de cada waypoint en el orden optimizado
  const orderedStops: Array<{ lat: number; lng: number; waypointIndex?: number }> = []

  // Cuando hay waypoints, Google devuelve N+1 legs (origen a waypoint1, waypoint1 a waypoint2, ..., waypointN a destino)
  // waypoint_order indica el nuevo orden de los waypoints intermedios
  if (route.waypoint_order && route.waypoint_order.length > 0) {
    console.log('[Google Directions] Usando orden optimizado:', route.waypoint_order)

    // El orden optimizado: waypoint_order[i] indica qué waypoint original va en la posición i
    route.waypoint_order.forEach((originalIndex: number, optimizedPosition: number) => {
      // Los legs tienen: origen -> wp[order[0]] -> wp[order[1]] -> ... -> destino
      // Entonces leg[i].end_location es la ubicación del waypoint en posición i
      if (route.legs[optimizedPosition] && route.legs[optimizedPosition].end_location) {
        orderedStops.push({
          lat: route.legs[optimizedPosition].end_location.lat,
          lng: route.legs[optimizedPosition].end_location.lng,
          waypointIndex: originalIndex
        })
      }
    })
  } else {
    console.log('[Google Directions] Sin optimización de orden, usando orden original')
    // Sin optimización, cada leg excepto el último corresponde a un waypoint
    for (let i = 0; i < route.legs.length - 1; i++) {
      const leg = route.legs[i]
      if (leg.end_location) {
        orderedStops.push({
          lat: leg.end_location.lat,
          lng: leg.end_location.lng,
          waypointIndex: i
        })
      }
    }
  }

  console.log('[Google Directions] Orden final de paradas:', orderedStops.length, 'puntos')

  // Extraer rutas alternativas si hay más de una ruta
  const rutasAlternativas: RutaAlternativa[] = data.routes.map((r: any, index: number) => {
    const dist = r.legs.reduce((sum: number, leg: any) => sum + leg.distance.value, 0)
    const dur = r.legs.reduce((sum: number, leg: any) => sum + leg.duration.value, 0)

    // Obtener resumen (via "Ruta 9", etc.)
    const resumen = r.summary || `Ruta ${index + 1}`

    return {
      polyline: r.overview_polyline?.points || '',
      distancia: dist,
      duracion: dur,
      resumen,
      esPreferida: index === 0  // La primera es la preferida por Google
    }
  })

  console.log('[Google Directions] Rutas alternativas encontradas:', rutasAlternativas.length)

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
 * Obtiene ruta optimizada desde Google Directions API
 */
export async function getGoogleDirections(
  request: GoogleDirectionsRequest
): Promise<GoogleDirectionsResponse> {
  // Verificar que la API key esté configurada
  if (!GOOGLE_MAPS_API_KEY) {
    return {
      success: false,
      error: 'GOOGLE_MAPS_API_KEY no está configurada. Usa fallback local.'
    }
  }

  // Validar límites de waypoints
  if (request.waypoints.length > 25) {
    return {
      success: false,
      error: 'Máximo 25 waypoints permitidos por request de Google Directions. Divide la ruta en sub-rutas.'
    }
  }

  try {
    const url = buildDirectionsUrl(request)
    console.log('[Google Directions] Consultando API...')
    console.log('[Google Directions] Origin:', request.origin)
    console.log('[Google Directions] Destination:', request.destination)
    console.log('[Google Directions] Waypoints:', request.waypoints.length)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      console.error('[Google Directions] HTTP Error:', response.status, response.statusText)
      return {
        success: false,
        error: `HTTP error: ${response.status} ${response.statusText}`
      }
    }

    const data = await response.json()
    console.log('[Google Directions] Respuesta status:', data.status)

    // Manejar rate limits
    if (data.status === 'OVER_QUERY_LIMIT') {
      console.warn('Google Directions API: Rate limit exceeded')
      return {
        success: false,
        error: 'Rate limit exceeded. Usa fallback local.'
      }
    }

    if (data.status !== 'OK') {
      console.error('[Google Directions] Error status:', data.status, data.error_message)
    }

    return parseGoogleResponse(data)
  } catch (error: any) {
    console.error('Error al consultar Google Directions API:', error)
    return {
      success: false,
      error: error.message || 'Error desconocido al consultar Google Directions API'
    }
  }
}

/**
 * Verifica si Google Directions está disponible
 */
export function isGoogleDirectionsAvailable(): boolean {
  return !!GOOGLE_MAPS_API_KEY
}

