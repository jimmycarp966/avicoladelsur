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

const ORS_API_KEY = process.env.OPENROUTESERVICE_API_KEY
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
    geometry: 'encodedpolyline',
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
      return { success: false, error: `HTTP ${response.status}` }
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
