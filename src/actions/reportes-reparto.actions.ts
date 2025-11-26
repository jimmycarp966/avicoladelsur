'use server'

import { createClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@/types/api.types'
import { reporteFiltrosSchema } from '@/lib/schemas/reportes.schema'

interface ReporteFiltrosInput {
  fechaDesde: string
  fechaHasta: string
  zonaId?: string | null
  vehiculoId?: string | null
}

/**
 * Obtiene KPIs de reparto
 */
export async function obtenerKpisReparto(
  filtros: ReporteFiltrosInput
): Promise<ApiResponse<any>> {
  try {
    const supabase = await createClient()

    const validated = reporteFiltrosSchema.parse({
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta,
      zonaId: filtros.zonaId,
      vehiculoId: filtros.vehiculoId,
    })

    // Obtener rutas del período
    let query = supabase
      .from('rutas_reparto')
      .select(
        `
        id,
        estado,
        fecha_ruta,
        distancia_real_km,
        tiempo_real_min,
        peso_total_kg,
        vehiculo_id,
        repartidor_id,
        detalles_ruta(id, estado_entrega, distancia_parcial_km, tiempo_estimado_parcial_min)
      `
      )
      .gte('fecha_ruta', validated.fechaDesde)
      .lte('fecha_ruta', validated.fechaHasta)

    if (validated.vehiculoId) {
      query = query.eq('vehiculo_id', validated.vehiculoId)
    }

    const { data: rutas, error } = await query

    if (error) throw error

    // Calcular KPIs
    const rutasCompletadas = rutas?.filter((r) => r.estado === 'completada').length || 0
    const totalEntregas = rutas?.reduce(
      (sum, r) => sum + (r.detalles_ruta?.length || 0),
      0
    ) || 0
    const entregasExitosas =
      rutas?.reduce(
        (sum, r) =>
          sum +
          (r.detalles_ruta?.filter((d: any) => d.estado_entrega === 'entregado').length || 0),
        0
      ) || 0
    const entregasFallidas = totalEntregas - entregasExitosas

    const tiempoPromedioEntrega =
      rutas?.reduce((sum, r) => sum + (r.tiempo_real_min || 0), 0) / (rutas?.length || 1) || 0

    const kmTotales = rutas?.reduce((sum, r) => sum + Number(r.distancia_real_km || 0), 0) || 0
    const eficienciaRuta =
      totalEntregas > 0 ? kmTotales / totalEntregas : 0 // km por entrega

    // Obtener recaudación por vehículo
    const { data: movimientos } = await supabase
      .from('tesoreria_movimientos')
      .select('monto, origen_id')
      .gte('created_at', `${validated.fechaDesde}T00:00:00`)
      .lte('created_at', `${validated.fechaHasta}T23:59:59`)
      .eq('tipo', 'ingreso')
      .eq('origen_tipo', 'pedido')

    // Obtener pedidos de las rutas para calcular recaudación
    const rutasIds = rutas?.map((r) => r.id) || []
    const { data: detallesRuta } = await supabase
      .from('detalles_ruta')
      .select('ruta_id, pedido_id')
      .in('ruta_id', rutasIds)

    const pedidosIds = Array.from(
      new Set(detallesRuta?.map((d) => d.pedido_id) || [])
    ) as string[]

    const recaudacionPorVehiculo: Record<string, number> = {}
    rutas?.forEach((ruta) => {
      const vehiculoId = ruta.vehiculo_id
      const pedidosRuta = detallesRuta
        ?.filter((d) => d.ruta_id === ruta.id)
        .map((d) => d.pedido_id) || []

      const recaudacionRuta =
        movimientos
          ?.filter((m) => pedidosRuta.includes(m.origen_id))
          .reduce((sum, m) => sum + Number(m.monto || 0), 0) || 0

      if (!recaudacionPorVehiculo[vehiculoId]) {
        recaudacionPorVehiculo[vehiculoId] = 0
      }
      recaudacionPorVehiculo[vehiculoId] += recaudacionRuta
    })

    return {
      success: true,
      data: {
        entregasCompletadas: rutasCompletadas,
        entregasExitosas,
        entregasFallidas,
        tasaExito: totalEntregas > 0 ? (entregasExitosas / totalEntregas) * 100 : 0,
        tiempoPromedioEntrega,
        kmTotales,
        eficienciaRuta,
        recaudacionPorVehiculo: Object.entries(recaudacionPorVehiculo).map(([id, monto]) => ({
          vehiculo_id: id,
          recaudacion: monto,
        })),
      },
    }
  } catch (error: any) {
    console.error('Error al obtener KPIs de reparto:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener KPIs de reparto',
    }
  }
}

/**
 * Obtiene ranking de repartidores
 */
export async function obtenerRankingRepartidores(
  filtros: ReporteFiltrosInput
): Promise<ApiResponse<any[]>> {
  try {
    const supabase = await createClient()

    const validated = reporteFiltrosSchema.parse({
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta,
    })

    const { data: rutas } = await supabase
      .from('rutas_reparto')
      .select(
        `
        id,
        repartidor_id,
        tiempo_real_min,
        distancia_real_km,
        detalles_ruta(id, estado_entrega)
      `
      )
      .gte('fecha_ruta', validated.fechaDesde)
      .lte('fecha_ruta', validated.fechaHasta)
      .eq('estado', 'completada')

    const rendimientoPorRepartidor: Record<
      string,
      {
        repartidor_id: string
        rutas: number
        entregas: number
        entregasExitosas: number
        tiempoTotal: number
        kmTotal: number
      }
    > = {}

    rutas?.forEach((ruta) => {
      const repartidorId = ruta.repartidor_id
      if (!rendimientoPorRepartidor[repartidorId]) {
        rendimientoPorRepartidor[repartidorId] = {
          repartidor_id: repartidorId,
          rutas: 0,
          entregas: 0,
          entregasExitosas: 0,
          tiempoTotal: 0,
          kmTotal: 0,
        }
      }
      rendimientoPorRepartidor[repartidorId].rutas += 1
      rendimientoPorRepartidor[repartidorId].entregas += ruta.detalles_ruta?.length || 0
      rendimientoPorRepartidor[repartidorId].entregasExitosas +=
        ruta.detalles_ruta?.filter((d: any) => d.estado_entrega === 'entregado').length || 0
      rendimientoPorRepartidor[repartidorId].tiempoTotal += ruta.tiempo_real_min || 0
      rendimientoPorRepartidor[repartidorId].kmTotal += Number(ruta.distancia_real_km || 0)
    })

    // Obtener nombres de repartidores
    const repartidoresIds = Object.keys(rendimientoPorRepartidor)
    const { data: repartidores } = await supabase
      .from('usuarios')
      .select('id, nombre, apellido')
      .in('id', repartidoresIds)

    const resultado = Object.values(rendimientoPorRepartidor)
      .map((rend) => {
        const repartidor = repartidores?.find((r) => r.id === rend.repartidor_id)
        return {
          repartidor_id: rend.repartidor_id,
          repartidor_nombre: `${repartidor?.nombre || ''} ${repartidor?.apellido || ''}`.trim(),
          rutas: rend.rutas,
          entregas: rend.entregas,
          entregasExitosas: rend.entregasExitosas,
          tasaExito: rend.entregas > 0 ? (rend.entregasExitosas / rend.entregas) * 100 : 0,
          tiempoPromedio: rend.rutas > 0 ? rend.tiempoTotal / rend.rutas : 0,
          entregasPorHora: rend.tiempoTotal > 0 ? (rend.entregas / rend.tiempoTotal) * 60 : 0,
          kmPorEntrega: rend.entregas > 0 ? rend.kmTotal / rend.entregas : 0,
        }
      })
      .sort((a, b) => b.entregasPorHora - a.entregasPorHora)

    return {
      success: true,
      data: resultado,
    }
  } catch (error: any) {
    console.error('Error al obtener ranking de repartidores:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener ranking de repartidores',
    }
  }
}

