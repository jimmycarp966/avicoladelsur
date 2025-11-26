'use server'

import { createClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@/types/api.types'
import { reporteFiltrosSchema } from '@/lib/schemas/reportes.schema'
import { subDays, format } from 'date-fns'

interface ReporteFiltrosInput {
  fechaDesde: string
  fechaHasta: string
  metodoPago?: string | null
}

/**
 * Obtiene KPIs de tesorería
 */
export async function obtenerKpisTesoreria(
  filtros: ReporteFiltrosInput
): Promise<ApiResponse<any>> {
  try {
    const supabase = await createClient()

    const validated = reporteFiltrosSchema.parse({
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta,
      metodoPago: filtros.metodoPago,
    })

    // Obtener movimientos del período
    let query = supabase
      .from('tesoreria_movimientos')
      .select('tipo, monto, metodo_pago, created_at, caja_id, tesoreria_cajas!inner(nombre)')
      .gte('created_at', `${validated.fechaDesde}T00:00:00`)
      .lte('created_at', `${validated.fechaHasta}T23:59:59`)

    if (validated.metodoPago) {
      query = query.eq('metodo_pago', validated.metodoPago)
    }

    const { data: movimientos, error } = await query

    if (error) throw error

    // Calcular totales por método de pago
    const totalesPorMetodo: Record<string, number> = {}
    let efectivoTotal = 0
    let transferenciasTotal = 0
    let tarjetaTotal = 0
    let qrTotal = 0
    let cuentaCorrienteTotal = 0

    movimientos?.forEach((mov) => {
      if (mov.tipo === 'ingreso') {
        const metodo = mov.metodo_pago || 'efectivo'
        if (!totalesPorMetodo[metodo]) {
          totalesPorMetodo[metodo] = 0
        }
        totalesPorMetodo[metodo] += Number(mov.monto || 0)

        switch (metodo) {
          case 'efectivo':
            efectivoTotal += Number(mov.monto || 0)
            break
          case 'transferencia':
            transferenciasTotal += Number(mov.monto || 0)
            break
          case 'tarjeta':
            tarjetaTotal += Number(mov.monto || 0)
            break
          case 'qr':
            qrTotal += Number(mov.monto || 0)
            break
          case 'cuenta_corriente':
            cuentaCorrienteTotal += Number(mov.monto || 0)
            break
        }
      }
    })

    // Obtener total rendido por camioneta (desde rutas validadas)
    const { data: rutasValidadas } = await supabase
      .from('rutas_reparto')
      .select('id, recaudacion_registrada, recaudacion_recibida')
      .gte('fecha_ruta', validated.fechaDesde)
      .lte('fecha_ruta', validated.fechaHasta)
      .not('recaudacion_registrada', 'is', null)

    const totalRendido = rutasValidadas?.reduce(
      (sum, r) => sum + Number(r.recaudacion_recibida || r.recaudacion_registrada || 0),
      0
    ) || 0

    const diferencias = rutasValidadas
      ?.filter((r) => {
        const registrado = Number(r.recaudacion_registrada || 0)
        const recibido = Number(r.recaudacion_recibida || 0)
        return Math.abs(registrado - recibido) > 0.01
      })
      .map((r) => ({
        ruta_id: r.id,
        diferencia: Number(r.recaudacion_recibida || 0) - Number(r.recaudacion_registrada || 0),
      })) || []

    // Comparar con semana anterior
    const fechaInicio = new Date(validated.fechaDesde)
    const fechaFin = new Date(validated.fechaHasta)
    const diasPeriodo = Math.ceil((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24))
    const fechaInicioAnterior = subDays(fechaInicio, diasPeriodo + 1)
    const fechaFinAnterior = subDays(fechaInicio, 1)

    const { data: movimientosAnterior } = await supabase
      .from('tesoreria_movimientos')
      .select('monto')
      .gte('created_at', format(fechaInicioAnterior, 'yyyy-MM-dd'))
      .lte('created_at', format(fechaFinAnterior, 'yyyy-MM-dd'))
      .eq('tipo', 'ingreso')

    const recaudacionAnterior =
      movimientosAnterior?.reduce((sum, m) => sum + Number(m.monto || 0), 0) || 0
    const recaudacionActual = Object.values(totalesPorMetodo).reduce((sum, m) => sum + m, 0)
    const cambioVsAnterior =
      recaudacionAnterior > 0
        ? ((recaudacionActual - recaudacionAnterior) / recaudacionAnterior) * 100
        : 0

    return {
      success: true,
      data: {
        efectivoTotal,
        transferenciasTotal,
        tarjetaTotal,
        qrTotal,
        cuentaCorrienteTotal,
        totalRendido,
        diferencias: diferencias.length,
        diferenciasDetalle: diferencias,
        recaudacionActual,
        recaudacionAnterior,
        cambioVsAnterior,
        totalesPorMetodo: Object.entries(totalesPorMetodo).map(([metodo, monto]) => ({
          metodo,
          monto,
        })),
      },
    }
  } catch (error: any) {
    console.error('Error al obtener KPIs de tesorería:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener KPIs de tesorería',
    }
  }
}

/**
 * Obtiene recaudación diaria vs semana anterior
 */
export async function obtenerRecaudacionDiaria(
  filtros: ReporteFiltrosInput
): Promise<ApiResponse<any[]>> {
  try {
    const supabase = await createClient()

    const validated = reporteFiltrosSchema.parse({
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta,
    })

    // Obtener movimientos del período actual
    const { data: movimientosActual } = await supabase
      .from('tesoreria_movimientos')
      .select('monto, created_at')
      .gte('created_at', `${validated.fechaDesde}T00:00:00`)
      .lte('created_at', `${validated.fechaHasta}T23:59:59`)
      .eq('tipo', 'ingreso')

    // Obtener movimientos de la semana anterior
    const fechaInicio = new Date(validated.fechaDesde)
    const fechaFin = new Date(validated.fechaHasta)
    const diasPeriodo = Math.ceil((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24))
    const fechaInicioAnterior = subDays(fechaInicio, diasPeriodo + 1)
    const fechaFinAnterior = subDays(fechaInicio, 1)

    const { data: movimientosAnterior } = await supabase
      .from('tesoreria_movimientos')
      .select('monto, created_at')
      .gte('created_at', format(fechaInicioAnterior, 'yyyy-MM-dd'))
      .lte('created_at', format(fechaFinAnterior, 'yyyy-MM-dd'))
      .eq('tipo', 'ingreso')

    // Agrupar por día
    const actualPorDia: Record<string, number> = {}
    movimientosActual?.forEach((mov) => {
      const fecha = new Date(mov.created_at).toISOString().split('T')[0]
      if (!actualPorDia[fecha]) {
        actualPorDia[fecha] = 0
      }
      actualPorDia[fecha] += Number(mov.monto || 0)
    })

    const anteriorPorDia: Record<string, number> = {}
    movimientosAnterior?.forEach((mov) => {
      const fecha = new Date(mov.created_at).toISOString().split('T')[0]
      if (!anteriorPorDia[fecha]) {
        anteriorPorDia[fecha] = 0
      }
      anteriorPorDia[fecha] += Number(mov.monto || 0)
    })

    // Combinar datos
    const todasLasFechas = new Set([
      ...Object.keys(actualPorDia),
      ...Object.keys(anteriorPorDia),
    ])

    const resultado = Array.from(todasLasFechas)
      .map((fecha) => ({
        fecha,
        actual: actualPorDia[fecha] || 0,
        anterior: anteriorPorDia[fecha] || 0,
      }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))

    return {
      success: true,
      data: resultado,
    }
  } catch (error: any) {
    console.error('Error al obtener recaudación diaria:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener recaudación diaria',
    }
  }
}

