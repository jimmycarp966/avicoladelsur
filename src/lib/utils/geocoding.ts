/**
 * Utilidad para geocodificación usando Google Maps Geocoding API
 * 
 * Permite convertir direcciones de texto a coordenadas (lat, lng)
 */

export interface GeocodingResult {
  lat: number
  lng: number
  direccion_formateada: string
}

export interface GeocodingResponse {
  success: boolean
  data?: GeocodingResult
  error?: string
}

/**
 * Geocodifica una dirección usando Google Maps Geocoding API
 * 
 * @param direccion - Dirección a geocodificar
 * @param apiKey - API key de Google Maps (opcional, usa variable de entorno si no se proporciona)
 * @returns Objeto con coordenadas y dirección formateada, o null si falla
 */
export async function geocodificarDireccion(
  direccion: string,
  apiKey?: string
): Promise<GeocodingResponse> {
  const key = apiKey || process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (!key) {
    return {
      success: false,
      error: 'API key de Google Maps no configurada (GOOGLE_MAPS_API_KEY)'
    }
  }

  if (!direccion || direccion.trim() === '') {
    return {
      success: false,
      error: 'Dirección vacía o inválida'
    }
  }

  try {
    const encodedAddress = encodeURIComponent(direccion.trim())
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${key}`

    const response = await fetch(url)
    
    if (!response.ok) {
      return {
        success: false,
        error: `Error HTTP: ${response.status} ${response.statusText}`
      }
    }

    const data = await response.json()

    // Manejar diferentes estados de respuesta de Google
    switch (data.status) {
      case 'OK':
        if (data.results && data.results.length > 0) {
          const result = data.results[0]
          return {
            success: true,
            data: {
              lat: result.geometry.location.lat,
              lng: result.geometry.location.lng,
              direccion_formateada: result.formatted_address
            }
          }
        }
        return {
          success: false,
          error: 'No se encontraron resultados'
        }

      case 'ZERO_RESULTS':
        return {
          success: false,
          error: 'No se encontraron coordenadas para esta dirección'
        }

      case 'OVER_QUERY_LIMIT':
        return {
          success: false,
          error: 'Límite de consultas excedido. Espera un momento antes de continuar.'
        }

      case 'REQUEST_DENIED':
        return {
          success: false,
          error: 'Solicitud denegada. Verifica la API key y los permisos.'
        }

      case 'INVALID_REQUEST':
        return {
          success: false,
          error: 'Solicitud inválida. Verifica la dirección.'
        }

      default:
        return {
          success: false,
          error: `Error de Google Maps: ${data.status} - ${data.error_message || 'Sin detalles'}`
        }
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Error de red: ${error.message || 'Error desconocido'}`
    }
  }
}

/**
 * Construye una dirección completa agregando localidad, provincia y país
 * 
 * @param domicilio - Dirección base (ej: "COLON 750")
 * @param localidad - Localidad (ej: "MONTEROS")
 * @param provincia - Provincia (default: "Tucumán")
 * @param pais - País (default: "Argentina")
 * @returns Dirección completa formateada
 */
export function construirDireccionCompleta(
  domicilio: string,
  localidad: string,
  provincia: string = 'Tucumán',
  pais: string = 'Argentina'
): string {
  const partes = [domicilio, localidad, provincia, pais].filter(p => p && p.trim() !== '')
  return partes.join(', ')
}

/**
 * Verifica si una dirección es un caso especial que debe omitirse
 * (retira del galón, compra galón, etc.)
 * 
 * @param domicilio - Dirección a verificar
 * @returns true si es caso especial (debe omitirse)
 */
export function esCasoEspecial(domicilio: string): boolean {
  if (!domicilio) return true
  
  const upper = domicilio.toUpperCase()
  const casosEspeciales = [
    'RETIRA',
    'COMPRA GALPON',
    'COMPRA CASA CENTRAL',
    'CASA CENTRAL'
  ]
  
  return casosEspeciales.some(caso => upper.includes(caso))
}

/**
 * Espera un tiempo determinado (para rate limiting)
 * 
 * @param ms - Milisegundos a esperar
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}







