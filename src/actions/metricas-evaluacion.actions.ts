'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { devError } from '@/lib/utils/logger'
import type { ApiResponse } from '@/types/api.types'

// ========== MÉTRICAS DE EVALUACIÓN (HUELLA DIGITAL OPERATIVA) ==========

export interface MetricasEvaluacion {
    empleado: {
        id: string
        categoria: string | null
        sucursal_id: string | null
        fecha_ingreso: string | null
    }
    periodo: {
        mes: number
        anio: number
        fecha_inicio: string
        fecha_fin: string
    }
    puntualidad: {
        dias_presentes: number
        dias_tarde: number
        dias_ausente: number
        dias_licencia: number
        faltas_sin_aviso: number
        retraso_promedio_min: number
        retraso_total_min: number
        total_dias_registrados: number
        licencias_aprobadas: number
    }
    rendimiento: {
        ventas: {
            total_pedidos: number
            monto_total: number
            pedidos_entregados: number
            pedidos_cancelados: number
        } | null
        produccion: {
            ordenes_completadas: number
            ordenes_total: number
            kg_producidos: number
        } | null
        reparto: {
            rutas_completadas: number
            rutas_total: number
            entregas_exitosas: number
            entregas_fallidas: number
        } | null
        categoria: string
    }
    responsabilidad: {
        caja: {
            cierres_total: number
            cierres_con_diferencia: number
            diferencia_total: number
            diferencia_promedio: number
        } | null
        descuentos: {
            total_descuentos: number
            multas: number
            monto_total: number
        } | null
    }
    trabajo_equipo: {
        novedades_periodo: number
        placeholder: string
    }
    actitud: {
        sanciones_periodo: number
        sanciones_historicas: number
        evaluaciones_previas: {
            cantidad: number
            promedio_historico: number
            ultima_evaluacion: string | null
        } | null
    }
}

/**
 * Obtiene métricas objetivas del ERP para las 5 dimensiones de evaluación.
 * Primero intenta con la RPC fn_obtener_metricas_evaluacion.
 * Si no existe la RPC, usa queries directas como fallback.
 */
export async function obtenerMetricasEvaluacionAction(
    empleadoId: string,
    mes: number,
    anio: number
): Promise<ApiResponse<MetricasEvaluacion>> {
    try {
        const adminSupabase = createAdminClient()

        // Intentar con la RPC primero
        const { data, error } = await adminSupabase.rpc('fn_obtener_metricas_evaluacion', {
            p_empleado_id: empleadoId,
            p_mes: mes,
            p_anio: anio,
        })

        if (error) {
            // Si la RPC no existe, hacer fallback con queries directas
            if (error.message.includes('function') || error.code === '42883') {
                return await obtenerMetricasFallback(empleadoId, mes, anio)
            }
            devError('Error al obtener métricas de evaluación:', error)
            return {
                success: false,
                error: 'Error al obtener métricas: ' + error.message,
            }
        }

        return {
            success: true,
            data: data as MetricasEvaluacion,
        }
    } catch (error) {
        devError('Error en obtenerMetricasEvaluacion:', error)
        return {
            success: false,
            error: 'Error interno del servidor',
        }
    }
}

