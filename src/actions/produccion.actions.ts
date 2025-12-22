'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type {
    OrdenProduccion,
    OrdenProduccionEntrada,
    OrdenProduccionSalida,
    BalanzaConfig,
    Pesaje,
    FormResponse
} from '@/types/domain.types'

// ===========================================
// ÓRDENES DE PRODUCCIÓN
// ===========================================

/**
 * Obtener lista de órdenes de producción con filtros
 */
export async function obtenerOrdenesProduccionAction(
    filtros?: {
        estado?: string
        fechaDesde?: string
        fechaHasta?: string
    }
): Promise<FormResponse<OrdenProduccion[]>> {
    try {
        const supabase = await createClient()

        let query = supabase
            .from('ordenes_produccion')
            .select(`
        *,
        operario:usuarios!operario_id(id, nombre, apellido)
      `)
            .order('fecha_produccion', { ascending: false })

        if (filtros?.estado) {
            query = query.eq('estado', filtros.estado)
        }

        if (filtros?.fechaDesde) {
            query = query.gte('fecha_produccion', filtros.fechaDesde)
        }

        if (filtros?.fechaHasta) {
            query = query.lte('fecha_produccion', filtros.fechaHasta)
        }

        const { data, error } = await query

        if (error) {
            console.error('Error obteniendo órdenes:', error)
            return { success: false, message: error.message }
        }

        return { success: true, data: data as OrdenProduccion[] }
    } catch (error) {
        console.error('Error en obtenerOrdenesProduccionAction:', error)
        return { success: false, message: 'Error al obtener órdenes de producción' }
    }
}

/**
 * Obtener orden de producción por ID con entradas y salidas
 */
export async function obtenerOrdenProduccionAction(
    ordenId: string
): Promise<FormResponse<OrdenProduccion>> {
    try {
        const supabase = await createClient()

        // Obtener orden
        const { data: orden, error: errorOrden } = await supabase
            .from('ordenes_produccion')
            .select(`
        *,
        operario:usuarios!operario_id(id, nombre, apellido)
      `)
            .eq('id', ordenId)
            .single()

        if (errorOrden) {
            return { success: false, message: errorOrden.message }
        }

        // Obtener entradas
        const { data: entradas } = await supabase
            .from('orden_produccion_entradas')
            .select(`
        *,
        producto:productos(id, codigo, nombre),
        lote:lotes(id, numero_lote, cantidad_disponible)
      `)
            .eq('orden_id', ordenId)

        // Obtener salidas
        const { data: salidas } = await supabase
            .from('orden_produccion_salidas')
            .select(`
        *,
        producto:productos(id, codigo, nombre),
        lote_generado:lotes(id, numero_lote)
      `)
            .eq('orden_id', ordenId)

        return {
            success: true,
            data: {
                ...orden,
                entradas: entradas || [],
                salidas: salidas || []
            } as OrdenProduccion
        }
    } catch (error) {
        console.error('Error en obtenerOrdenProduccionAction:', error)
        return { success: false, message: 'Error al obtener orden de producción' }
    }
}

/**
 * Crear nueva orden de producción
 */
export async function crearOrdenProduccionAction(
    observaciones?: string
): Promise<FormResponse<{ orden_id: string; numero_orden: string }>> {
    try {
        const supabase = await createClient()

        // Obtener usuario actual
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { success: false, message: 'Usuario no autenticado' }
        }

        // Llamar RPC
        const { data, error } = await supabase.rpc('fn_crear_orden_produccion', {
            p_operario_id: user.id,
            p_observaciones: observaciones || null
        })

        if (error) {
            console.error('Error creando orden:', error)
            return { success: false, message: error.message }
        }

        if (!data.success) {
            return { success: false, message: data.error }
        }

        revalidatePath('/almacen/produccion')

        return {
            success: true,
            data: {
                orden_id: data.orden_id,
                numero_orden: data.numero_orden
            }
        }
    } catch (error) {
        console.error('Error en crearOrdenProduccionAction:', error)
        return { success: false, message: 'Error al crear orden de producción' }
    }
}

/**
 * Agregar entrada a orden de producción (producto a consumir)
 */
