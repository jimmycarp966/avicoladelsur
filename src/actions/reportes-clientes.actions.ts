'use server'

import { createClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@/types/api.types'
import { reporteFiltrosSchema } from '@/lib/schemas/reportes.schema'
import { subMonths, format } from 'date-fns'

interface ReporteFiltrosInput {
  fechaDesde: string
  fechaHasta: string
  zonaId?: string | null
}

/**
 * Obtiene ranking de clientes por facturación
 */
export async function obtenerRankingClientes(
  filtros: ReporteFiltrosInput
): Promise<ApiResponse<any[]>> {
  try {
    const supabase = await createClient()

    const validated = reporteFiltrosSchema.parse({
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta,
      zonaId: filtros.zonaId,
    })

    const { data: pedidos } = await supabase
      .from('pedidos')
      .select(
        `
        id,
        total,
        cliente_id,
        fecha_pedido,
        clientes!inner(id, nombre, zona_entrega)
      `
      )
      .gte('fecha_pedido', `${validated.fechaDesde}T00:00:00`)
      .lte('fecha_pedido', `${validated.fechaHasta}T23:59:59`)
      .eq('estado', 'entregado')
      .order('fecha_pedido', { ascending: false })

    // Agrupar por cliente
    const clientesMap: Record<
      string,
      {
        cliente_id: string
        cliente_nombre: string
        cliente_zona: string
        facturacion: number
        transacciones: number
        ultima_compra: string
        primera_compra: string
      }
    > = {}

    pedidos?.forEach((pedido: any) => {
      const clienteId = pedido.cliente_id
      if (!clientesMap[clienteId]) {
        clientesMap[clienteId] = {
          cliente_id: clienteId,
          cliente_nombre: pedido.clientes?.nombre || '',
          cliente_zona: pedido.clientes?.zona_entrega || '',
          facturacion: 0,
          transacciones: 0,
          ultima_compra: pedido.fecha_pedido,
          primera_compra: pedido.fecha_pedido,
        }
      }
      clientesMap[clienteId].facturacion += Number(pedido.total || 0)
      clientesMap[clienteId].transacciones += 1
      if (new Date(pedido.fecha_pedido) > new Date(clientesMap[clienteId].ultima_compra)) {
        clientesMap[clienteId].ultima_compra = pedido.fecha_pedido
      }
      if (new Date(pedido.fecha_pedido) < new Date(clientesMap[clienteId].primera_compra)) {
        clientesMap[clienteId].primera_compra = pedido.fecha_pedido
      }
    })

    const resultado = Object.values(clientesMap)
      .map((cliente) => ({
        ...cliente,
        ticket_promedio: cliente.transacciones > 0 ? cliente.facturacion / cliente.transacciones : 0,
        frecuencia: cliente.transacciones,
      }))
      .sort((a, b) => b.facturacion - a.facturacion)

    return {
      success: true,
      data: resultado,
    }
  } catch (error: any) {
    console.error('Error al obtener ranking de clientes:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener ranking de clientes',
    }
  }
}

/**
 * Obtiene análisis RFM de clientes
 */
export async function obtenerClientesRFM(
  filtros: ReporteFiltrosInput
): Promise<ApiResponse<any[]>> {
  try {
    const supabase = await createClient()

    const validated = reporteFiltrosSchema.parse({
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta,
    })

    const fechaReferencia = new Date(validated.fechaHasta)

    // Obtener todos los pedidos de clientes
    const { data: pedidos } = await supabase
      .from('pedidos')
      .select(
        `
        id,
        total,
        fecha_pedido,
        cliente_id,
        clientes!inner(id, nombre)
      `
      )
      .eq('estado', 'entregado')
      .order('fecha_pedido', { ascending: false })

    // Calcular RFM por cliente
    const rfmPorCliente: Record<
      string,
      {
        cliente_id: string
        cliente_nombre: string
        recencia: number // días desde última compra
        frecuencia: number // número de compras
        monetario: number // monto total
        ultima_compra: Date
      }
    > = {}

    pedidos?.forEach((pedido: any) => {
      const clienteId = pedido.cliente_id
      if (!rfmPorCliente[clienteId]) {
        rfmPorCliente[clienteId] = {
          cliente_id: clienteId,
          cliente_nombre: pedido.clientes?.nombre || '',
          recencia: 999,
          frecuencia: 0,
          monetario: 0,
          ultima_compra: new Date(0),
        }
      }
      rfmPorCliente[clienteId].frecuencia += 1
      rfmPorCliente[clienteId].monetario += Number(pedido.total || 0)
      const fechaPedido = new Date(pedido.fecha_pedido)
      if (fechaPedido > rfmPorCliente[clienteId].ultima_compra) {
        rfmPorCliente[clienteId].ultima_compra = fechaPedido
      }
    })

    // Calcular recencia
    Object.values(rfmPorCliente).forEach((cliente) => {
      const diasDesdeUltimaCompra = Math.floor(
        (fechaReferencia.getTime() - cliente.ultima_compra.getTime()) / (1000 * 60 * 60 * 24)
      )
      cliente.recencia = diasDesdeUltimaCompra
    })

    // Clasificar en quintiles
    const clientes = Object.values(rfmPorCliente)
    const sortedRecencia = [...clientes].sort((a, b) => a.recencia - b.recencia)
    const sortedFrecuencia = [...clientes].sort((a, b) => b.frecuencia - a.frecuencia)
    const sortedMonetario = [...clientes].sort((a, b) => b.monetario - a.monetario)

    const resultado = clientes.map((cliente) => {
      const quintilRecencia = Math.floor((sortedRecencia.indexOf(cliente) / clientes.length) * 5) + 1
      const quintilFrecuencia = Math.floor((sortedFrecuencia.indexOf(cliente) / clientes.length) * 5) + 1
      const quintilMonetario = Math.floor((sortedMonetario.indexOf(cliente) / clientes.length) * 5) + 1
      const scoreRFM = quintilRecencia * 100 + quintilFrecuencia * 10 + quintilMonetario

      return {
        ...cliente,
        quintil_recencia: quintilRecencia,
        quintil_frecuencia: quintilFrecuencia,
        quintil_monetario: quintilMonetario,
        score_rfm: scoreRFM,
        segmento:
          scoreRFM >= 555
            ? 'Campeones'
            : scoreRFM >= 444
              ? 'Clientes Leales'
              : scoreRFM >= 333
                ? 'Potenciales'
                : scoreRFM >= 222
                  ? 'En Riesgo'
                  : 'Dormidos',
      }
    })

    return {
      success: true,
      data: resultado.sort((a, b) => b.score_rfm - a.score_rfm),
    }
  } catch (error: any) {
    console.error('Error al obtener análisis RFM:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener análisis RFM',
    }
  }
}

/**
 * Obtiene cohortes de clientes
 */
export async function obtenerCohortesClientes(
  filtros: ReporteFiltrosInput
): Promise<ApiResponse<any>> {
  try {
    const supabase = await createClient()

    const validated = reporteFiltrosSchema.parse({
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta,
    })

    // Obtener primera compra de cada cliente
    const { data: primeraCompra } = await supabase
      .from('pedidos')
      .select('cliente_id, fecha_pedido')
      .eq('estado', 'entregado')
      .order('fecha_pedido', { ascending: true })

    // Agrupar por mes de primera compra (cohorte)
    const cohortes: Record<string, Set<string>> = {}
    primeraCompra?.forEach((pedido: any) => {
      const fecha = new Date(pedido.fecha_pedido)
      const mesCohorte = format(fecha, 'yyyy-MM')
      if (!cohortes[mesCohorte]) {
        cohortes[mesCohorte] = new Set()
      }
      cohortes[mesCohorte].add(pedido.cliente_id)
    })

    // Calcular retención por cohorte
    const resultado = Object.entries(cohortes).map(([mesCohorte, clientes]) => {
      const clientesArray = Array.from(clientes)
      // Contar cuántos compraron en meses siguientes
      const retencion: Record<string, number> = {}
      const fechaCohorte = new Date(mesCohorte + '-01')

      // Para cada mes después de la cohorte
      for (let i = 0; i < 12; i++) {
        const mesSiguiente = subMonths(fechaCohorte, -i)
        const mesKey = format(mesSiguiente, 'yyyy-MM')

        // Contar clientes que compraron en ese mes
        const clientesQueCompraron = primeraCompra?.filter((p: any) => {
          const fechaPedido = new Date(p.fecha_pedido)
          return (
            clientesArray.includes(p.cliente_id) &&
            format(fechaPedido, 'yyyy-MM') === mesKey
          )
        }).length || 0

        retencion[mesKey] = clientesQueCompraron
      }

      return {
        cohorte: mesCohorte,
        clientes_totales: clientesArray.length,
        retencion,
      }
    })

    return {
      success: true,
      data: resultado.sort((a, b) => a.cohorte.localeCompare(b.cohorte)),
    }
  } catch (error: any) {
    console.error('Error al obtener cohortes:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener cohortes',
    }
  }
}

/**
 * Obtiene preferencias de clientes (producto más comprado)
 */
export async function obtenerPreferenciasClientes(
  filtros: ReporteFiltrosInput
): Promise<ApiResponse<any[]>> {
  try {
    const supabase = await createClient()

    const validated = reporteFiltrosSchema.parse({
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta,
    })

    const { data: detalles } = await supabase
      .from('detalles_pedido')
      .select(
        `
        producto_id,
        cantidad,
        pedidos!inner(cliente_id, fecha_pedido, estado, clientes!inner(nombre))
      `
      )
      .gte('pedidos.fecha_pedido', `${validated.fechaDesde}T00:00:00`)
      .lte('pedidos.fecha_pedido', `${validated.fechaHasta}T23:59:59`)
      .eq('pedidos.estado', 'entregado')

    // Agrupar por cliente y producto
    const preferencias: Record<
      string,
      Record<string, { cantidad: number; producto_nombre: string }>
    > = {}

    detalles?.forEach((detalle: any) => {
      const clienteId = detalle.pedidos?.cliente_id
      const productoId = detalle.producto_id

      if (!preferencias[clienteId]) {
        preferencias[clienteId] = {}
      }
      if (!preferencias[clienteId][productoId]) {
        preferencias[clienteId][productoId] = {
          cantidad: 0,
          producto_nombre: '',
        }
      }
      preferencias[clienteId][productoId].cantidad += Number(detalle.cantidad || 0)
    })

    // Obtener nombres de productos
    const productosIds = Array.from(
      new Set(
        Object.values(preferencias)
          .flatMap((p) => Object.keys(p))
          .filter(Boolean)
      )
    ) as string[]

    const { data: productos } = await supabase
      .from('productos')
      .select('id, nombre')
      .in('id', productosIds)

    const productosMap = new Map(productos?.map((p) => [p.id, p.nombre]) || [])

    // Construir resultado
    const resultado = Object.entries(preferencias).map(([clienteId, productos]) => {
      const productoMasComprado = Object.entries(productos).sort(
        (a, b) => b[1].cantidad - a[1].cantidad
      )[0]

      const detalleCliente = detalles?.find((d: any) => d.pedidos?.cliente_id === clienteId)
      const pedidosData = detalleCliente?.pedidos as any
      const clientesData = pedidosData?.clientes
      const clienteNombre = clientesData
        ? (Array.isArray(clientesData) 
            ? clientesData[0]?.nombre 
            : clientesData?.nombre)
        : ''

      return {
        cliente_id: clienteId,
        cliente_nombre: clienteNombre || '',
        producto_id: productoMasComprado[0],
        producto_nombre: productosMap.get(productoMasComprado[0]) || '',
        cantidad_total: productoMasComprado[1].cantidad,
      }
    })

    return {
      success: true,
      data: resultado.sort((a, b) => b.cantidad_total - a.cantidad_total),
    }
  } catch (error: any) {
    console.error('Error al obtener preferencias:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener preferencias',
    }
  }
}

