/**
 * Gemini API Integration
 * 
 * Integración con Google Gemini API para generar reportes inteligentes
 * y análisis de datos en lenguaje natural.
 * 
 * Actualizado: Uso de SDK oficial @google/generative-ai
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { isGoogleCloudConfigured } from './auth'
import { config } from '@/lib/config'

export interface GeminiRequest {
  prompt: string
  context?: string
  temperature?: number
  maxTokens?: number
}

export interface GeminiResponse {
  success: boolean
  text?: string
  error?: string
}

/**
 * Verifica si Gemini está disponible
 */
export function isGeminiAvailable(): boolean {
  return (
    isGoogleCloudConfigured() &&
    !!config.googleCloud.gemini.apiKey
  )
}

/**
 * Obtiene una instancia del modelo Gemini configurado
 */
function getGeminiModel(temperature: number = 0.7, maxTokens: number = 2048) {
  const apiKey = config.googleCloud.gemini.apiKey || ''
  const modelName = config.googleCloud.gemini.model // 'gemini-3-pro-preview' por defecto en config

  const genAI = new GoogleGenerativeAI(apiKey)
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      topP: 0.95,
      topK: 40
    }
  })
}

/**
 * Genera texto usando Gemini SDK
 */
export async function generateText(
  request: GeminiRequest
): Promise<GeminiResponse> {
  if (!isGeminiAvailable()) {
    return {
      success: false,
      error: 'Gemini API no está configurada. Verifica GOOGLE_GEMINI_API_KEY'
    }
  }

  try {
    // Construir prompt completo
    const fullPrompt = request.context
      ? `${request.context}\n\n${request.prompt}`
      : request.prompt

    const model = getGeminiModel(request.temperature, request.maxTokens)

    // Generar contenido
    const result = await model.generateContent(fullPrompt)
    const response = await result.response
    const text = response.text()

    if (!text) {
      return {
        success: false,
        error: 'No se generó texto en la respuesta'
      }
    }

    return {
      success: true,
      text
    }
  } catch (error: any) {
    console.error('Error al consultar Gemini SDK:', error)
    return {
      success: false,
      error: error.message || 'Error desconocido al consultar Gemini SDK'
    }
  }
}

/**
 * Genera un reporte semanal usando Gemini
 */
export async function generarReporteSemanal(
  datosSemana: {
    ventas: number
    pedidos: number
    productos: Array<{ nombre: string; cantidad: number }>
    tendencias?: Record<string, any>
  }
): Promise<GeminiResponse> {
  const context = `Eres un analista de negocio para Avícola del Sur. 
Analiza los siguientes datos de la semana y genera un reporte ejecutivo en español argentino.

Datos de la semana:
- Ventas totales: $${datosSemana.ventas.toLocaleString('es-AR')}
- Total de pedidos: ${datosSemana.pedidos}
- Productos más vendidos: ${datosSemana.productos.map(p => `${p.nombre} (${p.cantidad}kg)`).join(', ')}

Genera un reporte que incluya:
1. Resumen ejecutivo de la semana
2. Análisis de tendencias
3. Recomendaciones para la próxima semana
4. Alertas importantes si las hay

Sé conciso pero informativo.`

  return generateText({
    prompt: 'Genera el reporte semanal basado en los datos proporcionados.',
    context,
    temperature: 0.7
  })
}

/**
 * Responde preguntas sobre los datos del negocio
 */
export async function responderPregunta(
  pregunta: string,
  datosContexto: Record<string, any>
): Promise<GeminiResponse> {
  const context = `Eres un asistente de análisis de negocio para Avícola del Sur.
Tienes acceso a los siguientes datos:

${JSON.stringify(datosContexto, null, 2)}

Responde la pregunta del usuario de forma clara y profesional en español argentino.
Si no tienes suficiente información, indícalo claramente.`

  return generateText({
    prompt: pregunta,
    context,
    temperature: 0.5
  })
}


