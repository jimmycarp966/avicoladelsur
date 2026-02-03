/**
 * Sistema de cola de procesamiento asíncrono para conciliaciones grandes
 * Permite procesar archivos pesados sin bloquear la UI
 */

import { createClient } from '@/lib/supabase/server'

export type EstadoJob = 'pendiente' | 'procesando' | 'completado' | 'error' | 'cancelado'

export interface ConciliacionJob {
    id: string
    estado: EstadoJob
    usuario_id: string
    archivo_sabana: string
    total_comprobantes: number
    comprobantes_procesados: number
    progreso_porcentaje: number
    sesion_id?: string
    error_mensaje?: string
    resultado_resumen?: {
        validados: number
        no_encontrados: number
        sin_cliente: number
        monto_total_acreditado: number
    }
    created_at: string
    updated_at: string
}

/**
 * Crea un nuevo job de procesamiento asíncrono
 */
export async function crearJobProcesamiento(
    archivoSabana: string,
    totalComprobantes: number,
    usuarioId: string
): Promise<{ jobId: string; error?: string }> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('conciliacion_jobs')
        .insert({
            estado: 'pendiente',
            usuario_id: usuarioId,
            archivo_sabana: archivoSabana,
            total_comprobantes: totalComprobantes,
            comprobantes_procesados: 0,
            progreso_porcentaje: 0
        })
        .select('id')
        .single()

    if (error) {
        console.error('[AsyncJob] Error creando job:', error)
        return { jobId: '', error: error.message }
    }

    return { jobId: data.id }
}

/**
 * Actualiza el progreso de un job
 */
export async function actualizarProgresoJob(
    jobId: string,
    progreso: {
        comprobantesProcesados?: number
        progresoPorcentaje?: number
        estado?: EstadoJob
        errorMensaje?: string
        sesionId?: string
        resultadoResumen?: ConciliacionJob['resultado_resumen']
    }
): Promise<void> {
    const supabase = await createClient()

    const updateData: Partial<ConciliacionJob> = {
        updated_at: new Date().toISOString()
    }

    if (progreso.comprobantesProcesados !== undefined) {
        updateData.comprobantes_procesados = progreso.comprobantesProcesados
    }
    if (progreso.progresoPorcentaje !== undefined) {
        updateData.progreso_porcentaje = progreso.progresoPorcentaje
    }
    if (progreso.estado) {
        updateData.estado = progreso.estado
    }
    if (progreso.errorMensaje) {
        updateData.error_mensaje = progreso.errorMensaje
    }
    if (progreso.sesionId) {
        updateData.sesion_id = progreso.sesionId
    }
    if (progreso.resultadoResumen) {
        updateData.resultado_resumen = progreso.resultadoResumen
    }

    const { error } = await supabase
        .from('conciliacion_jobs')
        .update(updateData)
        .eq('id', jobId)

    if (error) {
        console.error('[AsyncJob] Error actualizando progreso:', error)
    }
}

/**
 * Obtiene el estado de un job
 */
export async function obtenerEstadoJob(
    jobId: string
): Promise<{ job?: ConciliacionJob; error?: string }> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('conciliacion_jobs')
        .select('*')
        .eq('id', jobId)
        .single()

    if (error) {
        return { error: error.message }
    }

    return { job: data as ConciliacionJob }
}

/**
 * Obtiene jobs pendientes para procesamiento en background
 */
export async function obtenerJobsPendientes(
    limite: number = 5
): Promise<ConciliacionJob[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('conciliacion_jobs')
        .select('*')
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: true })
        .limit(limite)

    if (error) {
        console.error('[AsyncJob] Error obteniendo jobs pendientes:', error)
        return []
    }

    return data as ConciliacionJob[]
}

/**
 * Verifica si hay jobs en proceso para un usuario
 */
export async function tieneJobsActivos(usuarioId: string): Promise<boolean> {
    const supabase = await createClient()

    const { count, error } = await supabase
        .from('conciliacion_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('usuario_id', usuarioId)
        .in('estado', ['pendiente', 'procesando'])

    if (error) {
        console.error('[AsyncJob] Error verificando jobs activos:', error)
        return false
    }

    return (count || 0) > 0
}

/**
 * Cancela un job pendiente
 */
export async function cancelarJob(jobId: string): Promise<boolean> {
    const supabase = await createClient()

    const { error } = await supabase
        .from('conciliacion_jobs')
        .update({
            estado: 'cancelado',
            updated_at: new Date().toISOString()
        })
        .eq('id', jobId)
        .eq('estado', 'pendiente') // Solo cancelar si está pendiente

    return !error
}
