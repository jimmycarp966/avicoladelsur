/**
 * POST /api/ia/clasificar-gasto
 * Endpoint legacy (deprecado): mantiene compatibilidad.
 */

import { NextRequest, NextResponse } from 'next/server'
import { GEMINI_MODEL_FLASH } from '@/lib/constants/gemini-models'
import { createAIMetadata } from '@/lib/ai/metadata'
import { logAIUsage } from '@/lib/ai/logger'
import { getGeminiModel } from '@/lib/ai/runtime'
import type { AIMetadata } from '@/types/ai.types'

interface ClasificacionRequest {
  descripcion: string
}

interface ClasificacionResponse {
  success: boolean
  categoria?: string
  confianza?: number
  razon?: string
  error?: string
  usandoIA?: boolean
  ai: AIMetadata
}

const LEGACY_DEPRECATED_MESSAGE =
  'Endpoint legacy. Migrar a /api/tesoreria/clasificar-gasto para semantica de dominio.'

const CATEGORIAS_GASTOS = [
  'Combustible',
  'Mantenimiento vehículos',
  'Servicios (luz, gas, agua)',
  'Sueldos y jornales',
  'Impuestos y tasas',
  'Alquileres',
  'Insumos de oficina',
  'Insumos de producción',
  'Limpieza',
  'Seguridad',
  'Seguros',
  'Fletes y envíos',
  'Publicidad y marketing',
  'Telefonía e internet',
  'Gastos bancarios',
  'Honorarios profesionales',
  'Reparaciones',
  'Materiales de empaque',
  'Varios',
]

