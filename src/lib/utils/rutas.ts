/**
 * Utilidades para manejo de rutas (polylines y coordenadas)
 */

export type LatLngTuple = [number, number]

/**
 * Convierte un string polyline (simple o codificado) en una lista de puntos [lat, lng]
 * - Formato simple esperado: "lat1,lng1;lat2,lng2;..."
 * - Si no contiene ';', intenta decodificar formato polyline de Google
 */
export function parsePolyline(polyline?: string | null): LatLngTuple[] {
  if (!polyline) return []

  const trimmed = polyline.trim()
  if (!trimmed) return []

  // Formato simple usado por generateSimplePolyline
  if (trimmed.includes(';')) {
    return trimmed
      .split(';')
      .map(segment => segment.trim())
      .map(segment => {
        const [latStr, lngStr] = segment.split(',')
        const lat = Number(latStr)
        const lng = Number(lngStr)
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return [lat, lng] as LatLngTuple
        }
        return null
      })
      .filter((point): point is LatLngTuple => Array.isArray(point))
  }

  // Intentar decodificar polyline de Google Directions
  try {
    return decodeGooglePolyline(trimmed)
  } catch (error) {
    console.error('Error decoding polyline:', error)
    return []
  }
}

/**
 * Normaliza cualquier representación de coordenadas a un objeto { lat, lng }
 * Soporta múltiples formatos:
 * - { lat, lng }
 * - GeoJSON Point: { type: 'Point', coordinates: [lng, lat] }
 * - String: "lat,lng" o "SRID=4326;POINT(lng lat)"
 * - PostGIS geometry object (puede venir como objeto con propiedades internas)
 */
export function normalizeCoordinates(
  coords: any
): { lat: number; lng: number } | null {
  if (!coords) {
    console.log('🗺️ [normalizeCoordinates] Coordenadas vacías o null')
    return null
  }

  console.log('🗺️ [normalizeCoordinates] Procesando coordenadas:', {
    coords,
    tipo: typeof coords,
    esArray: Array.isArray(coords),
    keys: typeof coords === 'object' && coords !== null ? Object.keys(coords) : null,
  })

  // Formato objeto con lat/lng
  if (
    typeof coords === 'object' &&
    coords !== null &&
    'lat' in coords &&
    'lng' in coords
  ) {
    const lat = typeof coords.lat === 'string' ? Number(coords.lat) : coords.lat
    const lng = typeof coords.lng === 'string' ? Number(coords.lng) : coords.lng
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      console.log('✅ [normalizeCoordinates] Formato {lat, lng} detectado:', { lat, lng })
      return { lat, lng }
    }
    console.log('⚠️ [normalizeCoordinates] Formato {lat, lng} inválido:', { lat, lng })
    return null
  }

  // Formato GeoJSON Point (PostGIS devuelve [lng, lat])
  if (
    typeof coords === 'object' &&
    coords !== null &&
    'type' in coords &&
    coords.type === 'Point' &&
    Array.isArray(coords.coordinates) &&
    coords.coordinates.length === 2
  ) {
    const [lng, lat] = coords.coordinates
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      console.log('✅ [normalizeCoordinates] Formato GeoJSON Point detectado:', { lat, lng })
      return { lat, lng }
    }
    console.log('⚠️ [normalizeCoordinates] Formato GeoJSON Point inválido:', coords.coordinates)
    return null
  }

  // Formato string simple "lat,lng"
  if (typeof coords === 'string' && coords.includes(',')) {
    // Intentar parsear formato EWKT primero: "SRID=4326;POINT(lng lat)"
    const ewktMatch = coords.match(/POINT\(([^)]+)\)/)
    if (ewktMatch) {
      const parts = ewktMatch[1].trim().split(/\s+/)
      const lngStr = parts[0]
      const latStr = parts[1] || parts[0]
      const lat = Number(latStr)
      const lng = Number(lngStr)
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        console.log('✅ [normalizeCoordinates] Formato EWKT detectado:', { lat, lng })
        return { lat, lng }
      }
    }
    
    // Formato simple "lat,lng"
    const [latStr, lngStr] = coords.split(',')
    const lat = Number(latStr?.trim())
    const lng = Number(lngStr?.trim())
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      console.log('✅ [normalizeCoordinates] Formato string "lat,lng" detectado:', { lat, lng })
      return { lat, lng }
    }
  }

  console.log('⚠️ [normalizeCoordinates] Formato no reconocido:', coords)
  return null
}

/**
 * Genera un link a Google Maps para navegar al punto dado
 */
export function buildGoogleMapsDirectionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}

/**
 * Implementación ligera del algoritmo de decodificación de polylines de Google
 * Basado en la documentación oficial: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
function decodeGooglePolyline(encoded: string): LatLngTuple[] {
  const coordinates: LatLngTuple[] = []
  let index = 0
  const len = encoded.length
  let lat = 0
  let lng = 0

  while (index < len) {
    let b
    let shift = 0
    let result = 0

    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20 && index < len)

    const deltaLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1
    lat += deltaLat

    shift = 0
    result = 0

    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20 && index < len)

    const deltaLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1
    lng += deltaLng

    coordinates.push([lat / 1e5, lng / 1e5])
  }

  return coordinates
}


