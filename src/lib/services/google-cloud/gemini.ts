/**
 * Gemini API Integration
 */

import { isGoogleCloudConfigured } from './auth'
import { getGeminiModel, getGeminiRuntimeInfo } from '@/lib/ai/runtime'

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

export function isGeminiAvailable(): boolean {
  return isGoogleCloudConfigured() && getGeminiRuntimeInfo().available
}

function buildGeminiModel(temperature: number = 0.7, maxTokens: number = 2048) {
  const model = getGeminiModel(getGeminiRuntimeInfo().model, {
    temperature,
    maxOutputTokens: maxTokens,
    topP: 0.95,
    topK: 40,
  })
  if (!model) return null

  return model
}

export async function generateText(request: GeminiRequest): Promise<GeminiResponse> {
  if (!isGeminiAvailable()) {
    return {
      success: false,
      error: 'Gemini API no esta configurada. Verifica GOOGLE_GEMINI_API_KEY',
    }
  }

  try {
    const fullPrompt = request.context ? `${request.context}\n\n${request.prompt}` : request.prompt

    const model = buildGeminiModel(request.temperature, request.maxTokens)
    if (!model) {
      return {
        success: false,
        error: 'No se pudo inicializar el modelo de Gemini',
      }
    }

    const result = await model.generateContent(fullPrompt)
    const response = await result.response
    const text = response.text()

    if (!text) {
      return {
        success: false,
        error: 'No se genero texto en la respuesta',
      }
    }

    return {
      success: true,
      text,
    }
  } catch (error: any) {
    console.error('Error al consultar Gemini SDK:', error)
    return {
      success: false,
      error: error.message || 'Error desconocido al consultar Gemini SDK',
    }
  }
}

export async function generarReporteSemanal(datosSemana: {
  ventas: number
  pedidos: number
  productos: Array<{ nombre: string; cantidad: number }>
  tendencias?: Record<string, any>
}): Promise<GeminiResponse> {
  const context = `Eres un analista de negocio para Avicola del Sur.
Analiza los siguientes datos de la semana y genera un reporte ejecutivo en espanol argentino.

Datos de la semana:
- Ventas totales: $${datosSemana.ventas.toLocaleString('es-AR')}
- Total de pedidos: ${datosSemana.pedidos}
- Productos mas vendidos: ${datosSemana.productos.map((p) => `${p.nombre} (${p.cantidad}kg)`).join(', ')}

Genera un reporte que incluya:
1. Resumen ejecutivo de la semana
2. Analisis de tendencias
3. Recomendaciones para la proxima semana
4. Alertas importantes si las hay

Se conciso pero informativo.`

  return generateText({
    prompt: 'Genera el reporte semanal basado en los datos proporcionados.',
    context,
    temperature: 0.7,
  })
}

export async function responderPregunta(
  pregunta: string,
  datosContexto: Record<string, any>
): Promise<GeminiResponse> {
  const context = `Eres un asistente de analisis de negocio para Avicola del Sur.
Tienes acceso a los siguientes datos:

${JSON.stringify(datosContexto, null, 2)}

Responde la pregunta del usuario de forma clara y profesional en espanol argentino.
Si no tienes suficiente informacion, indicalo claramente.`

  return generateText({
    prompt: pregunta,
    context,
    temperature: 0.5,
  })
}
