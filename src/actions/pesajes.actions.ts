'use server'

import { createClient } from '@/lib/supabase/server'
import type { FormResponse } from '@/types/forms'

// =============================================
// TIPOS
// =============================================

export interface PesajeHistorial {
    id: string
    producto_id: string
    cliente_id?: string
    peso_solicitado: number
    peso_real: number
    diferencia_kg: number
    diferencia_pct: number
    fue_anomalia: boolean
    usuario_acepto?: boolean
    motivo_anomalia?: string
    created_at: string
}

export interface ProductoEstadisticas {
    producto_id: string
    peso_promedio: number
    peso_minimo: number
    peso_maximo: number
    desviacion_estandar: number
    total_pesajes: number
    umbral_inferior: number
    umbral_superior: number
    last_updated: string
}

// =============================================
// ACCIONES
// =============================================

/**
 * Registrar un pesaje en el historial
 * El trigger de la BD actualizará automáticamente las estadísticas
 */
export async function registrarPesajeHistorialAction(
    productoId: string,
    pesoSolicitado: number,
    pesoReal: number,
    fueAnomalia: boolean = false,
    usuarioAcepto: boolean = true,
    motivoAnomalia?: string,
    clienteId?: string
): Promise<FormResponse<{ id: string }>> {
    try {
        const supabase = await createClient()

        const { data: user } = await supabase.auth.getUser()

        const { data, error } = await supabase
            .from('pesajes_historial')
            .insert({
                producto_id: productoId,
                cliente_id: clienteId,
                peso_solicitado: pesoSolicitado,
                peso_real: pesoReal,
                fue_anomalia: fueAnomalia,
                usuario_acepto: usuarioAcepto,
                motivo_anomalia: motivoAnomalia,
                usuario_id: user?.user?.id
            })
            .select('id')
            .single()

        if (error) {
            console.error('Error registrando pesaje:', error)
            return { success: false, message: error.message }
        }

        return { success: true, data: { id: data.id } }
    } catch (error) {
        console.error('Error en registrarPesajeHistorialAction:', error)
        return { success: false, message: 'Error al registrar pesaje' }
    }
}

/**
 * Obtener estadísticas de pesaje de un producto
 * Útil para mostrar umbrales dinámicos en la UI
 */
export async function obtenerEstadisticasProductoAction(
    productoId: string
): Promise<FormResponse<ProductoEstadisticas | null>> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('productos_estadisticas_pesaje')
            .select('*')
            .eq('producto_id', productoId)
            .single()

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
            console.error('Error obteniendo estadísticas:', error)
            return { success: false, message: error.message }
        }

        return { success: true, data: data || null }
    } catch (error) {
        console.error('Error en obtenerEstadisticasProductoAction:', error)
        return { success: false, message: 'Error al obtener estadísticas' }
    }
}

/**
 * Analizar si un peso es anómalo basándose en el historial
 * Retorna información enriquecida para la UI
 */
export async function analizarPesoConHistorialAction(
    productoId: string,
    pesoActual: number
): Promise<FormResponse<{
    esAnomalo: boolean
    tipo?: 'bajo' | 'alto' | 'normal'
    mensaje?: string
    estadisticas?: ProductoEstadisticas
    desviacionPct?: number
}>> {
    try {
        const supabase = await createClient()

        // Obtener estadísticas del producto
        const { data: stats } = await supabase
            .from('productos_estadisticas_pesaje')
            .select('*')
            .eq('producto_id', productoId)
            .single()

        // Si no hay suficientes datos, no podemos analizar
        if (!stats || stats.total_pesajes < 5) {
            return {
                success: true,
                data: {
                    esAnomalo: false,
                    tipo: 'normal',
                    mensaje: 'Sin suficiente historial para análisis (mínimo 5 pesajes)'
                }
            }
        }

        const umbralInferior = stats.umbral_inferior || 0
        const umbralSuperior = stats.umbral_superior || Infinity

        // Determinar si es anómalo
        let esAnomalo = false
        let tipo: 'bajo' | 'alto' | 'normal' = 'normal'
        let mensaje = ''
        let desviacionPct = 0

        if (pesoActual < umbralInferior) {
            esAnomalo = true
            tipo = 'bajo'
            desviacionPct = ((stats.peso_promedio - pesoActual) / stats.peso_promedio) * 100
            mensaje = `Peso ${desviacionPct.toFixed(0)}% menor al promedio histórico (${stats.peso_promedio.toFixed(2)} kg)`
        } else if (pesoActual > umbralSuperior) {
            esAnomalo = true
            tipo = 'alto'
            desviacionPct = ((pesoActual - stats.peso_promedio) / stats.peso_promedio) * 100
            mensaje = `Peso ${desviacionPct.toFixed(0)}% mayor al promedio histórico (${stats.peso_promedio.toFixed(2)} kg)`
        } else {
            mensaje = `Peso dentro del rango esperado (${umbralInferior.toFixed(2)} - ${umbralSuperior.toFixed(2)} kg)`
        }

        return {
            success: true,
            data: {
                esAnomalo,
                tipo,
                mensaje,
                estadisticas: stats,
                desviacionPct
            }
        }
    } catch (error) {
        console.error('Error en analizarPesoConHistorialAction:', error)
        return { success: false, message: 'Error al analizar peso' }
    }
}

/**
 * Obtener historial de pesajes de un producto
 */
export async function obtenerHistorialPesajesAction(
    productoId: string,
    limite: number = 50
): Promise<FormResponse<PesajeHistorial[]>> {
    try {
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('pesajes_historial')
            .select('*')
            .eq('producto_id', productoId)
            .order('created_at', { ascending: false })
            .limit(limite)

        if (error) {
            console.error('Error obteniendo historial:', error)
            return { success: false, message: error.message }
        }

        return { success: true, data: data || [] }
    } catch (error) {
        console.error('Error en obtenerHistorialPesajesAction:', error)
        return { success: false, message: 'Error al obtener historial' }
    }
}
