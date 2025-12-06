/**
 * POST /api/bot/dialogflow
 * 
 * Endpoint para procesar mensajes con Dialogflow
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { procesarMensajeDialogflow } from '@/lib/services/bot/dialogflow-handler'

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
    const { clienteId, mensaje, numeroWhatsApp } = body as {
      clienteId: string
      mensaje: string
      numeroWhatsApp: string
    }

    if (!clienteId || !mensaje || !numeroWhatsApp) {
      return NextResponse.json(
        { success: false, error: 'clienteId, mensaje y numeroWhatsApp son requeridos' },
        { status: 400 }
      )
    }

    // Procesar mensaje con Dialogflow
    const botResponse = await procesarMensajeDialogflow(
      supabase,
      clienteId,
      mensaje,
      numeroWhatsApp
    )

    return NextResponse.json({
      success: true,
      data: {
        mensaje: botResponse.mensaje,
        estado: botResponse.estado,
        accion: botResponse.accion,
        datos: botResponse.datos
      }
    })
  } catch (error: any) {
    console.error('Error al procesar mensaje con Dialogflow:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al procesar mensaje' },
      { status: 500 }
    )
  }
}

