/**
 * GET /api/predictions/alerts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { obtenerAlertasStockActivas } from '@/lib/services/predictions/stock-alert'
import { createAIMetadata } from '@/lib/ai/metadata'
import { logAIUsage } from '@/lib/ai/logger'
import type { AIMetadata } from '@/types/ai.types'

interface AlertsResponse {
  success: boolean
  data?: any[]
  error?: string
  ai: AIMetadata
}

export async function GET(_request: NextRequest) {
  const startedAt = Date.now()

  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      const ai = createAIMetadata({
        strategy: 'none',
        used: false,
        provider: 'none',
        model: null,
        fallbackUsed: false,
        reason: 'No autenticado.',
        startedAt,
      })

      return NextResponse.json<AlertsResponse>({ success: false, error: 'No autenticado', ai }, { status: 401 })
    }

    const alertas = await obtenerAlertasStockActivas(supabase)

    const ai = createAIMetadata({
      strategy: 'none',
      used: false,
      provider: 'none',
      model: null,
      fallbackUsed: false,
      reason: 'Endpoint de lectura. No ejecuta inferencia IA en tiempo real.',
      startedAt,
    })

    logAIUsage({ endpoint: '/api/predictions/alerts', feature: 'predictions_alerts', success: true, ai })

    return NextResponse.json<AlertsResponse>({ success: true, data: alertas, ai })
  } catch (error: any) {
    console.error('Error al obtener alertas de stock:', error)

    const ai = createAIMetadata({
      strategy: 'none',
      used: false,
      provider: 'none',
      model: null,
      fallbackUsed: false,
      reason: 'Error no controlado al obtener alertas.',
      startedAt,
    })

    logAIUsage({
      endpoint: '/api/predictions/alerts',
      feature: 'predictions_alerts',
      success: false,
      ai,
      error: error.message || 'unknown',
    })

    return NextResponse.json<AlertsResponse>(
      { success: false, error: error.message || 'Error al obtener alertas', ai },
      { status: 500 }
    )
  }
}