export async function agregarEntradaProduccionAction(
    ordenId: string,
    productoId: string,
    loteId: string,
    cantidad: number,
    pesoKg?: number
): Promise<FormResponse<{ entrada_id: string }>> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase.rpc('fn_agregar_entrada_produccion', {
            p_orden_id: ordenId,
            p_producto_id: productoId,
            p_lote_id: loteId,
            p_cantidad: cantidad,
            p_peso_kg: pesoKg || null
        })

        if (error) {
            console.error('Error agregando entrada:', error)
            return { success: false, message: error.message }
        }

        if (!data.success) {
            return { success: false, message: data.error }
        }

        revalidatePath('/almacen/produccion')

        return {
            success: true,
            data: { entrada_id: data.entrada_id }
        }
    } catch (error) {
        console.error('Error en agregarEntradaProduccionAction:', error)
        return { success: false, message: 'Error al agregar entrada' }
    }
}

/**
 * Agregar salida a orden de producción (producto generado con peso)
 */
export async function agregarSalidaProduccionAction(
    ordenId: string,
    productoId: string,
    pesoKg: number,
    cantidad?: number,
    plu?: string,
    fechaVencimiento?: string,
    pesajeId?: string
): Promise<FormResponse<{ salida_id: string }>> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase.rpc('fn_agregar_salida_produccion', {
            p_orden_id: ordenId,
            p_producto_id: productoId,
            p_peso_kg: pesoKg,
            p_cantidad: cantidad || 1,
            p_plu: plu || null,
            p_fecha_vencimiento: fechaVencimiento || null,
            p_pesaje_id: pesajeId || null
        })

        if (error) {
            console.error('Error agregando salida:', error)
            return { success: false, message: error.message }
        }

        if (!data.success) {
            return { success: false, message: data.error }
        }

        revalidatePath('/almacen/produccion')

        return {
            success: true,
            data: { salida_id: data.salida_id }
        }
    } catch (error) {
        console.error('Error en agregarSalidaProduccionAction:', error)
        return { success: false, message: 'Error al agregar salida' }
    }
}

/**
 * Completar orden de producción y generar lotes
 */
export async function completarOrdenProduccionAction(
    ordenId: string
): Promise<FormResponse<{
    lotes_generados: Array<{
        lote_id: string
        numero_lote: string
        producto_id: string
        peso_kg: number
    }>
    merma_kg: number
    merma_porcentaje: number
}>> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase.rpc('fn_completar_orden_produccion', {
            p_orden_id: ordenId
        })

        if (error) {
            console.error('Error completando orden:', error)
            return { success: false, message: error.message }
        }

        if (!data.success) {
            return { success: false, message: data.error }
        }

        revalidatePath('/almacen/produccion')
        revalidatePath('/almacen/lotes')

        return {
            success: true,
            data: {
                lotes_generados: data.lotes_generados,
                merma_kg: data.merma_kg,
                merma_porcentaje: data.merma_porcentaje
            }
        }
    } catch (error) {
        console.error('Error en completarOrdenProduccionAction:', error)
        return { success: false, message: 'Error al completar orden de producción' }
    }
}

/**
 * Cancelar orden de producción (revierte stock)
 */
export async function cancelarOrdenProduccionAction(
    ordenId: string
): Promise<FormResponse<void>> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase.rpc('fn_cancelar_orden_produccion', {
            p_orden_id: ordenId
        })

        if (error) {
            console.error('Error cancelando orden:', error)
            return { success: false, message: error.message }
        }

        if (!data.success) {
            return { success: false, message: data.error }
        }

        revalidatePath('/almacen/produccion')
        revalidatePath('/almacen/lotes')

        return { success: true }
    } catch (error) {
        console.error('Error en cancelarOrdenProduccionAction:', error)
        return { success: false, message: 'Error al cancelar orden de producción' }
    }
}

/**
 * Eliminar entrada de producción (solo si orden está en proceso)
 */
