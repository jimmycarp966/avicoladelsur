import { NextResponse } from 'next/server'
import { registrarGastoAction, listarGastosAction } from '@/actions/gastos.actions'
import { registrarGastoSchema } from '@/lib/schemas/tesoreria.schema'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const result = await listarGastosAction({
    categoriaId: searchParams.get('categoriaId') || undefined,
    afectaCaja: searchParams.get('afectaCaja') ? searchParams.get('afectaCaja') === 'true' : undefined,
    fechaDesde: searchParams.get('desde') || undefined,
    fechaHasta: searchParams.get('hasta') || undefined,
  })

  return NextResponse.json(result, { status: result.success ? 200 : 400 })
}

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const parsed = registrarGastoSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.message },
        { status: 400 }
      )
    }

    const result = await registrarGastoAction(parsed.data)
    return NextResponse.json(result, { status: result.success ? 201 : 400 })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error al registrar gasto' },
      { status: 500 }
    )
  }
}

