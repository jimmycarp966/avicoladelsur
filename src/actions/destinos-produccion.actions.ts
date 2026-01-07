'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { DestinoProduccion, DestinoProducto, FormResponse } from '@/types/domain.types'

// ===========================================
// DESTINOS DE PRODUCCIÓN
// ===========================================

/**
 * Obtener todos los destinos de producción activos con sus productos
 */
export async function obtenerDestinosProduccionAction(): Promise<FormResponse<DestinoProduccion[]>> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase.rpc('fn_obtener_destinos_produccion')

        if (error) {
            console.error('Error obteniendo destinos:', error)
            return { success: false, message: error.message }
        }

        return { success: true, data: data || [] }
    } catch (error) {
        console.error('Error en obtenerDestinosProduccionAction:', error)
        return { success: false, message: 'Error al obtener destinos de producción' }
    }
}

/**
 * Obtener destinos de producción (consulta directa para tablas)
 */
export async function obtenerDestinosProduccionListaAction(): Promise<FormResponse<DestinoProduccion[]>> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('destinos_produccion')
            .select('*')
            .eq('activo', true)
            .order('orden_display')

        if (error) {
            console.error('Error obteniendo destinos:', error)
            return { success: false, message: error.message }
        }

        return { success: true, data: data as DestinoProduccion[] }
    } catch (error) {
        console.error('Error en obtenerDestinosProduccionListaAction:', error)
        return { success: false, message: 'Error al obtener destinos de producción' }
    }
}

/**
 * Crear nuevo destino de producción
 */
export async function crearDestinoProduccionAction(
    nombre: string,
    descripcion?: string
): Promise<FormResponse<{ destino_id: string }>> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase.rpc('fn_crear_destino_produccion', {
            p_nombre: nombre,
            p_descripcion: descripcion || null
        })

        if (error) {
            console.error('Error creando destino:', error)
            return { success: false, message: error.message }
        }

        if (!data.success) {
            return { success: false, message: data.error }
        }

        revalidatePath('/almacen/produccion')
        revalidatePath('/almacen/produccion/destinos')

        return {
            success: true,
            data: { destino_id: data.destino_id }
        }
    } catch (error) {
        console.error('Error en crearDestinoProduccionAction:', error)
        return { success: false, message: 'Error al crear destino de producción' }
    }
}

/**
 * Actualizar destino de producción
 */
export async function actualizarDestinoProduccionAction(
    destinoId: string,
    datos: {
        nombre?: string
        descripcion?: string
        activo?: boolean
        orden_display?: number
    }
): Promise<FormResponse<void>> {
    try {
        const supabase = await createClient()

        const { error } = await supabase
            .from('destinos_produccion')
            .update({
                ...datos,
                updated_at: new Date().toISOString()
            })
            .eq('id', destinoId)

        if (error) {
            console.error('Error actualizando destino:', error)
            return { success: false, message: error.message }
        }

        revalidatePath('/almacen/produccion')
        revalidatePath('/almacen/produccion/destinos')

        return { success: true }
    } catch (error) {
        console.error('Error en actualizarDestinoProduccionAction:', error)
        return { success: false, message: 'Error al actualizar destino' }
    }
}

/**
 * Eliminar/desactivar destino de producción
 */
export async function eliminarDestinoProduccionAction(
    destinoId: string
): Promise<FormResponse<void>> {
    try {
        const supabase = await createClient()

        // Desactivar en lugar de eliminar
        const { error } = await supabase
            .from('destinos_produccion')
            .update({ activo: false, updated_at: new Date().toISOString() })
            .eq('id', destinoId)

        if (error) {
            console.error('Error eliminando destino:', error)
            return { success: false, message: error.message }
        }

        revalidatePath('/almacen/produccion')
        revalidatePath('/almacen/produccion/destinos')

        return { success: true }
    } catch (error) {
        console.error('Error en eliminarDestinoProduccionAction:', error)
        return { success: false, message: 'Error al eliminar destino' }
    }
}

// ===========================================
// PRODUCTOS POR DESTINO
// ===========================================

/**
 * Obtener productos asociados a un destino
 */
