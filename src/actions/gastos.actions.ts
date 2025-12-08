'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { devError } from '@/lib/utils/logger'
import type { ApiResponse, RegistrarGastoParams } from '@/types/api.types'

interface GastosFilters {
  categoriaId?: string
  fechaDesde?: string
  fechaHasta?: string
  afectaCaja?: boolean
}

export async function listarCategoriasGastoAction(): Promise<ApiResponse<any[]>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.from('gastos_categorias').select('*').order('nombre')
    if (error) throw error
    return { success: true, data: data ?? [] }
  } catch (error: any) {
    devError('listarCategoriasGasto', error)
    return { success: false, error: error.message || 'No se pudieron obtener las categorías' }
  }
}

export async function crearCategoriaGastoAction(nombre: string, descripcion?: string): Promise<ApiResponse> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('gastos_categorias').insert({
      nombre,
      descripcion,
    })
    if (error) throw error

    revalidatePath('/(admin)/(dominios)/gastos')

    return {
      success: true,
      message: 'Categoría creada correctamente',
    }
  } catch (error: any) {
    devError('crearCategoriaGasto', error)
    return { success: false, error: error.message || 'No se pudo crear la categoría' }
  }
}

export async function registrarGastoAction(data: RegistrarGastoParams): Promise<ApiResponse<{ gastoId: string }>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data: response, error } = await supabase.rpc('fn_registrar_gasto', {
      p_sucursal_id: data.sucursal_id ?? null,
      p_categoria_id: data.categoria_id ?? null,
      p_monto: data.monto,
      p_comprobante_url: data.comprobante_url ?? null,
      p_descripcion: data.descripcion ?? null,
      p_fecha: data.fecha ?? null,
      p_creado_por: user?.id ?? null,
      p_afectar_caja: data.afecta_caja ?? false,
      p_caja_id: data.caja_id ?? null,
      p_metodo_pago: data.metodo_pago ?? 'efectivo',
    })

    if (error) throw error
    if (!response?.success) {
      throw new Error(response?.error || 'Error al registrar gasto')
    }

    revalidatePath('/(admin)/(dominios)/gastos')
    revalidatePath('/(admin)/(dominios)/tesoreria/movimientos')
    revalidatePath('/(admin)/(dominios)/tesoreria/tesoro')

    return {
      success: true,
      data: { gastoId: response.gasto_id },
      message: 'Gasto registrado correctamente',
    }
  } catch (error: any) {
    devError('registrarGasto', error)
    return { success: false, error: error.message || 'No se pudo registrar el gasto' }
  }
}

export async function listarGastosAction(filtros: GastosFilters = {}): Promise<ApiResponse<any[]>> {
  try {
    const supabase = await createClient()
    let query = supabase
      .from('gastos')
      .select(
        `
        id,
        monto,
        descripcion,
        fecha,
        afecta_caja,
        caja_movimiento_id,
        gastos_categorias (nombre),
        tesoreria_cajas (nombre)
      `
      )
      .order('fecha', { ascending: false })

    if (filtros.categoriaId) {
      query = query.eq('categoria_id', filtros.categoriaId)
    }

    if (filtros.afectaCaja !== undefined) {
      query = query.eq('afecta_caja', filtros.afectaCaja)
    }

    if (filtros.fechaDesde) {
      query = query.gte('fecha', filtros.fechaDesde)
    }

    if (filtros.fechaHasta) {
      query = query.lte('fecha', filtros.fechaHasta)
    }

    const { data, error } = await query
    if (error) throw error

    return {
      success: true,
      data: data ?? [],
    }
  } catch (error: any) {
    devError('listarGastos', error)
    return { success: false, error: error.message || 'No se pudieron obtener los gastos' }
  }
}

