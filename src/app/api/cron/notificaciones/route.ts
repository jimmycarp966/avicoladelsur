import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  procesarNotificacionesPendientes,
  limpiarNotificacionesAntiguas,
} from '@/lib/services/notificaciones-proactivas'

/**
 * Endpoint para procesar notificaciones proactivas programadas.
 *
 * Este endpoint ahora es disparado por un job de Supabase pg_cron
 * que invoca la URL de producción usando un secret almacenado en la base.
 */

const CRON_JOB_NAME = 'cron_notificaciones_proactivas'

async function autorizarCronRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const envSecret = process.env.CRON_SECRET?.trim()

  if (process.env.NODE_ENV !== 'production' && !authHeader && !envSecret) {
    return { autorizado: true as const }
  }

  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null

  if (!token) {
    return {
      autorizado: false as const,
      response: NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      ),
    }
  }

  if (envSecret && token === envSecret) {
    return { autorizado: true as const }
  }

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('fn_validar_cron_secret', {
      p_job_name: CRON_JOB_NAME,
      p_token: token,
    })

    if (error) {
      console.error('[Cron Notificaciones] Error validando secret:', error)
    }

    if (data === true) {
      return { autorizado: true as const }
    }
  } catch (error) {
    console.error('[Cron Notificaciones] Error consultando secret en Supabase:', error)
  }

  return {
    autorizado: false as const,
    response: NextResponse.json(
      { success: false, error: 'No autorizado' },
      { status: 401 }
    ),
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await autorizarCronRequest(request)
    if (!auth.autorizado) {
      return auth.response
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const cleanup = searchParams.get('cleanup') === 'true'

    console.log('[Cron Notificaciones] Ejecutando...', {
      limit,
      cleanup,
      timestamp: new Date().toISOString(),
    })

    const resultado = cleanup
      ? await limpiarNotificacionesAntiguas(90)
      : await procesarNotificacionesPendientes(limit)

    console.log('[Cron Notificaciones] Resultado:', resultado)

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

export async function POST(request: NextRequest) {
  try {
    const auth = await autorizarCronRequest(request)
    if (!auth.autorizado) {
      return auth.response
    }

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