export async function obtenerProductosDestinoAction(
    destinoId: string
): Promise<FormResponse<DestinoProducto[]>> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('destino_productos')
            .select(`
                *,
                es_desperdicio_solido,
                producto:productos(id, codigo, nombre, categoria)
            `)
            .eq('destino_id', destinoId)
            .order('orden')

        if (error) {
            console.error('Error obteniendo productos del destino:', error)
            return { success: false, message: error.message }
        }

        return { success: true, data: data as DestinoProducto[] }
    } catch (error) {
        console.error('Error en obtenerProductosDestinoAction:', error)
        return { success: false, message: 'Error al obtener productos del destino' }
    }
}

/**
 * Asociar producto a destino
 */
export async function asociarProductoDestinoAction(
    destinoId: string,
    productoId: string,
    esDesperdicio: boolean = false
): Promise<FormResponse<{ id: string }>> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase.rpc('fn_asociar_producto_destino', {
            p_destino_id: destinoId,
            p_producto_id: productoId,
            p_es_desperdicio: esDesperdicio
        })

        if (error) {
            console.error('Error asociando producto:', error)
            return { success: false, message: error.message }
        }

        if (!data.success) {
            return { success: false, message: data.error }
        }

        revalidatePath('/almacen/produccion/destinos')

        return {
            success: true,
            data: { id: data.id }
        }
    } catch (error) {
        console.error('Error en asociarProductoDestinoAction:', error)
        return { success: false, message: 'Error al asociar producto' }
    }
}

/**
 * Desasociar producto de destino
 */
export async function desasociarProductoDestinoAction(
    destinoId: string,
    productoId: string
): Promise<FormResponse<void>> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase.rpc('fn_desasociar_producto_destino', {
            p_destino_id: destinoId,
            p_producto_id: productoId
        })

        if (error) {
            console.error('Error desasociando producto:', error)
            return { success: false, message: error.message }
        }

        revalidatePath('/almacen/produccion/destinos')

        return { success: true }
    } catch (error) {
        console.error('Error en desasociarProductoDestinoAction:', error)
        return { success: false, message: 'Error al desasociar producto' }
    }
}

/**
 * Actualizar si un producto es desperdicio
 */
export async function actualizarDesperdicioProductoAction(
    destinoId: string,
    productoId: string,
    esDesperdicio: boolean,
    esDesperdicioSolido: boolean = false
): Promise<FormResponse<void>> {
    try {
        const supabase = await createClient()

        const { error } = await supabase
            .from('destino_productos')
            .update({
                es_desperdicio: esDesperdicio,
                es_desperdicio_solido: esDesperdicioSolido
            })
            .eq('destino_id', destinoId)
            .eq('producto_id', productoId)

        if (error) {
            console.error('Error actualizando desperdicio:', error)
            return { success: false, message: error.message }
        }

        revalidatePath('/almacen/produccion/destinos')

        return { success: true }
    } catch (error) {
        console.error('Error en actualizarDesperdicioProductoAction:', error)
        return { success: false, message: 'Error al actualizar producto' }
    }
}

/**
 * Obtener productos permitidos para un destino (para filtrar en formulario)
 */
export async function obtenerProductosPorDestinoAction(
    destinoId: string
): Promise<FormResponse<Array<{
    id: string
    codigo: string
    nombre: string
    categoria?: string
    es_desperdicio: boolean
    es_desperdicio_solido: boolean
}>>> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('destino_productos')
            .select(`
                producto_id,
                es_desperdicio,
                es_desperdicio_solido,
                producto:productos(id, codigo, nombre, categoria)
            `)
            .eq('destino_id', destinoId)
            .order('orden')

        if (error) {
            console.error('Error obteniendo productos por destino:', error)
            return { success: false, message: error.message }
        }

        // Transformar la respuesta
        const productos = (data || []).map((item: any) => ({
            id: item.producto?.id || item.producto_id,
            codigo: item.producto?.codigo || '',
            nombre: item.producto?.nombre || '',
            categoria: item.producto?.categoria,
            es_desperdicio: item.es_desperdicio,
            es_desperdicio_solido: item.es_desperdicio_solido || false
        }))

        return { success: true, data: productos }
    } catch (error) {
        console.error('Error en obtenerProductosPorDestinoAction:', error)
        return { success: false, message: 'Error al obtener productos' }
    }
}

