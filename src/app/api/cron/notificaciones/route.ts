import { NextRequest, NextResponse } from 'next/server'
import { procesarNotificacionesPendientes, limpiarNotificacionesAntiguas } from '@/lib/services/notificaciones-proactivas'

/**
 * Endpoint para procesar notificaciones proactivas programadas
 *
 * Este endpoint se ejecuta periódicamente (ej: cada 5 minutos) vía cron jobs
 * para enviar notificaciones pendientes por WhatsApp (Twilio)
 *
 * Uso:
 * - GET /api/cron/notificaciones - Procesa pendientes (hasta 50)
 * - GET /api/cron/notificaciones?limit=100 - Procesa con límite específico
 * - GET /api/cron/notificaciones?cleanup=true - Limpia notificaciones antiguas (>90 días)
 */

export async function GET(request: NextRequest) {
  try {
    // Verificar authentication para ejecutar cron jobs
    // En producción, verificar un token secreto en headers
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'your-secret-token'

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const cleanup = searchParams.get('cleanup') === 'true'

    console.log('[Cron Notificaciones] Ejecutando...', {
      limit,
      cleanup,
      timestamp: new Date().toISOString(),
    })

    let resultado

    if (cleanup) {
      // Ejecutar limpieza de notificaciones antiguas
      resultado = await limpiarNotificacionesAntiguas(90)

      console.log('[Cron Notificaciones] Limpieza completada:', resultado)
    } else {
      // Procesar notificaciones pendientes
      resultado = await procesarNotificacionesPendientes(limit)

      console.log('[Cron Notificaciones] Procesamiento completado:', resultado)
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...resultado,
    })
  } catch (error: any) {
    console.error('[Cron Notificaciones] Error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error procesando notificaciones',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

/**
 * Endpoint POST para testing manual
 * Permite probar el procesamiento de notificaciones sin esperar al cron
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const limit = body.limit || 10

    console.log('[Cron Notificaciones] Test manual...', { limit })

    const resultado = await procesarNotificacionesPendientes(limit)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...resultado,
    })
  } catch (error: any) {
    console.error('[Cron Notificaciones] Error en test manual:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error procesando notificaciones',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
