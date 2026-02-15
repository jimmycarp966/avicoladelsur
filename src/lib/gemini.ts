/**
 * Cliente de Gemini para analisis de anomalias de pesaje.
 */

import { GEMINI_MODEL_FLASH } from '@/lib/constants/gemini-models'
import { getGeminiModel } from '@/lib/ai/runtime'

export interface AnalisisPesoAnomalo {
  esAnomalo: boolean
  confianza: number
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
 * Analiza si un peso ingresado es anomalo usando Gemini.
 * Si no hay IA disponible, vuelve a logica local.
 */
export async function analizarPesoConIA(datos: DatosPesaje): Promise<AnalisisPesoAnomalo> {
  try {
    const model = getGeminiModel(GEMINI_MODEL_FLASH)
    if (!model) {
      return fallbackAnalisisLocal(datos)
    }

    const prompt = `Eres un asistente experto en control de calidad para una avicola.
Analiza si hay un posible ERROR DE DIGITACION en el siguiente pesaje:

PRODUCTO: ${datos.productoNombre}
PESO SOLICITADO: ${datos.pesoSolicitado} ${datos.unidad}
PESO INGRESADO: ${datos.pesoIngresado} ${datos.unidad}

Considera estos tipos de errores comunes:
1. Digito duplicado por error (ej: 1 kg -> 11 kg, 5 kg -> 55 kg)
2. Digito extra por error (ej: 1 kg -> 13 kg, 2 kg -> 25 kg)
3. Orden de magnitud incorrecto (ej: 1.5 kg -> 15 kg)
4. Tecla equivocada (ej: 1 kg -> 4 kg en teclado numerico)

Responde UNICAMENTE con un JSON valido en este formato exacto:
{
  "esAnomalo": true/false,
  "confianza": numero del 0 al 100,
  "razon": "explicacion breve del analisis",
  "sugerencia": "peso correcto sugerido o null si parece correcto"
}

IMPORTANTE:
- Si la diferencia es menor al 20%, probablemente es variacion normal de pesaje
- Si hay patron claro de error de digitacion (digito extra, duplicado), esAnomalo = true
- Si el peso ingresado tiene mas digitos que el solicitado, es muy sospechoso`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No se pudo extraer JSON de la respuesta')
    }

    return JSON.parse(jsonMatch[0]) as AnalisisPesoAnomalo
  } catch (error) {
    console.error('[Gemini] Error analizando peso:', error)
    return fallbackAnalisisLocal(datos)
  }
}

/**
 * Analisis local de fallback si Gemini no esta disponible.
 */
function fallbackAnalisisLocal(datos: DatosPesaje): AnalisisPesoAnomalo {
  const { pesoSolicitado, pesoIngresado } = datos

  const digitosIngresado =
    Math.floor(pesoIngresado) === 0
      ? 1
      : Math.floor(Math.log10(Math.abs(Math.floor(pesoIngresado)))) + 1

  const digitosSolicitado =
    Math.floor(pesoSolicitado) === 0
      ? 1
      : Math.floor(Math.log10(Math.abs(Math.floor(pesoSolicitado)))) + 1

  if (digitosIngresado > digitosSolicitado) {
    return {
      esAnomalo: true,
      confianza: 85,
      razon: `El peso ingresado (${pesoIngresado} kg) tiene ${digitosIngresado} digitos pero lo solicitado tiene ${digitosSolicitado}. Posible error de digitacion.`,
      sugerencia: `${pesoIngresado / 10} kg`,
    }
  }

  if (pesoIngresado > pesoSolicitado * 2 && pesoIngresado > 5) {
    return {
      esAnomalo: true,
      confianza: 70,
      razon: `El peso ingresado es significativamente mayor al solicitado (${((pesoIngresado / pesoSolicitado) * 100).toFixed(0)}%)`,
      sugerencia: null,
    }
  }

  return {
    esAnomalo: false,
    confianza: 95,
    razon: 'El peso ingresado esta dentro del rango esperado',
    sugerencia: null,
  }
}