export async function eliminarEntradaProduccionAction(
    entradaId: string,
    ordenId: string
): Promise<FormResponse<void>> {
    try {
        const supabase = await createClient()

        // Verificar estado de la orden
        const { data: orden } = await supabase
            .from('ordenes_produccion')
            .select('estado')
            .eq('id', ordenId)
            .single()

        if (orden?.estado !== 'en_proceso') {
            return { success: false, message: 'Solo se pueden eliminar entradas de órdenes en proceso' }
        }

        // Obtener entrada para revertir stock
        const { data: entrada } = await supabase
            .from('orden_produccion_entradas')
            .select('lote_id, cantidad, peso_kg')
            .eq('id', entradaId)
            .single()

        if (!entrada) {
            return { success: false, message: 'Entrada no encontrada' }
        }

        // Revertir stock del lote
        if (entrada.lote_id) {
            await supabase
                .from('lotes')
                .update({
                    cantidad_disponible: supabase.rpc('fn_sumar_cantidad', {
                        p_lote_id: entrada.lote_id,
                        p_cantidad: entrada.cantidad
                    })
                })
                .eq('id', entrada.lote_id)

            // Actualizar lote manualmente
            const { data: lote } = await supabase
                .from('lotes')
                .select('cantidad_disponible')
                .eq('id', entrada.lote_id)
                .single()

            if (lote) {
                await supabase
                    .from('lotes')
                    .update({
                        cantidad_disponible: lote.cantidad_disponible + entrada.cantidad,
                        estado: 'disponible'
                    })
                    .eq('id', entrada.lote_id)
            }
        }

        // Actualizar peso total en orden
        if (entrada.peso_kg) {
            const { data: ordenActual } = await supabase
                .from('ordenes_produccion')
                .select('peso_total_entrada')
                .eq('id', ordenId)
                .single()

            if (ordenActual) {
                await supabase
                    .from('ordenes_produccion')
                    .update({
                        peso_total_entrada: ordenActual.peso_total_entrada - entrada.peso_kg
                    })
                    .eq('id', ordenId)
            }
        }

        // Eliminar entrada
        const { error } = await supabase
            .from('orden_produccion_entradas')
            .delete()
            .eq('id', entradaId)

        if (error) {
            return { success: false, message: error.message }
        }

        revalidatePath('/almacen/produccion')

        return { success: true }
    } catch (error) {
        console.error('Error en eliminarEntradaProduccionAction:', error)
        return { success: false, message: 'Error al eliminar entrada' }
    }
}

/**
 * Eliminar salida de producción (solo si orden está en proceso)
 */
export async function eliminarSalidaProduccionAction(
    salidaId: string,
    ordenId: string
): Promise<FormResponse<void>> {
    try {
        const supabase = await createClient()

        // Verificar estado de la orden
        const { data: orden } = await supabase
            .from('ordenes_produccion')
            .select('estado')
            .eq('id', ordenId)
            .single()

        if (orden?.estado !== 'en_proceso') {
            return { success: false, message: 'Solo se pueden eliminar salidas de órdenes en proceso' }
        }

        // Obtener salida para actualizar peso
        const { data: salida } = await supabase
            .from('orden_produccion_salidas')
            .select('peso_kg')
            .eq('id', salidaId)
            .single()

        if (salida) {
            // Actualizar peso total en orden
            const { data: ordenActual } = await supabase
                .from('ordenes_produccion')
                .select('peso_total_salida')
                .eq('id', ordenId)
                .single()

            if (ordenActual) {
                await supabase
                    .from('ordenes_produccion')
                    .update({
                        peso_total_salida: ordenActual.peso_total_salida - salida.peso_kg
                    })
                    .eq('id', ordenId)
            }
        }

        // Eliminar salida
        const { error } = await supabase
            .from('orden_produccion_salidas')
            .delete()
            .eq('id', salidaId)

        if (error) {
            return { success: false, message: error.message }
        }

        revalidatePath('/almacen/produccion')

        return { success: true }
    } catch (error) {
        console.error('Error en eliminarSalidaProduccionAction:', error)
        return { success: false, message: 'Error al eliminar salida' }
    }
}

// ===========================================
// BALANZA
// ===========================================

/**
 * Obtener configuración de balanzas
 */
export async function obtenerBalanzasAction(): Promise<FormResponse<BalanzaConfig[]>> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('balanza_config')
            .select('*')
            .order('nombre')

        if (error) {
            return { success: false, message: error.message }
        }

        return { success: true, data: data as BalanzaConfig[] }
    } catch (error) {
        console.error('Error en obtenerBalanzasAction:', error)
        return { success: false, message: 'Error al obtener balanzas' }
    }
}

/**
 * Guardar configuración de balanza
 */
