/**
 * POST /api/reportes/ia/chat
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { responderPregunta } from '@/lib/services/google-cloud/gemini'
import { createAIMetadata } from '@/lib/ai/metadata'
import { logAIUsage } from '@/lib/ai/logger'
import { getGeminiModelName } from '@/lib/ai/runtime'
import type { AIMetadata } from '@/types/ai.types'

interface ChatReporteResponse {
  success: boolean
  data?: {
    respuesta: string
    pregunta: string
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
        strategy: 'primary',
        used: false,
        provider: 'none',
        model: null,
        fallbackUsed: false,
        reason: 'No autenticado.',
        startedAt,
      })

      return NextResponse.json<ChatReporteResponse>({ success: false, error: 'No autenticado', ai }, { status: 401 })
    }

    const body = await request.json()
    const { pregunta } = body as { pregunta: string }

    if (!pregunta) {
      const ai = createAIMetadata({
        strategy: 'primary',
        used: false,
        provider: 'none',
        model: null,
        fallbackUsed: false,
        reason: 'Pregunta requerida.',
        startedAt,
      })

      return NextResponse.json<ChatReporteResponse>({ success: false, error: 'pregunta es requerida', ai }, { status: 400 })
    }

    const fechaInicio = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const { data: pedidos } = await supabase
      .from('pedidos')
      .select('total, estado, created_at')
      .eq('estado', 'completado')
      .gte('created_at', `${fechaInicio}T00:00:00.000Z`)

    const ventas = pedidos?.reduce((sum, p) => sum + (Number(p.total) || 0), 0) || 0
    const totalPedidos = pedidos?.length || 0

    const datosContexto = {
      ventasUltimos30Dias: ventas,
      pedidosUltimos30Dias: totalPedidos,
      fechaInicio,
      fechaFin: new Date().toISOString().split('T')[0],
    }

    const respuesta = await responderPregunta(pregunta, datosContexto)

    if (!respuesta.success || !respuesta.text) {
      const ai = createAIMetadata({
        strategy: 'primary',
        used: false,
        provider: 'none',
        model: null,
        fallbackUsed: false,
        reason: respuesta.error || 'No se pudo generar respuesta con Gemini.',
        startedAt,
      })

      logAIUsage({ endpoint: '/api/reportes/ia/chat', feature: 'reportes_ia_chat', success: false, ai, error: respuesta.error })

      return NextResponse.json<ChatReporteResponse>(
        { success: false, error: respuesta.error || 'Error al generar respuesta', ai },
        { status: 500 }
      )
    }

    const ai = createAIMetadata({
      strategy: 'primary',
      used: true,
      provider: 'gemini',
      model: getGeminiModelName(),
      fallbackUsed: false,
      reason: 'Respuesta de analisis generada por Gemini.',
      startedAt,
    })

    logAIUsage({ endpoint: '/api/reportes/ia/chat', feature: 'reportes_ia_chat', success: true, ai })

    return NextResponse.json<ChatReporteResponse>({
      success: true,
      data: {
        respuesta: respuesta.text,
        pregunta,
      },
      ai,
    })
  } catch (error: any) {
    console.error('Error al procesar pregunta:', error)

    const ai = createAIMetadata({
      strategy: 'primary',
      used: false,
      provider: 'none',
      model: null,
      fallbackUsed: false,
      reason: 'Error no controlado al responder pregunta de reportes IA.',
      startedAt,
    })

    logAIUsage({
      endpoint: '/api/reportes/ia/chat',
      feature: 'reportes_ia_chat',
      success: false,
      ai,
      error: error.message || 'unknown',
    })

    return NextResponse.json<ChatReporteResponse>(
      { success: false, error: error.message || 'Error al procesar pregunta', ai },
      { status: 500 }
    )
  }
}
