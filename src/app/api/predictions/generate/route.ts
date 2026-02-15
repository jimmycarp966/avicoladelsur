/**
 * POST /api/predictions/generate
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { predecirDemandaProducto } from '@/lib/services/predictions/demand-predictor'
import { createAIMetadata } from '@/lib/ai/metadata'
import { logAIUsage } from '@/lib/ai/logger'
import type { AIMetadata } from '@/types/ai.types'

interface GeneratePredictionsResponse {
  success: boolean
  data?: {
    prediccionesGeneradas: number
    totalProductos: number
    predicciones: any[]
    errores?: Array<{ productoId: string; error: string }>
  }
  error?: string
  ai: AIMetadata
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()

  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      const ai = createAIMetadata({
        strategy: 'assisted',
        used: false,
        provider: 'none',
        model: null,
        fallbackUsed: false,
        reason: 'No autenticado.',
        startedAt,
      })

      return NextResponse.json<GeneratePredictionsResponse>({ success: false, error: 'No autenticado', ai }, { status: 401 })
    }

    const { data: usuario } = await supabase.from('usuarios').select('rol').eq('id', user.id).single()

    if (!usuario || usuario.rol !== 'admin') {
      const ai = createAIMetadata({
        strategy: 'assisted',
        used: false,
        provider: 'none',
        model: null,
        fallbackUsed: false,
        reason: 'Usuario sin permisos para generar predicciones.',
        startedAt,
      })

      return NextResponse.json<GeneratePredictionsResponse>(
        { success: false, error: 'No tienes permisos para generar predicciones', ai },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { diasFuturos = 7 } = body as { diasFuturos?: number }

    const { data: productos } = await supabase.from('productos').select('id').eq('activo', true)

    if (!productos || productos.length === 0) {
      const ai = createAIMetadata({
        strategy: 'assisted',
        used: false,
        provider: 'none',
        model: null,
        fallbackUsed: false,
        reason: 'No hay productos activos para predecir.',
        startedAt,
      })

      return NextResponse.json<GeneratePredictionsResponse>(
        { success: false, error: 'No hay productos activos', ai },
        { status: 404 }
      )
    }

    const predicciones: any[] = []
    const errores: Array<{ productoId: string; error: string }> = []

    for (const producto of productos) {
      try {
        const prediccion = await predecirDemandaProducto(supabase, producto.id, diasFuturos)
        if (prediccion) {
          await supabase.rpc('fn_registrar_prediccion_demanda', {
            p_producto_id: producto.id,
            p_fecha_prediccion: new Date().toISOString().split('T')[0],
            p_fecha_predicha: new Date(Date.now() + diasFuturos * 24 * 60 * 60 * 1000)
              .toISOString()
              .split('T')[0],
            p_cantidad_predicha: prediccion.cantidadPredicha,
            p_confianza: prediccion.confianza,
            p_tendencia: prediccion.tendencia,
            p_factores: prediccion.factores ? JSON.stringify(prediccion.factores) : null,
            p_modelo_usado: prediccion.modeloUsado,
            p_dias_restantes: prediccion.diasRestantes || null,
          })
          predicciones.push(prediccion)
        }
      } catch (error: any) {
        errores.push({ productoId: producto.id, error: error.message })
      }
    }

    const aiUsed = predicciones.some((p) => p.aiUsed)
    const fallbackUsed = predicciones.some((p) => p.aiFallbackUsed)

    const ai = createAIMetadata({
      strategy: 'assisted',
      used: aiUsed,
      provider: aiUsed ? 'vertex' : 'none',
      model: aiUsed ? 'vertex' : 'statistical',
      fallbackUsed,
      reason: aiUsed
        ? 'Batch generado con combinacion de Vertex y fallback estadistico segun disponibilidad.'
        : 'Batch generado completamente con modelo estadistico.',
      startedAt,
    })

    logAIUsage({ endpoint: '/api/predictions/generate', feature: 'predictions_generate', success: true, ai })

    return NextResponse.json<GeneratePredictionsResponse>({
      success: true,
      data: {
        prediccionesGeneradas: predicciones.length,
        totalProductos: productos.length,
        predicciones,
        errores: errores.length > 0 ? errores : undefined,
      },
      ai,
    })
  } catch (error: any) {
    console.error('Error al generar predicciones:', error)

    const ai = createAIMetadata({
      strategy: 'assisted',
      used: false,
      provider: 'none',
      model: null,
      fallbackUsed: false,
      reason: 'Error no controlado al generar predicciones masivas.',
      startedAt,
    })

    logAIUsage({
      endpoint: '/api/predictions/generate',
      feature: 'predictions_generate',
      success: false,
      ai,
      error: error.message || 'unknown',
    })

    return NextResponse.json<GeneratePredictionsResponse>(
      { success: false, error: error.message || 'Error al generar predicciones', ai },
      { status: 500 }
    )
  }
}