// Fallback: queries directas si la RPC no está disponible
async function obtenerMetricasFallback(
    empleadoId: string,
    mes: number,
    anio: number
): Promise<ApiResponse<MetricasEvaluacion>> {
    try {
        const adminSupabase = createAdminClient()
        const fechaInicio = `${anio}-${String(mes).padStart(2, '0')}-01`
        const lastDay = new Date(anio, mes, 0).getDate()
        const fechaFin = `${anio}-${String(mes).padStart(2, '0')}-${lastDay}`

        // Obtener empleado con categoría
        const { data: empleado } = await adminSupabase
            .from('rrhh_empleados')
            .select('*, categoria:rrhh_categorias(nombre)')
            .eq('id', empleadoId)
            .single()

        if (!empleado) {
            return { success: false, error: 'Empleado no encontrado' }
        }

        // ========== 1. PUNTUALIDAD ==========
        const { data: asistencias } = await adminSupabase
            .from('rrhh_asistencia')
            .select('*')
            .eq('empleado_id', empleadoId)
            .gte('fecha', fechaInicio)
            .lte('fecha', fechaFin)

        const asist = asistencias || []
        const presentes = asist.filter(a => a.estado === 'presente').length
        const tardes = asist.filter(a => a.estado === 'tarde').length
        const ausentes = asist.filter(a => a.estado === 'ausente').length
        const licenciasAsist = asist.filter(a => a.estado === 'licencia').length
        const faltasSinAviso = asist.filter(a => a.falta_sin_aviso).length
        const retrasos = asist.filter(a => a.retraso_minutos > 0)
        const retrasoPromedio = retrasos.length > 0
            ? Math.round(retrasos.reduce((s, a) => s + a.retraso_minutos, 0) / retrasos.length * 10) / 10
            : 0
        const retrasoTotal = asist.reduce((s, a) => s + (a.retraso_minutos || 0), 0)

        // Licencias aprobadas del periodo
        const { count: licenciasAprobadas } = await adminSupabase
            .from('rrhh_licencias')
            .select('*', { count: 'exact', head: true })
            .eq('empleado_id', empleadoId)
            .eq('aprobado', true)
            .lte('fecha_inicio', fechaFin)
            .gte('fecha_fin', fechaInicio)

        // ========== 2. RENDIMIENTO ==========
        const { data: pedidos } = await adminSupabase
            .from('pedidos')
            .select('id, total, estado')
            .eq('vendedor_id', empleado.usuario_id)
            .gte('fecha_pedido', fechaInicio)
            .lte('fecha_pedido', fechaFin)

        const peds = pedidos || []

        // ========== 3. RESPONSABILIDAD ==========
        const { data: descuentos } = await adminSupabase
            .from('rrhh_descuentos')
            .select('*')
            .eq('empleado_id', empleadoId)
            .gte('fecha', fechaInicio)
            .lte('fecha', fechaFin)

        const descs = descuentos || []

        // Sanciones históricas (todas las multas del empleado)
        const { count: sancionesHistoricas } = await adminSupabase
            .from('rrhh_descuentos')
            .select('*', { count: 'exact', head: true })
            .eq('empleado_id', empleadoId)
            .eq('tipo', 'multa')

        // ========== 4. EVALUACIONES PREVIAS ==========
        const { data: evalsPrevias } = await adminSupabase
            .from('rrhh_evaluaciones')
            .select('promedio, fecha_evaluacion')
            .eq('empleado_id', empleadoId)
            .eq('estado', 'completada')

        const evalsArr = evalsPrevias || []
        const promedioHist = evalsArr.length > 0
            ? Math.round(evalsArr.reduce((s, e) => s + (e.promedio || 0), 0) / evalsArr.length * 100) / 100
            : 0

        // Novedades del periodo (para trabajo en equipo)
        const { count: novedadesPeriodo } = await adminSupabase
            .from('rrhh_novedades')
            .select('*', { count: 'exact', head: true })
            .eq('activo', true)
            .gte('fecha_publicacion', fechaInicio)
            .lte('fecha_publicacion', fechaFin)

        const categoriaNombre = (empleado.categoria as any)?.nombre || 'Sin categoría'

        const metricas: MetricasEvaluacion = {
            empleado: {
                id: empleado.id,
                categoria: categoriaNombre,
                sucursal_id: empleado.sucursal_id,
                fecha_ingreso: empleado.fecha_ingreso,
            },
            periodo: {
                mes,
                anio,
                fecha_inicio: fechaInicio,
                fecha_fin: fechaFin,
            },
            puntualidad: {
                dias_presentes: presentes,
                dias_tarde: tardes,
                dias_ausente: ausentes,
                dias_licencia: licenciasAsist,
                faltas_sin_aviso: faltasSinAviso,
                retraso_promedio_min: retrasoPromedio,
                retraso_total_min: retrasoTotal,
                total_dias_registrados: asist.length,
                licencias_aprobadas: licenciasAprobadas || 0,
            },
            rendimiento: {
                ventas: {
                    total_pedidos: peds.length,
                    monto_total: peds.reduce((s, p) => s + (p.total || 0), 0),
                    pedidos_entregados: peds.filter(p => p.estado === 'entregado').length,
                    pedidos_cancelados: peds.filter(p => p.estado === 'cancelado').length,
                },
                produccion: null,
                reparto: null,
                categoria: categoriaNombre,
            },
            responsabilidad: {
                caja: null,
                descuentos: {
                    total_descuentos: descs.length,
                    multas: descs.filter(d => d.tipo === 'multa').length,
                    monto_total: descs.reduce((s, d) => s + (d.monto || 0), 0),
                },
            },
            trabajo_equipo: {
                novedades_periodo: novedadesPeriodo || 0,
                placeholder: 'Métricas de colaboración requieren datos adicionales',
            },
            actitud: {
                sanciones_periodo: descs.filter(d => d.tipo === 'multa').length,
                sanciones_historicas: sancionesHistoricas || 0,
                evaluaciones_previas: {
                    cantidad: evalsArr.length,
                    promedio_historico: promedioHist,
                    ultima_evaluacion: evalsArr.length > 0
                        ? evalsArr.sort((a, b) => (b.fecha_evaluacion || '').localeCompare(a.fecha_evaluacion || ''))[0].fecha_evaluacion
                        : null,
                },
            },
        }

        return { success: true, data: metricas }
    } catch (error) {
        devError('Error en obtenerMetricasFallback:', error)
        return { success: false, error: 'Error interno del servidor' }
    }
}
