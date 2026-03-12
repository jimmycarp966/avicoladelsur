import { NextRequest, NextResponse } from 'next/server'
import { ejecutarLiquidacionAutomatica } from '@/lib/services/rrhh-liquidaciones-automaticas'

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) return false
  return authHeader === `Bearer ${cronSecret}`
}

function getArgentinaYearMonth(baseDate = new Date()): { mes: number; anio: number } {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
  }).format(baseDate)

  const [anioRaw, mesRaw] = formatted.split('-')
  const anio = Number(anioRaw)
  const mes = Number(mesRaw)

  if (!Number.isInteger(anio) || !Number.isInteger(mes)) {
    return {
      anio: baseDate.getUTCFullYear(),
      mes: baseDate.getUTCMonth() + 1,
    }
  }

  return { anio, mes }
}

async function runCron(request: NextRequest) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json({ success: false, error: 'CRON_SECRET no configurado' }, { status: 500 })
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
  }

  const periodo = getArgentinaYearMonth()

  const result = await ejecutarLiquidacionAutomatica({
    source: 'cron',
    mes: periodo.mes,
    anio: periodo.anio,
    forceRun: true,
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
    console.error('[RRHH AUTO LIQ CURSO] Error en endpoint cron:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno ejecutando liquidacion en curso',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
