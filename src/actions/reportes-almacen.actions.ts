'use server'

import { createClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@/types/api.types'
import { reporteFiltrosSchema } from '@/lib/schemas/reportes.schema'

interface ReporteFiltrosInput {
  fechaDesde: string
  fechaHasta: string
}

/**
 * Obtiene KPIs de almacén
 */
export async function obtenerKpisAlmacen(
  filtros: ReporteFiltrosInput
): Promise<ApiResponse<any>> {
  try {
    const supabase = await createClient()

    const validated = reporteFiltrosSchema.parse({
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta,
    })

    // Obtener presupuestos procesados en almacén
    const { data: presupuestos } = await supabase
      .from('presupuestos')
      .select(
        `
        id,
        created_at,
        updated_at,
        estado,
        usuario_almacen,
        presupuesto_items(id, cantidad_solicitada, peso_final, pesable)
      `
      )
      .gte('created_at', `${validated.fechaDesde}T00:00:00`)
      .lte('created_at', `${validated.fechaHasta}T23:59:59`)
      .eq('estado', 'facturado')

    // Calcular tiempo promedio de preparación
    const tiemposPreparacion: number[] = []
    let totalKgDespachados = 0
    const variacionesPeso: Array<{ producto_id: string; variacion: number }> = []

    presupuestos?.forEach((pres) => {
      if (pres.updated_at && pres.created_at) {
        const tiempo =
          new Date(pres.updated_at).getTime() - new Date(pres.created_at).getTime()
        tiemposPreparacion.push(tiempo / (1000 * 60)) // en minutos
      }

      pres.presupuesto_items?.forEach((item: any) => {
        if (item.pesable && item.peso_final) {
          totalKgDespachados += Number(item.peso_final || 0)

          if (item.cantidad_solicitada) {
            const variacion =
              ((Number(item.peso_final) - Number(item.cantidad_solicitada)) /
                Number(item.cantidad_solicitada)) *
              100
            variacionesPeso.push({
              producto_id: item.id,
              variacion,
            })
          }
        }
      })
    })

    const tiempoPromedioPreparacion =
      tiemposPreparacion.length > 0
        ? tiemposPreparacion.reduce((a, b) => a + b, 0) / tiemposPreparacion.length
        : 0

    const variacionPromedio =
      variacionesPeso.length > 0
        ? variacionesPeso.reduce((a, b) => a + b.variacion, 0) / variacionesPeso.length
        : 0

    // Obtener rendimiento por operario
    const { data: operarios } = await supabase
      .from('presupuestos')
      .select('usuario_almacen, id')
      .gte('created_at', `${validated.fechaDesde}T00:00:00`)
      .lte('created_at', `${validated.fechaHasta}T23:59:59`)
      .not('usuario_almacen', 'is', null)

    const rendimientoPorOperario: Record<string, { presupuestos: number }> = {}
    operarios?.forEach((op) => {
      const operarioId = op.usuario_almacen
      if (!rendimientoPorOperario[operarioId]) {
        rendimientoPorOperario[operarioId] = { presupuestos: 0 }
      }
      rendimientoPorOperario[operarioId].presupuestos += 1
    })

    return {
      success: true,
      data: {
        tiempoPromedioPreparacion,
        variacionPromedio,
        totalKgDespachados,
        presupuestosProcesados: presupuestos?.length || 0,
        rendimientoPorOperario: Object.entries(rendimientoPorOperario).map(([id, datos]) => ({
          operario_id: id,
          presupuestos: datos.presupuestos,
        })),
        variacionesPeso: variacionesPeso.slice(0, 20),
      },
    }
  } catch (error: any) {
    console.error('Error al obtener KPIs de almacén:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener KPIs de almacén',
    }
  }
}

/**
 * Obtiene variación de peso por producto
 */
export async function obtenerVariacionPeso(
  filtros: ReporteFiltrosInput
): Promise<ApiResponse<any[]>> {
  try {
    const supabase = await createClient()

    const validated = reporteFiltrosSchema.parse({
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta,
    })

    const { data: items } = await supabase
      .from('presupuesto_items')
      .select(
        `
        cantidad_solicitada,
        peso_final,
        productos!inner(id, nombre, categoria)
      `
      )
      .not('peso_final', 'is', null)
      .eq('pesable', true)
      .gte('created_at', `${validated.fechaDesde}T00:00:00`)
      .lte('created_at', `${validated.fechaHasta}T23:59:59`)

    const variacionesPorProducto: Record<
      string,
      { producto: any; variaciones: number[]; total: number }
    > = {}

    items?.forEach((item: any) => {
      if (item.peso_final && item.cantidad_solicitada) {
        const productoId = item.productos?.id
        const variacion =
          ((Number(item.peso_final) - Number(item.cantidad_solicitada)) /
            Number(item.cantidad_solicitada)) *
          100

        if (!variacionesPorProducto[productoId]) {
          variacionesPorProducto[productoId] = {
            producto: item.productos,
            variaciones: [],
            total: 0,
          }
        }
        variacionesPorProducto[productoId].variaciones.push(variacion)
        variacionesPorProducto[productoId].total += 1
      }
    })

    const resultado = Object.entries(variacionesPorProducto).map(([productoId, datos]) => {
      const promedio =
        datos.variaciones.length > 0
          ? datos.variaciones.reduce((a, b) => a + b, 0) / datos.variaciones.length
          : 0
      return {
        producto_id: productoId,
        producto_nombre: datos.producto?.nombre,
        producto_categoria: datos.producto?.categoria,
        variacion_promedio: promedio,
        cantidad_items: datos.total,
      }
    })

    return {
      success: true,
      data: resultado.sort((a, b) => Math.abs(b.variacion_promedio) - Math.abs(a.variacion_promedio)),
    }
  } catch (error: any) {
    console.error('Error al obtener variación de peso:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener variación de peso',
    }
  }
}

