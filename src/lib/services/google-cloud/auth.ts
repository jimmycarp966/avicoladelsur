/**
 * Google Cloud Authentication Helper
 * Maneja la autenticación con Google Cloud usando Application Default Credentials (ADC)
 * o Service Account como fallback
 */

import { GoogleAuth } from 'google-auth-library'
import { config } from '@/lib/config'

let authClient: GoogleAuth | null = null

/**
 * Obtiene las credenciales del Service Account desde variables de entorno
 */
function getServiceAccountCredentials() {
  const { serviceAccount } = config.googleCloud

  // Opción 1: Base64 encoded JSON (producción)
  if (serviceAccount.base64) {
    try {
      const jsonString = Buffer.from(serviceAccount.base64, 'base64').toString('utf-8')
      return JSON.parse(jsonString)
    } catch (error) {
      console.error('Error decodificando Service Account base64:', error)
      throw new Error('Invalid Service Account base64 format')
    }
  }

  // Opción 2: Ruta al archivo JSON (desarrollo)
  if (serviceAccount.path) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require(serviceAccount.path)
    } catch (error) {
      console.error('Error cargando Service Account desde archivo:', error)
      throw new Error(`Cannot load Service Account from ${serviceAccount.path}`)
    }
  }

  return null
}

/**
 * Obtiene un cliente de autenticación de Google Cloud
 * Prioriza Application Default Credentials (ADC), luego Service Account
 */
export function getGoogleAuthClient(): GoogleAuth {
  if (authClient) {
    return authClient
  }

  try {
    const credentials = getServiceAccountCredentials()
    
    // Si hay credenciales de Service Account, usarlas
    if (credentials) {
      authClient = new GoogleAuth({
        credentials,
        projectId: config.googleCloud.projectId,
      })
    } else {
      // Usar Application Default Credentials (ADC)
      // Esto buscará credenciales en:
      // 1. GOOGLE_APPLICATION_CREDENTIALS env var
      // 2. gcloud auth application-default login
      // 3. GCE/Cloud Run metadata service
      authClient = new GoogleAuth({
        projectId: config.googleCloud.projectId,
        // No pasar credentials para usar ADC
      })
    }

    return authClient
  } catch (error) {
    console.error('Error inicializando Google Auth:', error)
    throw error
  }
}

/**
 * Verifica si Google Cloud está configurado correctamente
 */
export function isGoogleCloudConfigured(): boolean {
  try {
    const { projectId } = config.googleCloud
    
    if (!projectId) {
      return false
    }

    // Si hay Service Account configurado, validarlo
    const credentials = getServiceAccountCredentials()
    if (credentials) {
      return true
    }

    // Si no hay Service Account, verificar que ADC esté disponible
    // Intentar crear un cliente para validar
    const auth = new GoogleAuth({
      projectId: config.googleCloud.projectId,
    })
    
    return !!auth
  } catch {
    return false
  }
}

/**
 * Obtiene un access token para usar con APIs de Google Cloud
 */
export async function getAccessToken(): Promise<string> {
  const auth = getGoogleAuthClient()
  const client = await auth.getClient()
  
  if ('getAccessToken' in client && typeof client.getAccessToken === 'function') {
    const tokenResponse = await client.getAccessToken()
    return tokenResponse.token || ''
  }

  throw new Error('Cannot get access token from auth client')
}

