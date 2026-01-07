'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { FormResponse } from '@/types/domain.types'

// ===========================================
// TIPOS
// ===========================================

export interface RendimientoEsperado {
    id: string
    destino_id: string
    producto_entrada_id: string
    proveedor: string
    porcentaje_esperado: number
    tolerancia: number
    activo: boolean
    notas?: string
    producto?: {
        id: string
        codigo: string
        nombre: string
    }
    destino?: {
        id: string
        nombre: string
    }
}

export interface PrediccionRendimiento {
    producto_id: string
    producto_nombre: string
    producto_codigo: string
    porcentaje_esperado: number
    peso_predicho_kg: number
    tolerancia: number
    peso_min_kg: number
    peso_max_kg: number
    es_desperdicio_solido: boolean
}

// ===========================================
// CONSULTAS
// ===========================================

/**
 * Obtener todos los rendimientos esperados configurados
 */
export async function obtenerRendimientosEsperadosAction(
    filtros?: {
        destinoId?: string
        proveedor?: string
    }
): Promise<FormResponse<RendimientoEsperado[]>> {
    try {
        const supabase = await createClient()

        let query = supabase
            .from('rendimientos_esperados')
            .select(`
                *,
                producto:productos!producto_entrada_id(id, codigo, nombre),
                destino:destinos_produccion!destino_id(id, nombre)
            `)
            .eq('activo', true)
            .order('proveedor')

        if (filtros?.destinoId) {
            query = query.eq('destino_id', filtros.destinoId)
        }

        if (filtros?.proveedor) {
            query = query.eq('proveedor', filtros.proveedor)
        }

        const { data, error } = await query

        if (error) {
            console.error('Error obteniendo rendimientos:', error)
            return { success: false, message: error.message }
        }

        return { success: true, data: data as RendimientoEsperado[] }
    } catch (error) {
        console.error('Error en obtenerRendimientosEsperadosAction:', error)
        return { success: false, message: 'Error al obtener rendimientos' }
    }
}

/**
 * Obtener predicción de rendimiento para un destino y peso de entrada
 */
export async function obtenerPrediccionRendimientoAction(
    destinoId: string,
    pesoEntradaKg: number,
    proveedor?: string
): Promise<FormResponse<PrediccionRendimiento[]>> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase.rpc('fn_predecir_rendimiento', {
            p_destino_id: destinoId,
            p_peso_entrada_kg: pesoEntradaKg,
            p_proveedor: proveedor || 'GENERICO'
        })

        if (error) {
            console.error('Error obteniendo predicción:', error)
            return { success: false, message: error.message }
        }

        return { success: true, data: data as PrediccionRendimiento[] }
    } catch (error) {
        console.error('Error en obtenerPrediccionRendimientoAction:', error)
        return { success: false, message: 'Error al obtener predicción' }
    }
}

/**
 * Obtener lista de proveedores únicos configurados
 */
export async function obtenerProveedoresRendimientoAction(): Promise<FormResponse<string[]>> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('rendimientos_esperados')
            .select('proveedor')
            .eq('activo', true)

        if (error) {
            return { success: false, message: error.message }
        }

        // Extraer proveedores únicos
        const proveedores = [...new Set(data?.map(r => r.proveedor) || [])]

        return { success: true, data: proveedores }
    } catch (error) {
        console.error('Error en obtenerProveedoresRendimientoAction:', error)
        return { success: false, message: 'Error al obtener proveedores' }
    }
}

// ===========================================
// CRUD
// ===========================================

/**
 * Crear o actualizar rendimiento esperado
 */
export async function guardarRendimientoEsperadoAction(
    destinoId: string,
    productoId: string,
    proveedor: string,
    porcentaje: number,
    tolerancia: number = 5.0,
    notas?: string
): Promise<FormResponse<{ id: string }>> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase.rpc('fn_upsert_rendimiento_esperado', {
            p_destino_id: destinoId,
            p_producto_id: productoId,
            p_proveedor: proveedor || 'GENERICO',
            p_porcentaje: porcentaje,
            p_tolerancia: tolerancia,
            p_notas: notas || null
        })

        if (error) {
            console.error('Error guardando rendimiento:', error)
            return { success: false, message: error.message }
        }

        if (!data.success) {
            return { success: false, message: data.error }
        }

        revalidatePath('/almacen/produccion/rendimientos')

        return { success: true, data: { id: data.id } }
    } catch (error) {
        console.error('Error en guardarRendimientoEsperadoAction:', error)
        return { success: false, message: 'Error al guardar rendimiento' }
    }
}

