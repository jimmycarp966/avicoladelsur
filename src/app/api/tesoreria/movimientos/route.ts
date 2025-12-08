import { NextResponse } from 'next/server'
import { movimientoCajaSchema } from '@/lib/schemas/tesoreria.schema'
import { obtenerMovimientosCajaAction, registrarMovimientoCajaAction } from '@/actions/tesoreria.actions'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cajaId = searchParams.get('cajaId') || undefined
  const fecha = searchParams.get('fecha') || undefined
  const result = await obtenerMovimientosCajaAction(cajaId, fecha)

  return NextResponse.json(result, { status: result.success ? 200 : 400 })
}

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const parsed = movimientoCajaSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.message },
        { status: 400 }
      )
    }

    const result = await registrarMovimientoCajaAction(parsed.data)
    return NextResponse.json(result, { status: result.success ? 201 : 400 })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error al registrar movimiento' },
      { status: 500 }
    )
  }
}