function clasificarLocal(descripcion: string, startedAt: number, reason: string): ClasificacionResponse {
  const desc = descripcion.toLowerCase()

  const reglas: { palabras: string[]; categoria: string }[] = [
    { palabras: ['nafta', 'combustible', 'ypf', 'shell', 'axion', 'gnc', 'gasoil'], categoria: 'Combustible' },
    { palabras: ['taller', 'gomeria', 'mecanico', 'repuesto', 'aceite', 'freno'], categoria: 'Mantenimiento vehículos' },
    { palabras: ['luz', 'edenor', 'edesur', 'gas', 'metrogas', 'agua', 'aysa'], categoria: 'Servicios (luz, gas, agua)' },
    { palabras: ['sueldo', 'jornal', 'aguinaldo', 'vacaciones', 'empleado'], categoria: 'Sueldos y jornales' },
    { palabras: ['impuesto', 'ingresos brutos', 'iva', 'afip', 'arba', 'tasa'], categoria: 'Impuestos y tasas' },
    { palabras: ['alquiler', 'renta', 'arrendamiento'], categoria: 'Alquileres' },
    { palabras: ['resma', 'papel', 'tinta', 'cartuchos', 'oficina', 'escritorio'], categoria: 'Insumos de oficina' },
    { palabras: ['bolsa', 'caja', 'empaque', 'envoltorio', 'packaging'], categoria: 'Materiales de empaque' },
    { palabras: ['limpieza', 'lavandina', 'detergente', 'desinfectante'], categoria: 'Limpieza' },
    { palabras: ['seguro', 'poliza', 'aseguradora'], categoria: 'Seguros' },
    { palabras: ['flete', 'envio', 'transporte', 'correo'], categoria: 'Fletes y envíos' },
    { palabras: ['publicidad', 'marketing', 'facebook', 'instagram', 'google ads'], categoria: 'Publicidad y marketing' },
    { palabras: ['telefono', 'celular', 'internet', 'movistar', 'claro', 'personal'], categoria: 'Telefonía e internet' },
    { palabras: ['banco', 'comision', 'transferencia', 'mantenimiento cuenta'], categoria: 'Gastos bancarios' },
    { palabras: ['contador', 'abogado', 'honorarios', 'profesional'], categoria: 'Honorarios profesionales' },
    { palabras: ['reparacion', 'arreglo', 'service'], categoria: 'Reparaciones' },
  ]

  const matched = reglas.find((regla) => regla.palabras.some((palabra) => desc.includes(palabra)))

  return {
    success: true,
    categoria: matched?.categoria || 'Varios',
    confianza: matched ? 75 : 30,
    razon: matched ? 'Detectado por palabras clave' : 'No se encontro una categoria clara',
    usandoIA: false,
    ai: createAIMetadata({
      strategy: 'assisted',
      used: false,
      provider: 'none',
      model: null,
      fallbackUsed: true,
      reason,
      startedAt,
      deprecated: true,
      deprecatedMessage: LEGACY_DEPRECATED_MESSAGE,
    }),
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<ClasificacionResponse>> {
  const startedAt = Date.now()

  try {
    const body: ClasificacionRequest = await request.json()

    if (!body.descripcion || body.descripcion.trim().length === 0) {
      const ai = createAIMetadata({
        strategy: 'assisted',
        used: false,
        provider: 'none',
        model: null,
        fallbackUsed: false,
        reason: 'Descripcion requerida para clasificar gasto.',
        startedAt,
        deprecated: true,
        deprecatedMessage: LEGACY_DEPRECATED_MESSAGE,
      })

      return NextResponse.json({ success: false, error: 'La descripcion del gasto es requerida', ai })
    }

    const model = getGeminiModel(GEMINI_MODEL_FLASH)
    if (!model) {
      const response = clasificarLocal(body.descripcion, startedAt, 'Gemini no configurado. Se uso clasificacion local.')
      logAIUsage({ endpoint: '/api/ia/clasificar-gasto', feature: 'clasificar_gasto', success: true, ai: response.ai })
      return NextResponse.json(response)
    }

    try {
      const prompt = `Eres un asistente de contabilidad para una empresa avicola argentina.
Debes clasificar el siguiente gasto en UNA de estas categorias:
${CATEGORIAS_GASTOS.map((c) => `- ${c}`).join('\n')}

Gasto a clasificar: "${body.descripcion}"

Responde SOLO en formato JSON con esta estructura:
{
  "categoria": "nombre de la categoria elegida",
  "confianza": numero del 1 al 100 indicando tu nivel de certeza,
  "razon": "breve explicacion de por que elegiste esta categoria"
}

IMPORTANTE: La categoria debe ser EXACTAMENTE una de las listadas arriba.`

      const result = await model.generateContent(prompt)
      const responseText = result.response.text()
      const jsonBlock = responseText.match(/\{[\s\S]*\}/)
      if (!jsonBlock) {
        throw new Error('Gemini no devolvio JSON valido')
      }

      const parsed = JSON.parse(jsonBlock[0])

      if (!CATEGORIAS_GASTOS.includes(parsed.categoria)) {
        const response = clasificarLocal(
          body.descripcion,
          startedAt,
          'Gemini devolvio categoria fuera del catalogo. Se uso fallback local.'
        )
        logAIUsage({ endpoint: '/api/ia/clasificar-gasto', feature: 'clasificar_gasto', success: true, ai: response.ai })
        return NextResponse.json(response)
      }

      const ai = createAIMetadata({
        strategy: 'assisted',
        used: true,
        provider: 'gemini',
        model: GEMINI_MODEL_FLASH,
        fallbackUsed: false,
        reason: 'Clasificacion generada por Gemini.',
        startedAt,
        deprecated: true,
        deprecatedMessage: LEGACY_DEPRECATED_MESSAGE,
      })

      logAIUsage({ endpoint: '/api/ia/clasificar-gasto', feature: 'clasificar_gasto', success: true, ai })

      return NextResponse.json({
        success: true,
        categoria: parsed.categoria,
        confianza: parsed.confianza,
        razon: parsed.razon,
        usandoIA: true,
        ai,
      })
    } catch (iaError) {
      console.error('[IA] Error con Gemini, usando fallback local:', iaError)
      const response = clasificarLocal(body.descripcion, startedAt, 'Error en Gemini. Se uso fallback local.')
      logAIUsage({ endpoint: '/api/ia/clasificar-gasto', feature: 'clasificar_gasto', success: true, ai: response.ai })
      return NextResponse.json(response)
    }
  } catch (error) {
    console.error('[IA] Error en clasificar-gasto:', error)

    const ai = createAIMetadata({
      strategy: 'assisted',
      used: false,
      provider: 'none',
      model: null,
      fallbackUsed: false,
      reason: 'Error no controlado al clasificar gasto.',
      startedAt,
      deprecated: true,
      deprecatedMessage: LEGACY_DEPRECATED_MESSAGE,
    })

    logAIUsage({
      endpoint: '/api/ia/clasificar-gasto',
      feature: 'clasificar_gasto',
      success: false,
      ai,
      error: error instanceof Error ? error.message : 'unknown',
    })

    return NextResponse.json({
      success: false,
      error: 'Error al clasificar el gasto',
      ai,
    })
  }
}