export async function guardarBalanzaAction(
    balanza: Partial<BalanzaConfig>
): Promise<FormResponse<BalanzaConfig>> {
    try {
        const supabase = await createClient()

        if (balanza.id) {
            // Actualizar
            const { data, error } = await supabase
                .from('balanza_config')
                .update({
                    nombre: balanza.nombre,
                    modelo: balanza.modelo,
                    indicador: balanza.indicador,
                    puerto: balanza.puerto,
                    baudrate: balanza.baudrate,
                    data_bits: balanza.data_bits,
                    parity: balanza.parity,
                    stop_bits: balanza.stop_bits,
                    activa: balanza.activa,
                    updated_at: new Date().toISOString()
                })
                .eq('id', balanza.id)
                .select()
                .single()

            if (error) {
                return { success: false, message: error.message }
            }

            return { success: true, data: data as BalanzaConfig }
        } else {
            // Crear
            const { data, error } = await supabase
                .from('balanza_config')
                .insert({
                    nombre: balanza.nombre,
                    modelo: balanza.modelo,
                    indicador: balanza.indicador,
                    puerto: balanza.puerto,
                    baudrate: balanza.baudrate || 9600,
                    data_bits: balanza.data_bits || 8,
                    parity: balanza.parity || 'none',
                    stop_bits: balanza.stop_bits || 1,
                    activa: balanza.activa ?? true
                })
                .select()
                .single()

            if (error) {
                return { success: false, message: error.message }
            }

            return { success: true, data: data as BalanzaConfig }
        }
    } catch (error) {
        console.error('Error en guardarBalanzaAction:', error)
        return { success: false, message: 'Error al guardar balanza' }
    }
}

// ===========================================
// PESAJES
// ===========================================

/**
 * Registrar pesaje desde balanza
 */
export async function registrarPesajeAction(
    balanzaId: string | null,
    productoId: string | null,
    ordenProduccionId: string | null,
    pesoBruto: number,
    tara: number = 0
): Promise<FormResponse<Pesaje>> {
    try {
        const supabase = await createClient()

        // Obtener usuario actual
        const { data: { user } } = await supabase.auth.getUser()

        const { data, error } = await supabase.rpc('fn_registrar_pesaje', {
            p_balanza_id: balanzaId,
            p_producto_id: productoId,
            p_orden_produccion_id: ordenProduccionId,
            p_peso_bruto: pesoBruto,
            p_tara: tara,
            p_operario_id: user?.id || null
        })

        if (error) {
            return { success: false, message: error.message }
        }

        if (!data.success) {
            return { success: false, message: data.error }
        }

        return {
            success: true,
            data: {
                id: data.pesaje_id,
                peso_bruto: pesoBruto,
                tara: tara,
                peso_neto: data.peso_neto,
                unidad: 'kg'
            } as Pesaje
        }
    } catch (error) {
        console.error('Error en registrarPesajeAction:', error)
        return { success: false, message: 'Error al registrar pesaje' }
    }
}

/**
 * Obtener historial de pesajes
 */
export async function obtenerPesajesAction(
    filtros?: {
        ordenProduccionId?: string
        fechaDesde?: string
        fechaHasta?: string
    }
): Promise<FormResponse<Pesaje[]>> {
    try {
        const supabase = await createClient()

        let query = supabase
            .from('pesajes')
            .select(`
        *,
        producto:productos(id, codigo, nombre),
        operario:usuarios(id, nombre, apellido)
      `)
            .order('created_at', { ascending: false })
            .limit(100)

        if (filtros?.ordenProduccionId) {
            query = query.eq('orden_produccion_id', filtros.ordenProduccionId)
        }

        if (filtros?.fechaDesde) {
            query = query.gte('created_at', filtros.fechaDesde)
        }

        if (filtros?.fechaHasta) {
            query = query.lte('created_at', filtros.fechaHasta)
        }

        const { data, error } = await query

        if (error) {
            return { success: false, message: error.message }
        }

        return { success: true, data: data as Pesaje[] }
    } catch (error) {
        console.error('Error en obtenerPesajesAction:', error)
        return { success: false, message: 'Error al obtener pesajes' }
    }
}

// ===========================================
// PRODUCTOS Y LOTES PARA PRODUCCIÓN
// ===========================================

/**
 * Obtener lotes disponibles de un producto para consumir
 */
export async function obtenerLotesDisponiblesAction(
    productoId: string
): Promise<FormResponse<Array<{
    id: string
    numero_lote: string
    cantidad_disponible: number
    fecha_vencimiento?: string
}>>> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('lotes')
            .select('id, numero_lote, cantidad_disponible, fecha_vencimiento')
            .eq('producto_id', productoId)
            .eq('estado', 'disponible')
            .gt('cantidad_disponible', 0)
            .order('fecha_vencimiento', { ascending: true }) // FIFO por vencimiento

        if (error) {
            return { success: false, message: error.message }
        }

        return { success: true, data: data || [] }
    } catch (error) {
        console.error('Error en obtenerLotesDisponiblesAction:', error)
        return { success: false, message: 'Error al obtener lotes' }
    }
}
