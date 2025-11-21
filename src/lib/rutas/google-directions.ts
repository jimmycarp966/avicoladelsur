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
}

export interface GoogleDirectionsResponse {
  success: boolean
  orderedStops?: Array<{ lat: number; lng: number; waypointIndex?: number }>
  polyline?: string
  distance?: number // en metros
  duration?: number // en segundos
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
  const leg = route.legs[0]
  
  // Extraer polyline
  const polyline = route.overview_polyline?.points || ''
  
  // Calcular distancia total (en metros)
  const distance = route.legs.reduce((sum: number, leg: any) => sum + leg.distance.value, 0)
  
  // Calcular duración total (en segundos)
  const duration = route.legs.reduce((sum: number, leg: any) => sum + leg.duration.value, 0)
  
  // Extraer orden optimizado de waypoints
  const orderedStops: Array<{ lat: number; lng: number; waypointIndex?: number }> = []
  
  if (route.waypoint_order && route.waypoint_order.length > 0) {
    // Si hay optimización, usar el orden optimizado
    route.waypoint_order.forEach((waypointIndex: number, order: number) => {
      // Los waypoints están en el orden original, pero waypoint_order indica el orden optimizado
      // Necesitamos extraer las coordenadas de los waypoints en el orden optimizado
      if (leg.steps && leg.steps.length > 0) {
        // Aproximación: usar el inicio de cada leg para los waypoints
        const step = leg.steps[Math.floor((order / route.waypoint_order.length) * leg.steps.length)]
        if (step && step.start_location) {
          orderedStops.push({
            lat: step.start_location.lat,
            lng: step.start_location.lng,
            waypointIndex
          })
        }
      }
    })
  } else {
    // Sin optimización, usar el orden original
    route.legs.forEach((leg: any, index: number) => {
      if (leg.start_location) {
        orderedStops.push({
          lat: leg.start_location.lat,
          lng: leg.start_location.lng,
          waypointIndex: index
        })
      }
    })
  }
  
  return {
    success: true,
    orderedStops,
    polyline,
    distance,
    duration
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
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP error: ${response.status} ${response.statusText}`
      }
    }
    
    const data = await response.json()
    
    // Manejar rate limits
    if (data.status === 'OVER_QUERY_LIMIT') {
      console.warn('Google Directions API: Rate limit exceeded')
      return {
        success: false,
        error: 'Rate limit exceeded. Usa fallback local.'
      }
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

