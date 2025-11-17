'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type {
  ApiResponse,
  CrearCajaParams,
  MovimientoCajaParams,
  RegistrarPagoPedidoParams,
} from '@/types/api.types'

interface MovimientoFilters {
  cajaId?: string
  fechaDesde?: string
  fechaHasta?: string
  tipo?: 'ingreso' | 'egreso'
}

export async function crearCaja(data: CrearCajaParams): Promise<ApiResponse<{ cajaId: string }>> {
  try {
    const supabase = await createClient()

    const { data: nuevaCaja, error } = await supabase
      .from('tesoreria_cajas')
      .insert({
        nombre: data.nombre,
        saldo_inicial: data.saldo_inicial ?? 0,
        saldo_actual: data.saldo_inicial ?? 0,
        moneda: data.moneda ?? 'ARS',
        sucursal_id: data.sucursal_id ?? null,
      })
      .select()
      .single()

    if (error) throw error

    revalidatePath('/(admin)/(dominios)/tesoreria/cajas')

    return {
      success: true,
      data: { cajaId: nuevaCaja.id },
      message: 'Caja creada correctamente',
    }
  } catch (error: any) {
    console.error('crearCaja', error)
    return {
      success: false,
      error: error.message || 'No se pudo crear la caja',
    }
  }
}

export async function listarCajas(): Promise<ApiResponse<any[]>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('tesoreria_cajas')
      .select('*')
      .order('nombre')

    if (error) throw error

    return {
      success: true,
      data: data ?? [],
    }
  } catch (error: any) {
    console.error('listarCajas', error)
    return {
      success: false,
      error: error.message || 'No se pudieron obtener las cajas',
    }
  }
}

export async function registrarMovimientoCaja(
  movimiento: MovimientoCajaParams
): Promise<ApiResponse<{ movimientoId: string }>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data, error } = await supabase.rpc('fn_crear_movimiento_caja', {
      p_caja_id: movimiento.caja_id,
      p_tipo: movimiento.tipo,
      p_monto: movimiento.monto,
      p_descripcion: movimiento.descripcion,
      p_origen_tipo: movimiento.origen_tipo,
      p_origen_id: movimiento.origen_id,
      p_user_id: user?.id ?? null,
      p_metodo_pago: movimiento.metodo_pago ?? 'efectivo',
    })

    if (error) throw error
    if (!data?.success) {
      throw new Error(data?.error || 'Error al registrar movimiento')
    }

    revalidatePath('/(admin)/(dominios)/tesoreria/movimientos')
    revalidatePath('/(admin)/(dominios)/tesoreria/cajas')

    return {
      success: true,
      data: { movimientoId: data.movimiento_id },
      message: 'Movimiento registrado correctamente',
    }
  } catch (error: any) {
    console.error('registrarMovimientoCaja', error)
    return {
      success: false,
      error: error.message || 'No se pudo registrar el movimiento',
    }
  }
}

export async function obtenerMovimientosCaja(
  filtros: MovimientoFilters = {}
): Promise<ApiResponse<any[]>> {
  try {
    const supabase = await createClient()
    let query = supabase
      .from('tesoreria_movimientos')
      .select(
        `
        id,
        caja_id,
        tipo,
        monto,
        descripcion,
        metodo_pago,
        origen_tipo,
        origen_id,
        created_at,
        tesoreria_cajas (nombre)
      `
      )
      .order('created_at', { ascending: false })

    if (filtros.cajaId) {
      query = query.eq('caja_id', filtros.cajaId)
    }

    if (filtros.tipo) {
      query = query.eq('tipo', filtros.tipo)
    }

    if (filtros.fechaDesde) {
      query = query.gte('created_at', filtros.fechaDesde)
    }

    if (filtros.fechaHasta) {
      query = query.lte('created_at', filtros.fechaHasta)
    }

    const { data, error } = await query
    if (error) throw error

    return {
      success: true,
      data: data ?? [],
    }
  } catch (error: any) {
    console.error('obtenerMovimientosCaja', error)
    return {
      success: false,
      error: error.message || 'No se pudieron obtener los movimientos',
    }
  }
}

export async function registrarPagoPedido(
  params: RegistrarPagoPedidoParams
): Promise<ApiResponse<{ pagoEstado: string }>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data, error } = await supabase.rpc('fn_crear_pago_pedido', {
      p_pedido_id: params.pedido_id,
      p_caja_id: params.caja_id,
      p_monto: params.monto,
      p_tipo_pago: params.tipo_pago ?? 'efectivo',
      p_user_id: user?.id ?? null,
    })

    if (error) throw error
    if (!data?.success) {
      throw new Error(data?.error || 'Error al registrar pago')
    }

    revalidatePath('/(admin)/(dominios)/ventas/pedidos')
    revalidatePath(`/(admin)/(dominios)/ventas/pedidos/${params.pedido_id}`)

    return {
      success: true,
      data: { pagoEstado: data.pago_estado },
      message: 'Pago registrado correctamente',
    }
  } catch (error: any) {
    console.error('registrarPagoPedido', error)
    return {
      success: false,
      error: error.message || 'No se pudo registrar el pago del pedido',
    }
  }
}

export async function obtenerResumenTesoreria(): Promise<
  ApiResponse<{
    cajas: number
    saldo_total: number
    ingresos_hoy: number
    egresos_hoy: number
  }>
> {
  try {
    const supabase = await createClient()

    const [{ data: cajas }, { data: movimientos }] = await Promise.all([
      supabase.from('tesoreria_cajas').select('id, saldo_actual'),
      supabase
        .from('tesoreria_movimientos')
        .select('tipo, monto, created_at')
        .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    ])

    const saldoTotal = cajas?.reduce((acc, caja) => acc + Number(caja.saldo_actual || 0), 0) ?? 0
    const ingresosHoy =
      movimientos?.filter((m) => m.tipo === 'ingreso').reduce((sum, m) => sum + Number(m.monto), 0) ?? 0
    const egresosHoy =
      movimientos?.filter((m) => m.tipo === 'egreso').reduce((sum, m) => sum + Number(m.monto), 0) ?? 0

    return {
      success: true,
      data: {
        cajas: cajas?.length ?? 0,
        saldo_total: saldoTotal,
        ingresos_hoy: ingresosHoy,
        egresos_hoy: egresosHoy,
      },
    }
  } catch (error: any) {
    console.error('obtenerResumenTesoreria', error)
    return {
      success: false,
      error: error.message || 'No se pudo obtener el resumen de tesorería',
    }
  }
}

