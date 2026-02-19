import { NextRequest, NextResponse } from 'next/server'
import { ejecutarLiquidacionAutomatica } from '@/lib/services/rrhh-liquidaciones-automaticas'

function parsePeriodo(
  searchParams: URLSearchParams,
): { mes?: number; anio?: number; error?: string } {
  const rawMes = searchParams.get('mes')
  const rawAnio = searchParams.get('anio')

  if (!rawMes && !rawAnio) {
    return {}
  }

  if (!rawMes || !rawAnio) {
    return { error: 'Debe enviar mes y anio juntos para override de periodo.' }
  }

  const mes = Number(rawMes)
  const anio = Number(rawAnio)

  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    return { error: 'Mes invalido. Debe ser un entero entre 1 y 12.' }
  }
  if (!Number.isInteger(anio) || anio < 2000) {
    return { error: 'Anio invalido. Debe ser un entero mayor o igual a 2000.' }
  }

  return { mes, anio }
}

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET || 'your-secret-token'
  return authHeader === `Bearer ${cronSecret}`
}

async function runCron(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }

  const parsed = parsePeriodo(request.nextUrl.searchParams)
  if (parsed.error) {
    return NextResponse.json(
      { success: false, error: parsed.error, timestamp: new Date().toISOString() },
      { status: 400 },
    )
  }

  const result = await ejecutarLiquidacionAutomatica({
    source: 'cron',
    mes: parsed.mes,
    anio: parsed.anio,
  })

  const status = result.estado === 'error' ? 500 : 200
  return NextResponse.json(
    {
      success: result.estado !== 'error',
      timestamp: new Date().toISOString(),
      ...result,
    },
    { status },
  )
}

export async function GET(request: NextRequest) {
  try {
    return await runCron(request)
  } catch (error) {
    console.error('[RRHH AUTO LIQ] Error en endpoint cron:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno ejecutando liquidacion automatica',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
