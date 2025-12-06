/**
 * Dialogflow API Integration
 * 
 * Integración con Google Dialogflow para procesamiento de lenguaje natural
 * y conversaciones inteligentes en el bot de WhatsApp.
 */

import { getAccessToken, isGoogleCloudConfigured } from './auth'
import { config } from '@/lib/config'

export interface DialogflowRequest {
  sessionId: string
  message: string
  languageCode?: string
  context?: Record<string, any>
}

export interface DialogflowResponse {
  success: boolean
  intent?: string
  confidence?: number
  response?: string
  parameters?: Record<string, any>
  contexts?: Array<{
    name: string
    lifespan: number
    parameters?: Record<string, any>
  }>
  fulfillmentMessages?: Array<{
    text?: {
      text: string[]
    }
  }>
  error?: string
}

const DIALOGFLOW_API_URL = 'https://dialogflow.googleapis.com/v2'

/**
 * Verifica si Dialogflow está disponible
 * En Dialogflow Essentials, el Agent ID puede ser el mismo que el Project ID
 */
export function isDialogflowAvailable(): boolean {
  const projectId = config.googleCloud.dialogflow.projectId
  return (
    isGoogleCloudConfigured() &&
    !!projectId
    // Agent ID es opcional en Dialogflow Essentials, puede usar Project ID
  )
}

/**
 * Obtiene el Agent ID, usando Project ID como fallback
 */
function getAgentId(): string {
  return config.googleCloud.dialogflow.agentId || config.googleCloud.dialogflow.projectId || ''
}

/**
 * Detecta la intención del usuario usando Dialogflow
 */
export async function detectIntent(
  request: DialogflowRequest
): Promise<DialogflowResponse> {
  if (!isDialogflowAvailable()) {
    return {
      success: false,
      error: 'Dialogflow no está configurado. Verifica GOOGLE_DIALOGFLOW_PROJECT_ID'
    }
  }

  try {
    const accessToken = await getAccessToken()
    const projectId = config.googleCloud.dialogflow.projectId
    // En Dialogflow Essentials, el Agent ID puede ser el mismo que el Project ID
    // La API v2 usa el project ID para identificar el agente
    const languageCode = request.languageCode || config.googleCloud.dialogflow.languageCode

    // Construir request body según Dialogflow API v2
    const requestBody = {
      queryInput: {
        text: {
          text: request.message,
          languageCode: languageCode
        }
      },
      queryParams: {
        contexts: request.context ? Object.entries(request.context).map(([name, parameters]) => ({
          name: `projects/${projectId}/agent/sessions/${request.sessionId}/contexts/${name}`,
          lifespanCount: 5,
          parameters: parameters
        })) : undefined
      }
    }

    const response = await fetch(
      `${DIALOGFLOW_API_URL}/projects/${projectId}/agent/sessions/${request.sessionId}:detectIntent`,
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
        error: `Dialogflow API error: ${response.status} - ${errorData.error?.message || response.statusText}`
      }
    }

    const data = await response.json()

    // Parsear respuesta
    const queryResult = data.queryResult
    if (!queryResult) {
      return {
        success: false,
        error: 'Respuesta inválida de Dialogflow'
      }
    }

    // Extraer mensaje de respuesta
    const fulfillmentMessages = queryResult.fulfillmentMessages || []
    const responseText = fulfillmentMessages
      .find((msg: any) => msg.text?.text)
      ?.text?.text?.[0] || queryResult.fulfillmentText || ''

    return {
      success: true,
      intent: queryResult.intent?.displayName,
      confidence: queryResult.intentDetectionConfidence,
      response: responseText,
      parameters: queryResult.parameters?.fields ? 
        Object.fromEntries(
          Object.entries(queryResult.parameters.fields).map(([key, value]: [string, any]) => [
            key,
            value.stringValue || value.numberValue || value.boolValue || value.listValue?.values
          ])
        ) : undefined,
      contexts: queryResult.outputContexts?.map((ctx: any) => ({
        name: ctx.name.split('/').pop() || '',
        lifespan: ctx.lifespanCount || 0,
        parameters: ctx.parameters?.fields ? 
          Object.fromEntries(
            Object.entries(ctx.parameters.fields).map(([key, value]: [string, any]) => [
              key,
              value.stringValue || value.numberValue || value.boolValue
            ])
          ) : undefined
      })),
      fulfillmentMessages
    }
  } catch (error: any) {
    console.error('Error al consultar Dialogflow API:', error)
    return {
      success: false,
      error: error.message || 'Error desconocido al consultar Dialogflow API'
    }
  }
}

/**
 * Crea una sesión única para un cliente
 */
export function createSessionId(clienteId: string): string {
  return `cliente-${clienteId}`
}

