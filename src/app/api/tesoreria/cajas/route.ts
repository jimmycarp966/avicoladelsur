import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { crearCajaAction, listarCajasAction } from '@/actions/tesoreria.actions'
import { crearCajaSchema } from '@/lib/schemas/tesoreria.schema'

export async function GET() {
  const result = await listarCajasAction()
  return NextResponse.json(result, { status: 200 })
}

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const parsed = crearCajaSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.message,
        },
        { status: 400 }
      )
    }

    const result = await crearCajaAction(parsed.data)
    return NextResponse.json(result, { status: result.success ? 201 : 400 })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error al crear caja',
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const payload = await request.json()
    const { id, ...updates } = payload

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'El campo id es obligatorio' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('tesoreria_cajas')
      .update({
        nombre: updates.nombre,
        moneda: updates.moneda,
        saldo_actual: updates.saldo_actual,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'Caja actualizada' })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error al actualizar caja' },
      { status: 500 }
    )
  }
}

