/**
 * POST /api/ia/prediccion-stock
 * Endpoint legacy (deprecado): mantiene compatibilidad y agrega metadata IA estandar.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GEMINI_MODEL_FLASH } from '@/lib/constants/gemini-models'
import { getGeminiModel } from '@/lib/ai/runtime'
import { createAIMetadata } from '@/lib/ai/metadata'
import { logAIUsage } from '@/lib/ai/logger'
import type { AIMetadata } from '@/types/ai.types'

interface PrediccionRequest {
  productoId?: string
  diasFuturos?: number
}

interface PrediccionProducto {
  productoId: string
  productoNombre: string
  stockActual: number
  demandaPredicha: number
  diasCobertura: number
  alerta: 'critico' | 'bajo' | 'normal' | 'alto'
  confianza: number
  tendencia: 'subiendo' | 'estable' | 'bajando'
  sugerencia: string
}

interface PrediccionResponse {
  success: boolean
  data?: PrediccionProducto[]
  error?: string
  usandoIA?: boolean
  ai: AIMetadata
}

interface GeminiSugerencia {
  productoId: string
  sugerencia: string
}

async function enriquecerSugerenciasConGemini(
  predicciones: PrediccionProducto[]
): Promise<{ updated: PrediccionProducto[]; used: boolean; fallbackUsed: boolean; reason: string }> {
  const model = getGeminiModel(GEMINI_MODEL_FLASH)

  if (!model) {
    return {
      updated: predicciones,
      used: false,
      fallbackUsed: true,
      reason: 'Gemini no configurado. Se mantuvo analisis estadistico.',
    }
  }

  const candidatos = predicciones
    .filter((p) => p.alerta === 'critico' || p.alerta === 'bajo')
    .slice(0, 10)

  if (candidatos.length === 0) {
    return {
      updated: predicciones,
      used: false,
      fallbackUsed: false,
      reason: 'No hubo productos criticos para enriquecer con IA.',
    }
  }

  try {
    const payload = candidatos.map((c) => ({
      productoId: c.productoId,
      productoNombre: c.productoNombre,
      stockActual: c.stockActual,
      demandaPredicha: c.demandaPredicha,
      diasCobertura: c.diasCobertura,
      alerta: c.alerta,
      tendencia: c.tendencia,
    }))

    const prompt = `Eres analista de abastecimiento de una avicola. Recibiras productos con riesgo de stock.
Devuelve SOLO JSON valido con un array de objetos con esta forma:
[
  { "productoId": "id", "sugerencia": "accion concreta, breve" }
]

Productos:
${JSON.stringify(payload, null, 2)}

Reglas:
- Sugerencias accionables, maximo 120 caracteres.
- No inventar ids.
- Responder un item por cada producto recibido.`

    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('Gemini no devolvio lista JSON valida')
    }

    const sugerencias = JSON.parse(jsonMatch[0]) as GeminiSugerencia[]
    const byId = new Map(sugerencias.map((s) => [s.productoId, s.sugerencia]))

    const updated = predicciones.map((p) => ({
      ...p,
      sugerencia: byId.get(p.productoId) || p.sugerencia,
    }))

    return {
      updated,
      used: true,
      fallbackUsed: false,
      reason: 'Gemini enriquecio sugerencias de reabastecimiento.',
    }
  } catch (error) {
    console.error('[IA] Error enriqueciendo prediccion-stock con Gemini:', error)
    return {
      updated: predicciones,
      used: false,
      fallbackUsed: true,
      reason: 'Fallo Gemini; se mantuvieron sugerencias estadisticas.',
    }
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<PrediccionResponse>> {
  const startedAt = Date.now()

  try {
    const body: PrediccionRequest = await request.json()
    const diasFuturos = body.diasFuturos || 7
    const supabase = await createClient()

    const { data: productos, error: productosError } = await supabase
      .from('productos')
      .select(
        `
        id,
        nombre,
        stock_actual,
        stock_minimo,
        unidad_medida,
        lotes (
          id,
          cantidad_actual
        )
      `
      )
      .eq('activo', true)
      .order('nombre')

    if (productosError) throw productosError

    const hace30Dias = new Date()
    hace30Dias.setDate(hace30Dias.getDate() - 30)

    const { data: ventasHistoricas, error: ventasError } = await supabase
      .from('presupuestos_items')
      .select(
        `
        producto_id,
        cantidad,
        presupuesto:presupuestos (
          created_at,
          estado
        )
      `
      )
      .gte('presupuesto.created_at', hace30Dias.toISOString())
      .in('presupuesto.estado', ['entregado', 'facturado', 'preparado'])

    if (ventasError) throw ventasError

    const predicciones: PrediccionProducto[] = []

    for (const producto of productos || []) {
      const stockLotes = (producto.lotes || []).reduce(
        (sum: number, lote: any) => sum + (lote.cantidad_actual || 0),
        0
      )
      const stockTotal = producto.stock_actual || stockLotes

      const ventasProducto = (ventasHistoricas || [])
        .filter((v: any) => v.producto_id === producto.id)
        .reduce((sum: number, v: any) => sum + (v.cantidad || 0), 0)

      const promedioDiario = ventasProducto / 30
      const demandaPredicha = Math.ceil(promedioDiario * diasFuturos)
      const diasCobertura = promedioDiario > 0 ? Math.floor(stockTotal / promedioDiario) : 999

      let alerta: PrediccionProducto['alerta'] = 'normal'
      let sugerencia = ''

      if (diasCobertura < diasFuturos * 0.5) {
        alerta = 'critico'
        sugerencia = `Stock para ${diasCobertura} dias. Reabastecer urgente.`
      } else if (diasCobertura < diasFuturos) {
        alerta = 'bajo'
        sugerencia = `Stock para ${diasCobertura} dias. Considerar reabastecimiento.`
      } else if (diasCobertura > diasFuturos * 3) {
        alerta = 'alto'
        sugerencia = `Stock elevado (${diasCobertura} dias). Reducir proxima compra.`
      } else {
        sugerencia = `Stock adecuado para ${diasCobertura} dias.`
      }

      const hace14Dias = new Date()
      hace14Dias.setDate(hace14Dias.getDate() - 14)

      const ventasUltimos14 = (ventasHistoricas || [])
        .filter(
          (v: any) => v.producto_id === producto.id && new Date(v.presupuesto?.created_at) >= hace14Dias
        )
        .reduce((sum: number, v: any) => sum + (v.cantidad || 0), 0)

      const ventas14a28 = (ventasHistoricas || [])
        .filter(
          (v: any) => v.producto_id === producto.id && new Date(v.presupuesto?.created_at) < hace14Dias
        )
        .reduce((sum: number, v: any) => sum + (v.cantidad || 0), 0)

      let tendencia: PrediccionProducto['tendencia'] = 'estable'
      if (ventas14a28 > 0) {
        const cambio = ((ventasUltimos14 - ventas14a28) / ventas14a28) * 100
        if (cambio > 15) tendencia = 'subiendo'
        else if (cambio < -15) tendencia = 'bajando'
      }

      if (promedioDiario > 0 || alerta === 'critico') {
        predicciones.push({
          productoId: producto.id,
          productoNombre: producto.nombre,
          stockActual: stockTotal,
          demandaPredicha,
          diasCobertura,
          alerta,
          confianza: Math.min(90, 60 + ventasProducto / 10),
          tendencia,
          sugerencia,
        })
      }
    }

    predicciones.sort((a, b) => {
      const alertaOrder = { critico: 0, bajo: 1, normal: 2, alto: 3 }
      return alertaOrder[a.alerta] - alertaOrder[b.alerta]
    })

    const aiEnrichment = await enriquecerSugerenciasConGemini(predicciones)

    const ai = createAIMetadata({
      strategy: 'assisted',
      used: aiEnrichment.used,
      provider: aiEnrichment.used ? 'gemini' : 'none',
      model: aiEnrichment.used ? GEMINI_MODEL_FLASH : null,
      fallbackUsed: aiEnrichment.fallbackUsed,
      reason: aiEnrichment.reason,
      startedAt,
      deprecated: true,
      deprecatedMessage:
        'Endpoint legacy. Migrar a /api/predictions/stock-coverage para semantica mas clara.',
    })

    logAIUsage({ endpoint: '/api/ia/prediccion-stock', feature: 'prediccion_stock', success: true, ai })

    return NextResponse.json({
      success: true,
      data: aiEnrichment.updated.slice(0, 30),
      usandoIA: aiEnrichment.used,
      ai,
    })
  } catch (error) {
    console.error('[IA] Error en prediccion-stock:', error)

    const ai = createAIMetadata({
      strategy: 'assisted',
      used: false,
      provider: 'none',
      model: null,
      fallbackUsed: false,
      reason: 'Error no controlado al calcular prediccion de stock.',
      startedAt,
      deprecated: true,
      deprecatedMessage:
        'Endpoint legacy. Migrar a /api/predictions/stock-coverage para semantica mas clara.',
    })

    logAIUsage({
      endpoint: '/api/ia/prediccion-stock',
      feature: 'prediccion_stock',
      success: false,
      ai,
      error: error instanceof Error ? error.message : 'unknown',
    })

    return NextResponse.json({
      success: false,
      error: 'Error al calcular prediccion de stock',
      ai,
    })
  }
}
