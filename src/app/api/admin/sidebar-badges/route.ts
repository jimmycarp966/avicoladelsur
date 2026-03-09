import { NextResponse } from 'next/server'

import { obtenerMensajesHoyAction } from '@/actions/bot-mensajes.actions'

export async function GET() {
  const result = await obtenerMensajesHoyAction()

  return NextResponse.json({
    notificaciones_unread: 0,
    sucursales_alerts: 0,
    bot_mensajes_hoy: result.data || 0,
  })
}
