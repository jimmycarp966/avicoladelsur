/**
 * Cliente de Google Gemini AI para análisis inteligente
 * Usado en detección de anomalías de pesaje
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_MODEL_FLASH } from '@/lib/constants/gemini-models'

// Inicializar cliente de Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '')

export interface AnalisisPesoAnomalo {
    esAnomalo: boolean
    confianza: number // 0-100
    razon: string
    sugerencia: string | null
}

export interface DatosPesaje {
    productoNombre: string
    pesoSolicitado: number
    pesoIngresado: number
    unidad: string
}

/**
 * Analiza si un peso ingresado es anómalo usando Google Gemini AI
 */
export async function analizarPesoConIA(datos: DatosPesaje): Promise<AnalisisPesoAnomalo> {
    try {
        // Modelo flash estandarizado para análisis rápidos
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_FLASH })

        const prompt = `Eres un asistente experto en control de calidad para una avícola. 
Analiza si hay un posible ERROR DE DIGITACIÓN en el siguiente pesaje:

PRODUCTO: ${datos.productoNombre}
PESO SOLICITADO: ${datos.pesoSolicitado} ${datos.unidad}
PESO INGRESADO: ${datos.pesoIngresado} ${datos.unidad}

Considera estos tipos de errores comunes:
1. Dígito duplicado por error (ej: 1 kg → 11 kg, 5 kg → 55 kg)
2. Dígito extra por error (ej: 1 kg → 13 kg, 2 kg → 25 kg)
3. Orden de magnitud incorrecto (ej: 1.5 kg → 15 kg)
4. Tecla equivocada (ej: 1 kg → 4 kg en teclado numérico)

Responde ÚNICAMENTE con un JSON válido en este formato exacto:
{
  "esAnomalo": true/false,
  "confianza": número del 0 al 100,
  "razon": "explicación breve del análisis",
  "sugerencia": "peso correcto sugerido o null si parece correcto"
}

IMPORTANTE: 
- Si la diferencia es menor al 20%, probablemente es variación normal de pesaje
- Si hay patrón claro de error de digitación (dígito extra, duplicado), esAnomalo = true
- Si el peso ingresado tiene más dígitos que el solicitado, es muy sospechoso`

        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text()

        // Extraer JSON de la respuesta
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
            throw new Error('No se pudo extraer JSON de la respuesta')
        }

        const parsed = JSON.parse(jsonMatch[0]) as AnalisisPesoAnomalo
        return parsed

    } catch (error) {
        console.error('[Gemini] Error analizando peso:', error)

        // Fallback a lógica local simple si Gemini falla
        return fallbackAnalisisLocal(datos)
    }
}

/**
 * Análisis local de fallback si Gemini no está disponible
 */
function fallbackAnalisisLocal(datos: DatosPesaje): AnalisisPesoAnomalo {
    const { pesoSolicitado, pesoIngresado } = datos

    // Contar dígitos en parte entera
    const digitosIngresado = Math.floor(pesoIngresado) === 0 ? 1 :
        Math.floor(Math.log10(Math.abs(Math.floor(pesoIngresado)))) + 1
    const digitosSolicitado = Math.floor(pesoSolicitado) === 0 ? 1 :
        Math.floor(Math.log10(Math.abs(Math.floor(pesoSolicitado)))) + 1

    // Si tiene más dígitos, es anomalía
    if (digitosIngresado > digitosSolicitado) {
        return {
            esAnomalo: true,
            confianza: 85,
            razon: `El peso ingresado (${pesoIngresado} kg) tiene ${digitosIngresado} dígitos pero lo solicitado tiene ${digitosSolicitado}. Posible error de digitación.`,
            sugerencia: `${pesoIngresado / 10} kg`
        }
    }

    // Si es más del doble y mayor a 5kg
    if (pesoIngresado > pesoSolicitado * 2 && pesoIngresado > 5) {
        return {
            esAnomalo: true,
            confianza: 70,
            razon: `El peso ingresado es significativamente mayor al solicitado (${((pesoIngresado / pesoSolicitado) * 100).toFixed(0)}%)`,
            sugerencia: null
        }
    }

    return {
        esAnomalo: false,
        confianza: 95,
        razon: 'El peso ingresado está dentro del rango esperado',
        sugerencia: null
    }
}
