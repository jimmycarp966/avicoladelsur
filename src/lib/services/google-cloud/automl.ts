/**
 * Cloud AutoML API Integration
 * 
 * Integración con Google Cloud AutoML para entrenar modelos sin código
 * y hacer clasificaciones automáticas.
 */

import { getAccessToken, isGoogleCloudConfigured } from './auth'
import { config } from '@/lib/config'

export interface AutoMLPredictionRequest {
  modelId: string
  payload: {
    textSnippet?: {
      content: string
      mimeType?: string
    }
    row?: Record<string, any>
  }
}

export interface AutoMLPredictionResponse {
  success: boolean
  prediction?: {
    classification?: {
      score: number
      displayName: string
    }
    regression?: {
      value: number
    }
  }
  error?: string
}

const AUTOML_API_URL = 'https://automl.googleapis.com/v1'

/**
 * Verifica si AutoML está disponible
 */
export function isAutoMLAvailable(): boolean {
  return (
    isGoogleCloudConfigured() &&
    config.googleCloud.automl.enabled &&
    !!config.googleCloud.projectId
  )
}

/**
 * Hace una predicción usando un modelo de AutoML
 */
export async function predictAutoML(
  request: AutoMLPredictionRequest
): Promise<AutoMLPredictionResponse> {
  if (!isAutoMLAvailable()) {
    return {
      success: false,
      error: 'AutoML no está configurado o habilitado. Verifica GOOGLE_AUTOML_ENABLED'
    }
  }

  try {
    const accessToken = await getAccessToken()
    const projectId = config.googleCloud.projectId
    const location = config.googleCloud.automl.location

    const requestBody = {
      payload: request.payload
    }

    const response = await fetch(
      `${AUTOML_API_URL}/projects/${projectId}/locations/${location}/models/${request.modelId}:predict`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: `AutoML API error: ${response.status} - ${errorData.error?.message || response.statusText}`
      }
    }

    const data = await response.json()

    // Parsear respuesta según el tipo de modelo
    const prediction = data.payload?.[0]
    if (!prediction) {
      return {
        success: false,
        error: 'No se encontró predicción en la respuesta'
      }
    }

    return {
      success: true,
      prediction: {
        classification: prediction.classification ? {
          score: prediction.classification.score || 0,
          displayName: prediction.classification.displayName || ''
        } : undefined,
        regression: prediction.regression ? {
          value: prediction.regression.value || 0
        } : undefined
      }
    }
  } catch (error: any) {
    console.error('Error al consultar AutoML API:', error)
    return {
      success: false,
      error: error.message || 'Error desconocido al consultar AutoML API'
    }
  }
}

/**
 * Clasifica un pedido según urgencia usando AutoML
 */
export async function clasificarUrgenciaPedido(
  pedidoData: {
    clienteId: string
    total: number
    productos: number
    historialCompras?: number
  }
): Promise<{
  success: boolean
  urgencia?: 'alta' | 'media' | 'baja'
  confianza?: number
  razones?: string[]
  error?: string
}> {
  // Por ahora, usar lógica básica hasta que se entrene el modelo
  // En producción, esto usaría AutoML con un modelo entrenado
  
  const urgencia = pedidoData.total > 50000 ? 'alta' : 
                   pedidoData.total > 20000 ? 'media' : 'baja'
  
  const razones: string[] = []
  if (pedidoData.total > 50000) razones.push('Valor alto')
  if (pedidoData.historialCompras && pedidoData.historialCompras > 10) razones.push('Cliente recurrente')
  if (pedidoData.productos > 5) razones.push('Múltiples productos')

  return {
    success: true,
    urgencia,
    confianza: 0.75, // Confianza básica hasta entrenar modelo
    razones
  }
}

