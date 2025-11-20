import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { crearCierreCajaAction, cerrarCierreCajaAction } from '@/actions/tesoreria.actions'

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
        { success: false, message: 'No tienes permisos para ver cierres de caja' },
        { status: 403 }
      )
    }

    // Obtener parámetros de consulta
    const { searchParams } = new URL(request.url)
    const caja_id = searchParams.get('caja_id')
    const fecha = searchParams.get('fecha')
    const estado = searchParams.get('estado')

    let query = supabase
      .from('cierres_caja')
      .select(`
        *,
        caja:tesoreria_cajas(nombre, moneda)
      `)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })

    if (caja_id) {
      query = query.eq('caja_id', caja_id)
    }

    if (fecha) {
      query = query.eq('fecha', fecha)
    }

    if (estado) {
      query = query.eq('estado', estado)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: data || [],
    })

  } catch (error: any) {
    console.error('Error en GET /api/tesoreria/cierre-caja:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error al obtener cierres de caja',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const action = body.action // 'crear' o 'cerrar'

    if (action === 'crear') {
      const formData = new FormData()
      formData.append('caja_id', body.caja_id)
      formData.append('fecha', body.fecha)

      const result = await crearCierreCajaAction(formData)

      if (!result.success) {
        return NextResponse.json(
          { success: false, message: result.message },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        message: result.message,
        data: result.data,
      })
    }

    if (action === 'cerrar') {
      const formData = new FormData()
      formData.append('cierre_id', body.cierre_id)
      formData.append('saldo_final', body.saldo_final.toString())
      formData.append('total_ingresos', body.total_ingresos.toString())
      formData.append('total_egresos', body.total_egresos.toString())
      formData.append('cobranzas_cuenta_corriente', body.cobranzas_cuenta_corriente.toString())
      formData.append('gastos', body.gastos.toString())
      formData.append('retiro_tesoro', body.retiro_tesoro.toString())

      const result = await cerrarCierreCajaAction(formData)

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
      { success: false, message: 'Acción no válida. Debe ser "crear" o "cerrar"' },
      { status: 400 }
    )

  } catch (error: any) {
    console.error('Error en POST /api/tesoreria/cierre-caja:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}