/**
 * Eliminar rendimiento esperado
 */
export async function eliminarRendimientoEsperadoAction(
    rendimientoId: string
): Promise<FormResponse<void>> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase.rpc('fn_eliminar_rendimiento_esperado', {
            p_id: rendimientoId
        })

        if (error) {
            console.error('Error eliminando rendimiento:', error)
            return { success: false, message: error.message }
        }

        revalidatePath('/almacen/produccion/rendimientos')

        return { success: true }
    } catch (error) {
        console.error('Error en eliminarRendimientoEsperadoAction:', error)
        return { success: false, message: 'Error al eliminar rendimiento' }
    }
}

/**
 * Guardar múltiples rendimientos de una vez (bulk)
 */
export async function guardarRendimientosBulkAction(
    rendimientos: Array<{
        destinoId: string
        productoId: string
        proveedor: string
        porcentaje: number
        tolerancia?: number
    }>
): Promise<FormResponse<{ guardados: number }>> {
    try {
        let guardados = 0

        for (const r of rendimientos) {
            const result = await guardarRendimientoEsperadoAction(
                r.destinoId,
                r.productoId,
                r.proveedor,
                r.porcentaje,
                r.tolerancia || 5.0
            )

            if (result.success) {
                guardados++
            }
        }

        revalidatePath('/almacen/produccion/rendimientos')

        return { success: true, data: { guardados } }
    } catch (error) {
        console.error('Error en guardarRendimientosBulkAction:', error)
        return { success: false, message: 'Error al guardar rendimientos' }
    }
}

// ===========================================
// ANÁLISIS Y PREDICCIÓN
// ===========================================

/**
 * Analizar rendimiento histórico para un proveedor
 */
export async function analizarRendimientoHistoricoAction(
    destinoId: string,
    proveedor?: string,
    diasAtras: number = 30
): Promise<FormResponse<{
    ordenes_analizadas: number
    rendimiento_promedio: Record<string, number>
    desviacion_estandar: Record<string, number>
}>> {
    try {
        const supabase = await createClient()

        // Obtener órdenes completadas del período
        const fechaDesde = new Date()
        fechaDesde.setDate(fechaDesde.getDate() - diasAtras)

        const { data: ordenes, error } = await supabase
            .from('ordenes_produccion')
            .select(`
                id,
                peso_total_entrada,
                peso_total_salida,
                entradas:orden_produccion_entradas(
                    producto_id,
                    peso_kg,
                    destino_id
                )
            `)
            .eq('estado', 'completada')
            .eq('destino_id', destinoId)
            .gte('fecha_produccion', fechaDesde.toISOString())

        if (error) {
            return { success: false, message: error.message }
        }

        if (!ordenes?.length) {
            return {
                success: true,
                data: {
                    ordenes_analizadas: 0,
                    rendimiento_promedio: {},
                    desviacion_estandar: {}
                }
            }
        }

        // Calcular rendimientos por producto
        const rendimientosPorProducto: Record<string, number[]> = {}

        for (const orden of ordenes) {
            if (orden.peso_total_entrada > 0) {
                for (const entrada of (orden.entradas || [])) {
                    const productoId = entrada.producto_id
                    const porcentaje = (entrada.peso_kg / orden.peso_total_entrada) * 100

                    if (!rendimientosPorProducto[productoId]) {
                        rendimientosPorProducto[productoId] = []
                    }
                    rendimientosPorProducto[productoId].push(porcentaje)
                }
            }
        }

        // Calcular promedios y desviación estándar
        const rendimiento_promedio: Record<string, number> = {}
        const desviacion_estandar: Record<string, number> = {}

        for (const [productoId, valores] of Object.entries(rendimientosPorProducto)) {
            const promedio = valores.reduce((a, b) => a + b, 0) / valores.length
            rendimiento_promedio[productoId] = Math.round(promedio * 100) / 100

            const varianza = valores.reduce((sum, val) => sum + Math.pow(val - promedio, 2), 0) / valores.length
            desviacion_estandar[productoId] = Math.round(Math.sqrt(varianza) * 100) / 100
        }

        return {
            success: true,
            data: {
                ordenes_analizadas: ordenes.length,
                rendimiento_promedio,
                desviacion_estandar
            }
        }
    } catch (error) {
        console.error('Error en analizarRendimientoHistoricoAction:', error)
        return { success: false, message: 'Error al analizar rendimiento' }
    }
}
