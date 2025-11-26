'use server'

import { createClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@/types/api.types'
import { reporteFiltrosSchema } from '@/lib/schemas/reportes.schema'
import { subDays } from 'date-fns'

interface ReporteFiltrosInput {
  fechaDesde: string
  fechaHasta: string
  categoria?: string | null
}

/**
 * Obtiene KPIs de stock
 */
export async function obtenerKpisStock(
  filtros: ReporteFiltrosInput
): Promise<ApiResponse<any>> {
  try {
    const supabase = await createClient()

    const validated = reporteFiltrosSchema.parse({
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta,
      categoria: filtros.categoria,
    })

    // Stock crítico (productos bajo mínimo)
    const { data: stockCritico } = await supabase
      .from('lotes')
      .select(
        `
        cantidad_disponible,
        productos!inner(id, nombre, stock_minimo, categoria)
      `
      )
      .eq('estado', 'disponible')
      .eq('productos.activo', true)

    const productosCriticos = (stockCritico || []).filter((lote: any) => {
      const producto = lote.productos
      return (
        Number(lote.cantidad_disponible || 0) < Number(producto?.stock_minimo || 0) &&
        (!validated.categoria || producto?.categoria === validated.categoria)
      )
    })

    // Movimientos por día
    const { data: movimientos } = await supabase
      .from('movimientos_stock')
      .select('id, tipo_movimiento, cantidad, created_at')
      .gte('created_at', `${validated.fechaDesde}T00:00:00`)
      .lte('created_at', `${validated.fechaHasta}T23:59:59`)

    const movimientosPorDia = (movimientos || []).reduce((acc: any, mov: any) => {
      const fecha = new Date(mov.created_at).toISOString().split('T')[0]
      if (!acc[fecha]) {
        acc[fecha] = { ingresos: 0, salidas: 0 }
      }
      if (mov.tipo_movimiento === 'ingreso') {
        acc[fecha].ingresos += Number(mov.cantidad || 0)
      } else {
        acc[fecha].salidas += Number(mov.cantidad || 0)
      }
      return acc
    }, {})

    // Pérdidas por merma (diferencia entre peso estimado y real en presupuestos)
    const { data: mermas } = await supabase
      .from('presupuesto_items')
      .select(
        `
        cantidad_solicitada,
        peso_final,
        productos!inner(categoria)
      `
      )
      .not('peso_final', 'is', null)
      .not('pesable', 'is', false)

    let mermasKg = 0
    let mermasPesos = 0

    mermas?.forEach((item: any) => {
      if (
        item.peso_final &&
        item.cantidad_solicitada &&
        (!validated.categoria || item.productos?.categoria === validated.categoria)
      ) {
        const diferencia = Number(item.cantidad_solicitada) - Number(item.peso_final)
        if (diferencia > 0) {
          mermasKg += diferencia
          // Estimar costo (simplificado - usar precio_costo si está disponible)
          mermasPesos += diferencia * 100 // Estimación básica
        }
      }
    })

    // Rotación de inventario por categoría
    const { data: rotacion } = await supabase
      .from('movimientos_stock')
      .select(
        `
        tipo_movimiento,
        cantidad,
        lotes!inner(
          productos!inner(categoria)
        )
      `
      )
      .gte('created_at', `${validated.fechaDesde}T00:00:00`)
      .lte('created_at', `${validated.fechaHasta}T23:59:59`)
      .eq('tipo_movimiento', 'salida')

    const rotacionPorCategoria: Record<string, { salidas: number }> = {}
    rotacion?.forEach((mov: any) => {
      const categoria = mov.lotes?.productos?.categoria || 'Sin categoría'
      if (!rotacionPorCategoria[categoria]) {
        rotacionPorCategoria[categoria] = { salidas: 0 }
      }
      rotacionPorCategoria[categoria].salidas += Number(mov.cantidad || 0)
    })

    return {
      success: true,
      data: {
        stockCritico: productosCriticos.length,
        productosCriticos: productosCriticos.slice(0, 10),
        movimientosPorDia: Object.entries(movimientosPorDia).map(([fecha, datos]: [string, any]) => ({
          fecha,
          ingresos: datos.ingresos,
          salidas: datos.salidas,
        })),
        mermasKg,
        mermasPesos,
        rotacionPorCategoria: Object.entries(rotacionPorCategoria).map(([categoria, datos]: [string, any]) => ({
          categoria,
          salidas: datos.salidas,
        })),
      },
    }
  } catch (error: any) {
    console.error('Error al obtener KPIs de stock:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener KPIs de stock',
    }
  }
}

/**
 * Obtiene proyección de stock futuro (algoritmo simple)
 */
export async function obtenerProyeccionStock(
  diasProyeccion: number = 7
): Promise<ApiResponse<any[]>> {
  try {
    const supabase = await createClient()

    // Obtener ventas de los últimos 30 días por producto
    const fechaInicio = subDays(new Date(), 30)
    const fechaFin = new Date()

    const { data: ventas } = await supabase
      .from('detalles_pedido')
      .select(
        `
        producto_id,
        cantidad,
        pedidos!inner(fecha_pedido, estado)
      `
      )
      .gte('pedidos.fecha_pedido', fechaInicio.toISOString())
      .lte('pedidos.fecha_pedido', fechaFin.toISOString())
      .eq('pedidos.estado', 'entregado')

    // Calcular promedio diario por producto
    const ventasPorProducto: Record<string, { total: number; dias: Set<string> }> = {}
    ventas?.forEach((venta: any) => {
      const productoId = venta.producto_id
      const fecha = new Date(venta.pedidos?.fecha_pedido).toISOString().split('T')[0]

      if (!ventasPorProducto[productoId]) {
        ventasPorProducto[productoId] = { total: 0, dias: new Set() }
      }
      ventasPorProducto[productoId].total += Number(venta.cantidad || 0)
      ventasPorProducto[productoId].dias.add(fecha)
    })

    // Obtener stock actual y mínimo por producto
    const { data: stockActual } = await supabase
      .from('lotes')
      .select(
        `
        producto_id,
        cantidad_disponible,
        productos!inner(id, nombre, stock_minimo, categoria)
      `
      )
      .eq('estado', 'disponible')

    const stockPorProducto: Record<string, { disponible: number; minimo: number; producto: any }> = {}
    stockActual?.forEach((lote: any) => {
      const productoId = lote.producto_id
      if (!stockPorProducto[productoId]) {
        stockPorProducto[productoId] = {
          disponible: 0,
          minimo: Number(lote.productos?.stock_minimo || 0),
          producto: lote.productos,
        }
      }
      stockPorProducto[productoId].disponible += Number(lote.cantidad_disponible || 0)
    })

    // Calcular proyección
    const proyecciones = Object.entries(stockPorProducto).map(([productoId, stock]) => {
      const ventas = ventasPorProducto[productoId]
      const diasConVentas = ventas?.dias.size || 1
      const promedioDiario = ventas ? ventas.total / diasConVentas : 0
      const stockProyectado = stock.disponible - promedioDiario * diasProyeccion
      const necesitaReposicion = stockProyectado < stock.minimo

      return {
        producto_id: productoId,
        producto_nombre: stock.producto?.nombre,
        producto_categoria: stock.producto?.categoria,
        stock_actual: stock.disponible,
        stock_minimo: stock.minimo,
        promedio_venta_diaria: promedioDiario,
        stock_proyectado: Math.max(0, stockProyectado),
        dias_proyeccion: diasProyeccion,
        necesita_reposicion: necesitaReposicion,
        cantidad_recomendada: necesitaReposicion
          ? Math.ceil(stock.minimo - stockProyectado + promedioDiario * 7) // Safety stock de 7 días
          : 0,
      }
    })

    return {
      success: true,
      data: proyecciones.sort((a, b) => {
        // Ordenar por necesidad de reposición primero
        if (a.necesita_reposicion && !b.necesita_reposicion) return -1
        if (!a.necesita_reposicion && b.necesita_reposicion) return 1
        return b.cantidad_recomendada - a.cantidad_recomendada
      }),
    }
  } catch (error: any) {
    console.error('Error al obtener proyección de stock:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener proyección de stock',
    }
  }
}

/**
 * Obtiene mermas por categoría
 */
export async function obtenerMermasPorCategoria(
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
        productos!inner(categoria)
      `
      )
      .not('peso_final', 'is', null)
      .eq('pesable', true)
      .gte('created_at', `${validated.fechaDesde}T00:00:00`)
      .lte('created_at', `${validated.fechaHasta}T23:59:59`)

    const mermasPorCategoria: Record<string, { kg: number; items: number }> = {}

    items?.forEach((item: any) => {
      if (item.peso_final && item.cantidad_solicitada) {
        const diferencia = Number(item.cantidad_solicitada) - Number(item.peso_final)
        if (diferencia > 0) {
          const categoria = item.productos?.categoria || 'Sin categoría'
          if (!mermasPorCategoria[categoria]) {
            mermasPorCategoria[categoria] = { kg: 0, items: 0 }
          }
          mermasPorCategoria[categoria].kg += diferencia
          mermasPorCategoria[categoria].items += 1
        }
      }
    })

    const resultado = Object.entries(mermasPorCategoria).map(([categoria, datos]) => ({
      categoria,
      kg_perdidos: datos.kg,
      items_afectados: datos.items,
      promedio_por_item: datos.items > 0 ? datos.kg / datos.items : 0,
    }))

    return {
      success: true,
      data: resultado.sort((a, b) => b.kg_perdidos - a.kg_perdidos),
    }
  } catch (error: any) {
    console.error('Error al obtener mermas por categoría:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener mermas por categoría',
    }
  }
}

