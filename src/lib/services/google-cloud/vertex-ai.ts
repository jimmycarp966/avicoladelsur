/**
 * Vertex AI API Integration
 * 
 * Integración con Google Vertex AI para entrenar y usar modelos de ML
 * personalizados para predicciones de demanda y análisis.
 */

import { getAccessToken, isGoogleCloudConfigured } from './auth'
import { config } from '@/lib/config'

export interface VertexAIRequest {
  modelId?: string
  instances: any[]
  parameters?: {
    temperature?: number
    maxOutputTokens?: number
    topP?: number
    topK?: number
  }
}

export interface VertexAIPredictionResponse {
  success: boolean
  predictions?: any[]
  error?: string
}

const VERTEX_AI_API_URL = 'https://aiplatform.googleapis.com/v1'

/**
 * Verifica si Vertex AI está disponible
 */
export function isVertexAIAvailable(): boolean {
  return (
    isGoogleCloudConfigured() &&
    config.googleCloud.vertexAI.enabled &&
    !!config.googleCloud.projectId
  )
}

/**
 * Hace una predicción usando un modelo de Vertex AI
 */
export async function predict(
  request: VertexAIRequest
): Promise<VertexAIPredictionResponse> {
  if (!isVertexAIAvailable()) {
    return {
      success: false,
      error: 'Vertex AI no está configurado o habilitado. Verifica GOOGLE_VERTEX_AI_ENABLED'
    }
  }

  try {
    const accessToken = await getAccessToken()
    const projectId = config.googleCloud.projectId
    const location = config.googleCloud.vertexAI.location
    const modelId = request.modelId || 'demand-prediction-model'

    const requestBody = {
      instances: request.instances,
      parameters: request.parameters || {}
    }

    const response = await fetch(
      `${VERTEX_AI_API_URL}/projects/${projectId}/locations/${location}/models/${modelId}:predict`,
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
        error: `Vertex AI API error: ${response.status} - ${errorData.error?.message || response.statusText}`
      }
    }

    const data = await response.json()

    return {
      success: true,
      predictions: data.predictions || []
    }
  } catch (error: any) {
    console.error('Error al consultar Vertex AI API:', error)
    return {
      success: false,
      error: error.message || 'Error desconocido al consultar Vertex AI API'
    }
  }
}

/**
 * Obtiene información de un modelo
 */
export async function getModelInfo(modelId: string): Promise<{
  success: boolean
  model?: {
    name: string
    displayName: string
    version?: string
    description?: string
  }
  error?: string
}> {
  if (!isVertexAIAvailable()) {
    return {
      success: false,
      error: 'Vertex AI no está configurado'
    }
  }

  try {
    const accessToken = await getAccessToken()
    const projectId = config.googleCloud.projectId
    const location = config.googleCloud.vertexAI.location

    const response = await fetch(
      `${VERTEX_AI_API_URL}/projects/${projectId}/locations/${location}/models/${modelId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: `Vertex AI API error: ${response.status} - ${errorData.error?.message || response.statusText}`
      }
    }

    const data = await response.json()

    return {
      success: true,
      model: {
        name: data.name || '',
        displayName: data.displayName || '',
        version: data.versionId || '',
        description: data.description || ''
      }
    }
  } catch (error: any) {
    console.error('Error al obtener información del modelo:', error)
    return {
      success: false,
      error: error.message || 'Error desconocido'
    }
  }
}

