/**
 * GET /api/predictions/demand
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { predecirDemandaProducto } from '@/lib/services/predictions/demand-predictor'
import { createAIMetadata } from '@/lib/ai/metadata'
import { logAIUsage } from '@/lib/ai/logger'
import type { AIMetadata } from '@/types/ai.types'

interface DemandResponse {
  success: boolean
  data?: any
  error?: string
  ai: AIMetadata
}

export async function GET(request: NextRequest) {
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

      return NextResponse.json<DemandResponse>({ success: false, error: 'No autenticado', ai }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const productoId = searchParams.get('productoId')
    const diasFuturos = parseInt(searchParams.get('diasFuturos') || '7', 10)

    if (!productoId) {
      const ai = createAIMetadata({
        strategy: 'assisted',
        used: false,
        provider: 'none',
        model: null,
        fallbackUsed: false,
        reason: 'productoId es requerido.',
        startedAt,
      })

      return NextResponse.json<DemandResponse>({ success: false, error: 'productoId es requerido', ai }, { status: 400 })
    }

    const prediccion = await predecirDemandaProducto(supabase, productoId, diasFuturos)

    if (!prediccion) {
      const ai = createAIMetadata({
        strategy: 'assisted',
        used: false,
        provider: 'none',
        model: null,
        fallbackUsed: false,
        reason: 'No se pudo generar prediccion por falta de historial.',
        startedAt,
      })

      return NextResponse.json<DemandResponse>(
        {
          success: false,
          error: 'No se pudo generar prediccion. Insuficientes datos historicos.',
          ai,
        },
        { status: 404 }
      )
    }

    const ai = createAIMetadata({
      strategy: 'assisted',
      used: prediccion.aiUsed,
      provider: prediccion.aiUsed ? 'vertex' : 'none',
      model: prediccion.modeloUsado,
      fallbackUsed: prediccion.aiFallbackUsed,
      reason: prediccion.aiReason,
      startedAt,
    })

    logAIUsage({ endpoint: '/api/predictions/demand', feature: 'predictions_demand', success: true, ai })

    return NextResponse.json<DemandResponse>({ success: true, data: prediccion, ai })
  } catch (error: any) {
    console.error('Error al obtener prediccion de demanda:', error)

    const ai = createAIMetadata({
      strategy: 'assisted',
      used: false,
      provider: 'none',
      model: null,
      fallbackUsed: false,
      reason: 'Error no controlado en prediccion de demanda.',
      startedAt,
    })

    logAIUsage({
      endpoint: '/api/predictions/demand',
      feature: 'predictions_demand',
      success: false,
      ai,
      error: error.message || 'unknown',
    })

    return NextResponse.json<DemandResponse>(
      { success: false, error: error.message || 'Error al obtener prediccion', ai },
      { status: 500 }
    )
  }
}
