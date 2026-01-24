'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { FormResponse } from '@/types/domain.types'

// ===========================================
// TIPOS
// ===========================================

export interface ConteoStock {
    id: string
    fecha: string
    turno: 'mañana' | 'noche'
    usuario_id: string
    estado: 'en_progreso' | 'completado' | 'cancelado' | 'timeout'
    hora_inicio: string
    hora_fin?: string
    duracion_minutos?: number
    observaciones?: string
    produccion_en_curso: boolean
    ordenes_produccion_ids?: string[]
    cajones_faltantes: number
    total_productos_contados: number
    total_diferencias: number
    monto_diferencia_estimado: number
    usuario?: {
        id: string
        nombre: string
        apellido?: string
    }
}

export interface ConteoStockItem {
    id: string
    conteo_id: string
    producto_id: string
    cantidad_sistema: number
    cantidad_fisica?: number
    diferencia: number
    diferencia_porcentaje: number
    diferencia_valor?: number
    observacion?: string
    hora_conteo?: string
    producto?: {
        id: string
        codigo: string
        nombre: string
        unidad: string
        precio_costo?: number
    }
}

export interface ProduccionEnCurso {
    en_curso: boolean
    ordenes_ids: string[]
    cantidad_ordenes: number
    cajones_faltantes: number
}

// ===========================================
// VERIFICAR PRODUCCIÓN EN CURSO
// ===========================================

/**
 * Verifica si hay producción en curso y cuántos cajones faltan
 */
export async function verificarProduccionEnCursoAction(): Promise<FormResponse<ProduccionEnCurso>> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase.rpc('fn_verificar_produccion_en_curso')

        if (error) {
            console.error('Error verificando producción:', error)
            return { success: false, message: error.message }
        }

        return { success: true, data: data as ProduccionEnCurso }
    } catch (error) {
        console.error('Error en verificarProduccionEnCursoAction:', error)
        return { success: false, message: 'Error al verificar producción en curso' }
    }
}

// ===========================================
// INICIAR CONTEO
// ===========================================

/**
 * Inicia un nuevo conteo de stock para el turno especificado
 */
export async function iniciarConteoStockAction(
    turno: 'mañana' | 'noche'
): Promise<FormResponse<{
    conteo_id: string
    turno: string
    fecha: string
    produccion_en_curso: boolean
    cajones_faltantes: number
}>> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase.rpc('fn_iniciar_conteo_stock', {
            p_turno: turno
        })

        if (error) {
            console.error('Error iniciando conteo:', error)
            return { success: false, message: error.message }
        }

        if (!data.success) {
            return { success: false, message: data.error }
        }

        revalidatePath('/almacen/control-stock')

        return { success: true, data }
    } catch (error) {
        console.error('Error en iniciarConteoStockAction:', error)
        return { success: false, message: 'Error al iniciar conteo de stock' }
    }
}

// ===========================================
// OBTENER CONTEO ACTUAL
// ===========================================

/**
 * Obtiene el conteo en progreso del día, si existe
 */
export async function obtenerConteoEnProgresoAction(): Promise<FormResponse<ConteoStock | null>> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('conteos_stock_turno')
            .select(`
                *,
                usuario:usuarios(id, nombre, apellido)
            `)
            .eq('fecha', new Date().toISOString().split('T')[0])
            .eq('estado', 'en_progreso')
            .maybeSingle()

        if (error) {
            console.error('Error obteniendo conteo en progreso:', error)
            return { success: false, message: error.message }
        }

        return { success: true, data: data as ConteoStock | null }
    } catch (error) {
        console.error('Error en obtenerConteoEnProgresoAction:', error)
        return { success: false, message: 'Error al obtener conteo en progreso' }
    }
}

// ===========================================
// OBTENER ITEMS DEL CONTEO
// ===========================================

/**
 * Obtiene los items de un conteo con información del producto
 */
export async function obtenerItemsConteoAction(
    conteoId: string,
    soloConDiferencia?: boolean
): Promise<FormResponse<ConteoStockItem[]>> {
    try {
        const supabase = await createClient()

        let query = supabase
            .from('conteos_stock_turno_items')
            .select(`
                *,
                producto:productos(id, codigo, nombre, unidad, precio_costo)
            `)
            .eq('conteo_id', conteoId)
            .order('producto(nombre)')

        if (soloConDiferencia) {
            query = query.neq('diferencia', 0)
        }

        const { data, error } = await query

        if (error) {
            console.error('Error obteniendo items de conteo:', error)
            return { success: false, message: error.message }
        }

        return { success: true, data: data as ConteoStockItem[] }
    } catch (error) {
        console.error('Error en obtenerItemsConteoAction:', error)
        return { success: false, message: 'Error al obtener items del conteo' }
    }
}

// ===========================================
// REGISTRAR CONTEO DE ITEM
// ===========================================

/**
 * Registra la cantidad física de un producto
 */
