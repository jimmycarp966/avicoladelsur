/**
 * POST /api/reportes/ia/chat
 * 
 * Endpoint para hacer preguntas al sistema usando Gemini
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { responderPregunta } from '@/lib/services/google-cloud/gemini'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { pregunta } = body as { pregunta: string }

    if (!pregunta) {
      return NextResponse.json(
        { success: false, error: 'pregunta es requerida' },
        { status: 400 }
      )
    }

    // Obtener datos del contexto (últimos 30 días)
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
      fechaFin: new Date().toISOString().split('T')[0]
    }

    // Responder pregunta con Gemini
    const respuesta = await responderPregunta(pregunta, datosContexto)

    if (!respuesta.success || !respuesta.text) {
      return NextResponse.json(
        { success: false, error: respuesta.error || 'Error al generar respuesta' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        respuesta: respuesta.text,
        pregunta
      }
    })
  } catch (error: any) {
    console.error('Error al procesar pregunta:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al procesar pregunta' },
      { status: 500 }
    )
  }
}

