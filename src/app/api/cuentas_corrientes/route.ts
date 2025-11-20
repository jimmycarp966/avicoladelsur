import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { registrarPagoPedido } from '@/actions/tesoreria.actions'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  try {
    const supabase = await createClient()
    let query = supabase
      .from('cuentas_corrientes')
      .select(
        `
        id,
        saldo,
        limite_credito,
        updated_at,
        clientes (
          id,
          nombre,
          bloqueado_por_deuda
        )
      `
      )
      .order('updated_at', { ascending: false })

    if (searchParams.get('clienteId')) {
      query = query.eq('cliente_id', searchParams.get('clienteId'))
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ success: true, data }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener cuentas corrientes' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    if (payload.action === 'registrarPago') {
      const result = await registrarPagoPedido({
        pedido_id: payload.pedido_id,
        caja_id: payload.caja_id,
        monto: payload.monto,
        metodo_pago: payload.metodo_pago || payload.tipo_pago,
      })
      return NextResponse.json(result, { status: result.success ? 200 : 400 })
    }

    return NextResponse.json(
      { success: false, error: 'Acción no soportada' },
      { status: 400 }
    )
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Error al procesar la solicitud' },
      { status: 500 }
    )
  }
}

