import { NextResponse } from 'next/server'
import { movimientoCajaSchema } from '@/lib/schemas/tesoreria.schema'
import { obtenerMovimientosCaja, registrarMovimientoCaja } from '@/actions/tesoreria.actions'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const result = await obtenerMovimientosCaja({
    cajaId: searchParams.get('cajaId') || undefined,
    tipo: (searchParams.get('tipo') as 'ingreso' | 'egreso') || undefined,
    fechaDesde: searchParams.get('desde') || undefined,
    fechaHasta: searchParams.get('hasta') || undefined,
  })

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

    const result = await registrarMovimientoCaja(parsed.data)
    return NextResponse.json(result, { status: result.success ? 201 : 400 })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error al registrar movimiento' },
      { status: 500 }
    )
  }
}

