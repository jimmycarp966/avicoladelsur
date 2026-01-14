/**
 * OpenRouteService (ORS) Directions API Integration
 * 
 * Usa datos de OpenStreetMap. Se prioriza ORS y se mantiene fallback a Google Directions y optimizador local.
 */

export interface ORSRequest {
  origin: { lat: number; lng: number }
  destination: { lat: number; lng: number }
  waypoints?: Array<{ lat: number; lng: number }>
  alternatives?: boolean
  vehicle?: 'driving-car' | 'driving-hgv'
}

export interface RutaAlternativa {
  polyline: string
  distancia: number // metros
  duracion: number // segundos
  resumen: string
  esPreferida?: boolean
}

export interface ORSResponse {
  success: boolean
  polyline?: string
  distance?: number
  duration?: number
  rutasAlternativas?: RutaAlternativa[]
  error?: string
}

const ORS_API_KEY = process.env.NEXT_PUBLIC_OPENROUTESERVICE_API_KEY
const ORS_URL = 'https://api.openrouteservice.org/v2/directions'

function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let b
    let shift = 0
    let result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1)
    lat += dlat

    shift = 0
    result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1)
    lng += dlng

    points.push({ lat: lat / 1e5, lng: lng / 1e5 })
  }
  return points
}

function parseORS(data: any): ORSResponse {
  if (!data?.routes || data.routes.length === 0) {
    return { success: false, error: 'No se encontraron rutas en ORS' }
  }

  const primary = data.routes[0]
  const polyline = primary.geometry
  const distance = primary.summary?.distance || 0
  const duration = primary.summary?.duration || 0

  const rutasAlternativas: RutaAlternativa[] | undefined = data.routes.length > 1
    ? data.routes.map((r: any, idx: number) => ({
      polyline: r.geometry,
      distancia: r.summary?.distance || 0,
      duracion: r.summary?.duration || 0,
      resumen: r.summary?.text || `Ruta ${idx + 1}`,
      esPreferida: idx === 0
    }))
    : undefined

  return {
    success: true,
    polyline,
    distance,
    duration,
    rutasAlternativas
  }
}