export async function registrarConteoItemAction(
    conteoId: string,
    productoId: string,
    cantidadFisica: number,
    observacion?: string
): Promise<FormResponse<{ diferencia: number; diferencia_valor: number }>> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase.rpc('fn_registrar_conteo_item', {
            p_conteo_id: conteoId,
            p_producto_id: productoId,
            p_cantidad_fisica: cantidadFisica,
            p_observacion: observacion || null
        })

        if (error) {
            console.error('Error registrando conteo de item:', error)
            return { success: false, message: error.message }
        }

        if (!data.success) {
            return { success: false, message: data.error }
        }

        revalidatePath('/almacen/control-stock')

        return {
            success: true,
            data: {
                diferencia: data.diferencia,
                diferencia_valor: data.diferencia_valor
            }
        }
    } catch (error) {
        console.error('Error en registrarConteoItemAction:', error)
        return { success: false, message: 'Error al registrar conteo del item' }
    }
}

// ===========================================
// FINALIZAR CONTEO
// ===========================================

/**
 * Finaliza el conteo de stock
 */
export async function finalizarConteoStockAction(
    conteoId: string,
    observaciones?: string,
    forzar?: boolean
): Promise<FormResponse<{
    estado: string
    duracion_minutos: number
    excedio_tiempo: boolean
    total_productos_contados: number
    total_diferencias: number
    monto_diferencia_estimado: number
}>> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase.rpc('fn_finalizar_conteo_stock', {
            p_conteo_id: conteoId,
            p_observaciones: observaciones || null,
            p_forzar: forzar || false
        })

        if (error) {
            console.error('Error finalizando conteo:', error)
            return { success: false, message: error.message }
        }

        if (!data.success) {
            return { success: false, message: data.error }
        }

        revalidatePath('/almacen/control-stock')
        revalidatePath('/almacen')

        return { success: true, data }
    } catch (error) {
        console.error('Error en finalizarConteoStockAction:', error)
        return { success: false, message: 'Error al finalizar conteo de stock' }
    }
}

// ===========================================
// OBTENER HISTORIAL DE CONTEOS
// ===========================================

/**
 * Obtiene el historial de conteos realizados
 */
export async function obtenerHistorialConteosAction(
    limite?: number
): Promise<FormResponse<ConteoStock[]>> {
    try {
        const supabase = await createClient()

        let query = supabase
            .from('conteos_stock_turno')
            .select(`
                *,
                usuario:usuarios(id, nombre, apellido)
            `)
            .order('fecha', { ascending: false })
            .order('turno', { ascending: true })

        if (limite) {
            query = query.limit(limite)
        }

        const { data, error } = await query

        if (error) {
            console.error('Error obteniendo historial de conteos:', error)
            return { success: false, message: error.message }
        }

        return { success: true, data: data as ConteoStock[] }
    } catch (error) {
        console.error('Error en obtenerHistorialConteosAction:', error)
        return { success: false, message: 'Error al obtener historial de conteos' }
    }
}

// ===========================================
// OBTENER CONTEO POR ID
// ===========================================

/**
 * Obtiene un conteo específico por ID con sus items
 */
export async function obtenerConteoDetalleAction(
    conteoId: string
): Promise<FormResponse<ConteoStock & { items: ConteoStockItem[] }>> {
    try {
        const supabase = await createClient()

        // Obtener conteo
        const { data: conteo, error: errorConteo } = await supabase
            .from('conteos_stock_turno')
            .select(`
                *,
                usuario:usuarios(id, nombre, apellido)
            `)
            .eq('id', conteoId)
            .single()

        if (errorConteo) {
            console.error('Error obteniendo conteo:', errorConteo)
            return { success: false, message: errorConteo.message }
        }

        // Obtener items
        const { data: items, error: errorItems } = await supabase
            .from('conteos_stock_turno_items')
            .select(`
                *,
                producto:productos(id, codigo, nombre, unidad, precio_costo)
            `)
            .eq('conteo_id', conteoId)
            .order('producto(nombre)')

        if (errorItems) {
            console.error('Error obteniendo items:', errorItems)
            return { success: false, message: errorItems.message }
        }

        return {
            success: true,
            data: {
                ...(conteo as ConteoStock),
                items: items as ConteoStockItem[]
            }
        }
    } catch (error) {
        console.error('Error en obtenerConteoDetalleAction:', error)
        return { success: false, message: 'Error al obtener detalle del conteo' }
    }
}

// ===========================================
// CANCELAR CONTEO
// ===========================================

/**
 * Cancela un conteo en progreso
 */
export async function cancelarConteoStockAction(
    conteoId: string
): Promise<FormResponse<void>> {
    try {
        const supabase = await createClient()

        const { error } = await supabase
            .from('conteos_stock_turno')
            .update({
                estado: 'cancelado',
                hora_fin: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', conteoId)
            .eq('estado', 'en_progreso')

        if (error) {
            console.error('Error cancelando conteo:', error)
            return { success: false, message: error.message }
        }

        revalidatePath('/almacen/control-stock')

        return { success: true }
    } catch (error) {
        console.error('Error en cancelarConteoStockAction:', error)
        return { success: false, message: 'Error al cancelar conteo' }
    }
}
