import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { registrarRetiroTesoroAction, registrarDepositoBancarioAction, validarTransferenciaBNAAction } from '@/actions/tesoreria.actions'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { success: false, message: 'Usuario no autenticado' },
        { status: 401 }
      )
    }

    // Verificar permisos
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'vendedor'].includes(usuario.rol)) {
      return NextResponse.json(
        { success: false, message: 'No tienes permisos para ver tesoro' },
        { status: 403 }
      )
    }

    // Obtener parámetros de consulta
    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo')
    const fecha_desde = searchParams.get('fecha_desde')
    const fecha_hasta = searchParams.get('fecha_hasta')

    let query = supabase
      .from('tesoro')
      .select('*')
      .order('created_at', { ascending: false })

    if (tipo) {
      query = query.eq('tipo', tipo)
    }

    if (fecha_desde) {
      query = query.gte('created_at', fecha_desde)
    }

    if (fecha_hasta) {
      query = query.lte('created_at', fecha_hasta)
    }

    const { data: movimientos, error } = await query

    if (error) throw error

    // Calcular saldo por tipo
    const saldosPorTipo = {
      efectivo: 0,
      transferencia: 0,
      qr: 0,
      tarjeta: 0,
    }

    movimientos?.forEach((mov: any) => {
      if (mov.tipo in saldosPorTipo) {
        saldosPorTipo[mov.tipo as keyof typeof saldosPorTipo] += mov.monto
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        movimientos: movimientos || [],
        saldos_por_tipo: saldosPorTipo,
        total_movimientos: movimientos?.length || 0,
      },
    })

  } catch (error: any) {
    console.error('Error en GET /api/tesoreria/tesoro:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error al obtener tesoro',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const action = body.action // 'retiro' o 'deposito'

    if (action === 'retiro') {
      const formData = new FormData()
      formData.append('tipo', body.tipo)
      formData.append('monto', body.monto.toString())
      if (body.descripcion) {
        formData.append('descripcion', body.descripcion)
      }

      const result = await registrarRetiroTesoroAction(formData)

      if (!result.success) {
        return NextResponse.json(
          { success: false, message: result.message },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        message: result.message,
      })
    }

    if (action === 'deposito') {
      const formData = new FormData()
      formData.append('monto', body.monto.toString())
      formData.append('numero_transaccion', body.numero_transaccion)

      const result = await registrarDepositoBancarioAction(formData)

      if (!result.success) {
        return NextResponse.json(
          { success: false, message: result.message },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        message: result.message,
      })
    }

    return NextResponse.json(
      { success: false, message: 'Acción no válida. Debe ser "retiro" o "deposito"' },
      { status: 400 }
    )

  } catch (error: any) {
    console.error('Error en POST /api/tesoreria/tesoro:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}

// Endpoint para validar número de transacción BNA
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const numero_transaccion = body.numero_transaccion

    if (!numero_transaccion) {
      return NextResponse.json(
        { success: false, message: 'Número de transacción requerido' },
        { status: 400 }
      )
    }

    const result = await validarTransferenciaBNAAction(numero_transaccion)

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('Error en PUT /api/tesoreria/tesoro:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error al validar transferencia',
      },
      { status: 500 }
    )
  }
}