export async function getORSDirections(request: ORSRequest): Promise<ORSResponse> {
  if (!ORS_API_KEY) {
    return { success: false, error: 'OPENROUTESERVICE_API_KEY no está configurada' }
  }

  const coords = [
    [request.origin.lng, request.origin.lat],
    ...(request.waypoints || []).map(wp => [wp.lng, wp.lat]),
    [request.destination.lng, request.destination.lat]
  ]

  const body: any = {
    coordinates: coords,
    instructions: false,
    geometry: true,  // ORS devuelve polyline codificado por defecto
    geometry_simplify: false
  }

  // ORS soporta alternativas con parámetros advance
  if (request.alternatives) {
    body.alternative_routes = {
      target_count: 3,
      share_factor: 0.6,
      weight_factor: 1.4
    }
  }

  const profile = request.vehicle || 'driving-car'

  try {
    const response = await fetch(`${ORS_URL}/${profile}`, {
      method: 'POST',
      headers: {
        'Authorization': ORS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[ORS] Error response:', response.status, errorText)
      return { success: false, error: `HTTP ${response.status}: ${errorText}` }
    }

    const data = await response.json()
    return parseORS(data)
  } catch (error: any) {
    return { success: false, error: error.message || 'Error consultando ORS' }
  }
}

/**
 * Fallback: ORS → Google → Local optimizer
 */
export async function getDirectionsWithFallback(
  request: ORSRequest
): Promise<{ response: ORSResponse; provider: 'ors' | 'google' | 'local' }> {
  // ORS
  if (ORS_API_KEY) {
    const orsRes = await getORSDirections(request)
    if (orsRes.success) {
      return { response: orsRes, provider: 'ors' }
    }
  }

  // Google fallback
  try {
    const { getGoogleDirections } = await import('./google-directions')
    const googleRes = await getGoogleDirections({
      origin: request.origin,
      destination: request.destination,
      waypoints: request.waypoints || [],
      alternatives: request.alternatives
    })
    if (googleRes.success) {
      return {
        response: {
          success: true,
          polyline: googleRes.polyline,
          distance: googleRes.distance,
          duration: googleRes.duration,
          rutasAlternativas: googleRes.rutasAlternativas
        },
        provider: 'google'
      }
    }
  } catch (e) {
    // ignore
  }

  // Local optimizer
  try {
    const { optimizeRouteLocal } = await import('./local-optimizer')
    const origin = { ...request.origin, id: 'origin' }
    const destination = { ...request.destination, id: 'destination' }
    const waypoints = (request.waypoints || []).map((wp, i) => ({ ...wp, id: `wp_${i}` }))
    const optimized = optimizeRouteLocal(origin, waypoints, destination)
    const polyline = optimized.orderedPoints.map(p => `${p.lat},${p.lng}`).join(';')

    return {
      response: {
        success: true,
        polyline,
        distance: (optimized.totalDistance || 0) * 1000,
        duration: (optimized.estimatedDuration || 0) * 60
      },
      provider: 'local'
    }
  } catch (error: any) {
    return {
      response: { success: false, error: 'Todos los proveedores fallaron' },
      provider: 'local'
    }
  }
}

// ============================================
// ORS OPTIMIZATION API - Reordena paradas óptimamente
// ============================================

export interface OptimizationRequest {
  depot: { lat: number; lng: number } // Punto de partida (base)
  stops: Array<{ id: string; lat: number; lng: number; serviceTime?: number }>
  returnToDepot?: boolean
  vehicle?: 'driving-car' | 'driving-hgv'
}

export interface OptimizationResult {
  success: boolean
  orderedStops?: Array<{ id: string; lat: number; lng: number }>
  polyline?: string
  totalDistance?: number // metros
  totalDuration?: number // segundos
  error?: string
}

const ORS_OPTIMIZATION_URL = 'https://api.openrouteservice.org/optimization'

/**
 * Optimiza el orden de visitas usando ORS VROOM (TSP solver)
 * Considera rutas reales, sentidos de calle, tiempos de giro, etc.
 */
export async function optimizeRouteORS(request: OptimizationRequest): Promise<OptimizationResult> {
  if (!ORS_API_KEY) {
    return { success: false, error: 'OPENROUTESERVICE_API_KEY no está configurada' }
  }

  if (request.stops.length === 0) {
    return { success: false, error: 'No hay paradas para optimizar' }
  }

  // Si solo hay 1 parada, no hay nada que optimizar
  if (request.stops.length === 1) {
    return {
      success: true,
      orderedStops: request.stops,
      totalDistance: 0,
      totalDuration: 0
    }
  }

  // Construir jobs (paradas a visitar)
  const jobs = request.stops.map((stop, idx) => ({
    id: idx + 1, // VROOM necesita IDs numéricos empezando en 1
    location: [stop.lng, stop.lat],
    service: stop.serviceTime || 300 // 5 minutos por defecto
  }))

  // Construir vehicle (camión de reparto)
  const vehicles = [{
    id: 1,
    profile: request.vehicle || 'driving-car',
    start: [request.depot.lng, request.depot.lat],
    end: request.returnToDepot !== false ? [request.depot.lng, request.depot.lat] : undefined
  }]

  const body = {
    jobs,
    vehicles,
    options: {
      g: true // Incluir geometría
    }
  }

  try {
    console.log('[ORS Optimization] Solicitando optimización para', request.stops.length, 'paradas...')

    const response = await fetch(ORS_OPTIMIZATION_URL, {
      method: 'POST',
      headers: {
        'Authorization': ORS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[ORS Optimization] Error:', response.status, errorText)
      return { success: false, error: `HTTP ${response.status}: ${errorText}` }
    }

    const data = await response.json()

    if (!data.routes || data.routes.length === 0) {
      return { success: false, error: 'No se encontró solución de optimización' }
    }

    const route = data.routes[0]

    // Extraer el orden optimizado de los steps
    const orderedStops: Array<{ id: string; lat: number; lng: number }> = []
    for (const step of route.steps || []) {
      if (step.type === 'job') {
        // El job ID es 1-indexed, convertir al stop original
        const originalStop = request.stops[step.job - 1]
        if (originalStop) {
          orderedStops.push(originalStop)
        }
      }
    }

    // Log detallado del orden original vs optimizado
    console.log('[ORS Optimization] 📋 Orden ORIGINAL:', request.stops.map(s => s.id).join(' → '))
    console.log('[ORS Optimization] 🎯 Orden OPTIMIZADO:', orderedStops.map(s => s.id).join(' → '))
    console.log('[ORS Optimization] ✅ Ruta optimizada:', orderedStops.length, 'paradas, distancia:', route.distance, 'm, duración:', Math.round(route.duration / 60), 'min')

    return {
      success: true,
      orderedStops,
      polyline: route.geometry,
      totalDistance: route.distance,
      totalDuration: route.duration
    }
  } catch (error: any) {
    console.error('[ORS Optimization] Exception:', error)
    return { success: false, error: error.message || 'Error en optimización ORS' }
  }
}

/**
 * Optimiza y obtiene ruta completa en un solo paso
 * 1. Primero optimiza el orden con ORS Optimization
 * 2. Luego obtiene la ruta detallada con ORS Directions
 */
export async function getOptimizedRoute(request: OptimizationRequest): Promise<{
  response: ORSResponse
  orderedStops: Array<{ id: string; lat: number; lng: number }>
  provider: 'ors-optimized' | 'ors' | 'google' | 'local'
}> {
  // Paso 1: Optimizar el orden
  const optimized = await optimizeRouteORS(request)

  if (optimized.success && optimized.orderedStops && optimized.orderedStops.length > 0) {
    // Si la optimización devuelve polyline, usarla directamente
    if (optimized.polyline) {
      return {
        response: {
          success: true,
          polyline: optimized.polyline,
          distance: optimized.totalDistance,
          duration: optimized.totalDuration
        },
        orderedStops: optimized.orderedStops,
        provider: 'ors-optimized'
      }
    }

    // Si no, obtener la ruta con el orden optimizado
    const lastStop = optimized.orderedStops[optimized.orderedStops.length - 1]
    const intermediateStops = optimized.orderedStops.slice(0, -1)

    const { response, provider } = await getDirectionsWithFallback({
      origin: request.depot,
      destination: request.returnToDepot !== false ? request.depot : lastStop,
      waypoints: request.returnToDepot !== false ? optimized.orderedStops : intermediateStops,
      vehicle: request.vehicle
    })

    return {
      response,
      orderedStops: optimized.orderedStops,
      provider: provider === 'ors' ? 'ors-optimized' : provider
    }
  }

  // Fallback: usar orden original sin optimización
  console.warn('[ORS Optimization] Fallback a ruta sin optimizar')
  const lastStop = request.stops[request.stops.length - 1]
  const intermediateStops = request.stops.slice(0, -1)

  const { response, provider } = await getDirectionsWithFallback({
    origin: request.depot,
    destination: request.returnToDepot !== false ? request.depot : lastStop,
    waypoints: request.returnToDepot !== false ? request.stops : intermediateStops,
    vehicle: request.vehicle
  })

  return {
    response,
    orderedStops: request.stops,
    provider
  }
}
