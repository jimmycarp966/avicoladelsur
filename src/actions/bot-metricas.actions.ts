'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Resultado de métricas del bot
 */
export interface BotMetricasResult {
  fecha: Date
  total_mensajes: number
  mensajes_exitosos: number
  mensajes_fallidos: number
  presupuestos_creados: number
  tiempo_respuesta_promedio_ms: number | null
}

/**
 * Resultado de ranking de productos
 */
export interface ProductoMetricasResult {
  producto_id: string
  producto_nombre: string
  producto_codigo: string
  veces_pedido: number
  cantidad_total: number
}

/**
 * Obtiene métricas diarias del bot en un rango de fechas
 */
export async function obtenerMetricasBotAction(params: {
  fechaDesde?: string
  fechaHasta?: string
}): Promise<{ data?: BotMetricasResult[]; error?: string }> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('obtener_metricas_bot', {
      p_fecha_desde: params.fechaDesde || null,
      p_fecha_hasta: params.fechaHasta || null
    })

    if (error) {
      console.error('[Bot Métricas] Error:', error)
      return { error: error.message }
    }

    return {
      data: (data || []).map((m: any) => ({
        fecha: new Date(m.fecha),
        total_mensajes: Number(m.total_mensajes),
        mensajes_exitosos: Number(m.mensajes_exitosos),
        mensajes_fallidos: Number(m.mensajes_fallidos),
        presupuestos_creados: Number(m.presupuestos_creados),
        tiempo_respuesta_promedio_ms: m.tiempo_respuesta_promedio_ms
          ? Number(m.tiempo_respuesta_promedio_ms)
          : null
      }))
    }
  } catch (error: any) {
    console.error('[Bot Métricas] Error:', error)
    return { error: error.message || 'Error desconocido' }
  }
}

/**
 * Obtiene ranking de productos más pedidos vía bot
 */
export async function obtenerProductosMasPedidosAction(params: {
  fechaDesde?: string
  fechaHasta?: string
  limite?: number
}): Promise<{ data?: ProductoMetricasResult[]; error?: string }> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('obtener_productos_mas_pedidos', {
      p_fecha_desde: params.fechaDesde || null,
      p_fecha_hasta: params.fechaHasta || null,
      p_limite: params.limite || 10
    })

    if (error) {
      console.error('[Bot Métricas] Error:', error)
      return { error: error.message }
    }

    return {
      data: (data || []).map((m: any) => ({
        producto_id: m.producto_id,
        producto_nombre: m.producto_nombre,
        producto_codigo: m.producto_codigo,
        veces_pedido: Number(m.veces_pedido),
        cantidad_total: Number(m.cantidad_total)
      }))
    }
  } catch (error: any) {
    console.error('[Bot Métricas] Error:', error)
    return { error: error.message || 'Error desconocido' }
  }
}

/**
 * Obtiene resumen agregado de métricas
 */
export async function obtenerResumenMetricasBotAction(params: {
  fechaDesde?: string
  fechaHasta?: string
}): Promise<{
  data?: {
    totalMensajes: number
    totalPresupuestos: number
    tasaConversion: number
    tiempoPromedio: string
  }
  error?: string
}> {
  try {
    const result = await obtenerMetricasBotAction(params)

    if (result.error || !result.data) {
      return { error: result.error }
    }

    const metricas = result.data

    // Calcular agregados
    const totalMensajes = metricas.reduce((sum, m) => sum + m.total_mensajes, 0)
    const totalPresupuestos = metricas.reduce((sum, m) => sum + m.presupuestos_creados, 0)
    const tasaConversion = totalMensajes > 0
      ? (totalPresupuestos / totalMensajes) * 100
      : 0

    const tiemposValidos = metricas
      .filter(m => m.tiempo_respuesta_promedio_ms !== null)
      .map(m => m.tiempo_respuesta_promedio_ms!)
      .filter((t): t is number => t !== null)

    const tiempoPromedioMs = tiemposValidos.length > 0
      ? tiemposValidos.reduce((sum, t) => sum + t, 0) / tiemposValidos.length
      : 0

    const tiempoPromedio = tiempoPromedioMs >= 1000
      ? `${(tiempoPromedioMs / 1000).toFixed(1)}s`
      : `${Math.round(tiempoPromedioMs)}ms`

    return {
      data: {
        totalMensajes,
        totalPresupuestos,
        tasaConversion: Number(tasaConversion.toFixed(1)),
        tiempoPromedio
      }
    }
  } catch (error: any) {
    console.error('[Bot Métricas] Error:', error)
    return { error: error.message || 'Error desconocido' }
  }
}
