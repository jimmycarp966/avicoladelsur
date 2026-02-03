/**
 * IA Secundaria para análisis de matches dudosos (score 40-79)
 * Usa Gemini para decidir cuando el motor de reglas no está seguro
 */

import { GoogleGenerativeAI } from "@google/generative-ai"
import { config } from "@/lib/config"
import { DatosComprobante, MovimientoBancario } from "@/types/conciliacion"
import { GEMINI_MODEL_FLASH } from "@/lib/constants/gemini-models"
import { geminiConReintentos } from "./retry-utils"

const apiKey = config.googleCloud.gemini.apiKey || process.env.GOOGLE_GEMINI_API_KEY
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null

interface GeminiDecisionResponse {
    es_match: boolean
    confianza: number // 0.0 - 1.0
    razon: string
    sugerencias?: string[]
}

/**
 * Analiza un match dudoso usando Gemini para tomar la decisión final.
 * Se usa cuando el score del motor de reglas está entre 40-79.
 */
export async function analizarMatchDudoso(
    comprobante: DatosComprobante,
    movimiento: MovimientoBancario,
    scoreOriginal: number,
    detallesScore: Record<string, number>
): Promise<{
    esValido: boolean
    confianzaFinal: number
    razon: string
    etiquetasExtra: string[]
}> {
    if (!genAI) {
        console.warn('[GeminiMatcherV2] Gemini no configurado, usando score original')
        return {
            esValido: scoreOriginal >= 60, // Más permisivo si no hay IA
            confianzaFinal: scoreOriginal / 100,
            razon: 'Decisión basada solo en reglas (IA no disponible)',
            etiquetasExtra: []
        }
    }

    console.log('[GeminiMatcherV2] Analizando match dudoso...')
    console.log('[GeminiMatcherV2] Score original:', scoreOriginal)
    console.log('[GeminiMatcherV2] Comprobante:', { 
        monto: comprobante.monto, 
        fecha: comprobante.fecha,
        dni: comprobante.dni_cuit,
        ref: comprobante.referencia 
    })
    console.log('[GeminiMatcherV2] Movimiento:', { 
        monto: movimiento.monto, 
        fecha: movimiento.fecha,
        dni: movimiento.dni_cuit,
        ref: movimiento.referencia 
    })

    const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL_FLASH,
        generationConfig: { responseMimeType: "application/json" }
    })

    const prompt = `
Eres un experto en conciliación bancaria. Debes decidir si un comprobante de pago corresponde a un movimiento bancario.

DATOS DEL COMPROBANTE (imagen procesada):
- Monto: $${comprobante.monto}
- Fecha: ${comprobante.fecha || 'No detectada'}
- DNI/CUIT: ${comprobante.dni_cuit || 'No detectado'}
- Referencia: ${comprobante.referencia || 'No detectada'}
- Descripción: ${comprobante.descripcion || 'No detectada'}

DATOS DEL MOVIMIENTO BANCARIO (de la sábana):
- Monto: $${movimiento.monto}
- Fecha: ${movimiento.fecha}
- DNI/CUIT: ${movimiento.dni_cuit || 'No disponible'}
- Referencia: ${movimiento.referencia || 'No disponible'}
- Descripción: ${movimiento.descripcion || 'No disponible'}

SCORE ORIGINAL DEL SISTEMA: ${scoreOriginal}/100
FACTORES QUE COINCIDEN:
${Object.entries(detallesScore).map(([k, v]) => `- ${k}: +${v} pts`).join('\n')}

REGLAS DE DECISIÓN:
1. Los montos pueden diferir hasta 10% (comisiones, retenciones)
2. Las fechas pueden diferir hasta 5 días hábiles
3. El DNI/CUIT es el factor más importante
4. La referencia similar refuerza el match
5. Si la descripción del movimiento menciona el nombre del pagador, es un buen indicio

IMPORTANTE: Sé conservador. Solo aprueba si estás razonablemente seguro.

Responde EXCLUSIVAMENTE en JSON:
{
  "es_match": true/false,
  "confianza": 0.0-1.0,
  "razon": "Explicación breve de la decisión",
  "sugerencias": ["Sugerencia opcional para el usuario si hay discrepancias"]
}
`

    try {
        const result = await geminiConReintentos(async () => {
            return await model.generateContent(prompt)
        }, 3)

        const response = result.response
        const text = response.text()

        // Extraer JSON
        const jsonInicio = text.indexOf('{')
        const jsonFin = text.lastIndexOf('}') + 1
        const jsonStr = text.substring(jsonInicio, jsonFin)

        const data = JSON.parse(jsonStr) as GeminiDecisionResponse

        console.log('[GeminiMatcherV2] Decisión de Gemini:', data)

        // Calcular confianza final ponderada
        const confianzaFinal = Math.round(
            (scoreOriginal * 0.4 + data.confianza * 100 * 0.6)
        )

        return {
            esValido: data.es_match && data.confianza >= 0.65,
            confianzaFinal: confianzaFinal / 100,
            razon: data.razon,
            etiquetasExtra: data.sugerencias || []
        }

    } catch (error) {
        console.error('[GeminiMatcherV2] Error consultando Gemini:', error)
        // Fallback: usar score original con umbral más alto
        return {
            esValido: scoreOriginal >= 65,
            confianzaFinal: scoreOriginal / 100,
            razon: 'Error en IA secundaria, usando score original',
            etiquetasExtra: ['Revisión recomendada']
        }
    }
}

/**
 * Procesa múltiples matches dudosos en batch para eficiencia
 */
export async function analizarMatchesDudososBatch(
    casos: Array<{
        comprobante: DatosComprobante
        movimiento: MovimientoBancario
        score: number
        detalles: Record<string, number>
    }>
): Promise<Array<{
    esValido: boolean
    confianzaFinal: number
    razon: string
    etiquetasExtra: string[]
}>> {
    // Procesar secuencialmente para no saturar la API
    const resultados = []
    for (const caso of casos) {
        const resultado = await analizarMatchDudoso(
            caso.comprobante,
            caso.movimiento,
            caso.score,
            caso.detalles
        )
        resultados.push(resultado)
        // Pequeña pausa entre llamadas
        await new Promise(r => setTimeout(r, 500))
    }
    return resultados
}
