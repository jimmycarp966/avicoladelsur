'use server'

import { createClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@/types/api.types'
import { reporteFiltrosSchema } from '@/lib/schemas/reportes.schema'

interface ReporteFiltrosInput {
  fechaDesde: string
  fechaHasta: string
  zonaId?: string | null
  vendedorId?: string | null
  estado?: string | null
  clienteId?: string | null
}

/**
 * Obtiene KPIs de pedidos
 */
export async function obtenerKpisPedidos(
  filtros: ReporteFiltrosInput
): Promise<ApiResponse<any>> {
  try {
    const supabase = await createClient()

    const validated = reporteFiltrosSchema.parse({
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta,
      zonaId: filtros.zonaId,
      vendedorId: filtros.vendedorId,
      estado: filtros.estado,
      clienteId: filtros.clienteId,
    })

    // Obtener pedidos del período
    let query = supabase
      .from('pedidos')
      .select('id, estado, fecha_pedido, fecha_entrega_real, presupuesto_id, total')
      .gte('fecha_pedido', `${validated.fechaDesde}T00:00:00`)
      .lte('fecha_pedido', `${validated.fechaHasta}T23:59:59`)

    if (validated.estado) {
      query = query.eq('estado', validated.estado)
    }

    const { data: pedidos, error } = await query

    if (error) throw error

    // Obtener presupuestos del período
    const { data: presupuestos } = await supabase
      .from('presupuestos')
      .select('id, estado, created_at, pedido_convertido_id')
      .gte('created_at', `${validated.fechaDesde}T00:00:00`)
      .lte('created_at', `${validated.fechaHasta}T23:59:59`)

    // Calcular KPIs
    const totalPedidos = pedidos?.length || 0
    const pedidosAprobados = pedidos?.filter((p) => p.estado === 'entregado').length || 0
    const pedidosRechazados = pedidos?.filter((p) => p.estado === 'cancelado').length || 0

    // Calcular tiempo promedio de aprobación (desde presupuesto a pedido)
    const tiemposAprobacion: number[] = []
    presupuestos?.forEach((pres) => {
      if (pres.pedido_convertido_id) {
        const pedido = pedidos?.find((p) => p.id === pres.pedido_convertido_id)
        if (pedido) {
          const tiempo = new Date(pedido.fecha_pedido).getTime() - new Date(pres.created_at).getTime()
          tiemposAprobacion.push(tiempo / (1000 * 60 * 60)) // en horas
        }
      }
    })

    const tiempoPromedioAprobacion =
      tiemposAprobacion.length > 0
        ? tiemposAprobacion.reduce((a, b) => a + b, 0) / tiemposAprobacion.length
        : 0

    // Calcular tiempo promedio entre pedido y entrega
    const tiemposEntrega: number[] = []
    pedidos?.forEach((pedido) => {
      if (pedido.fecha_entrega_real && pedido.fecha_pedido) {
        const tiempo =
          new Date(pedido.fecha_entrega_real).getTime() - new Date(pedido.fecha_pedido).getTime()
        tiemposEntrega.push(tiempo / (1000 * 60 * 60)) // en horas
      }
    })

    const tiempoPromedioEntrega =
      tiemposEntrega.length > 0
        ? tiemposEntrega.reduce((a, b) => a + b, 0) / tiemposEntrega.length
        : 0

    // Calcular % de productos pesables
    const { data: itemsPesables } = await supabase
      .from('presupuesto_items')
      .select('id, pesable')
      .in(
        'presupuesto_id',
        presupuestos?.map((p) => p.id) || []
      )

    const totalItems = itemsPesables?.length || 0
    const itemsPesablesCount = itemsPesables?.filter((i) => i.pesable).length || 0
    const porcentajePesables = totalItems > 0 ? (itemsPesablesCount / totalItems) * 100 : 0

    return {
      success: true,
      data: {
        pedidosTotales: totalPedidos,
        pedidosAprobados,
        pedidosRechazados,
        tasaAprobacion: totalPedidos > 0 ? (pedidosAprobados / totalPedidos) * 100 : 0,
        tiempoPromedioAprobacion,
        tiempoPromedioEntrega,
        porcentajePesables,
      },
    }
  } catch (error: any) {
    console.error('Error al obtener KPIs de pedidos:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener KPIs de pedidos',
    }
  }
}

/**
 * Obtiene funnel de pedidos
 */
export async function obtenerFunnelPedidos(
  filtros: ReporteFiltrosInput
): Promise<ApiResponse<any[]>> {
  try {
    const supabase = await createClient()

    const validated = reporteFiltrosSchema.parse({
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta,
    })

    // Obtener presupuestos
    const { data: presupuestos } = await supabase
      .from('presupuestos')
      .select('id, estado, pedido_convertido_id')
      .gte('created_at', `${validated.fechaDesde}T00:00:00`)
      .lte('created_at', `${validated.fechaHasta}T23:59:59`)

    // Obtener pedidos
    const { data: pedidos } = await supabase
      .from('pedidos')
      .select('id, estado, presupuesto_id, pago_estado')
      .gte('fecha_pedido', `${validated.fechaDesde}T00:00:00`)
      .lte('fecha_pedido', `${validated.fechaHasta}T23:59:59`)

    // Construir funnel
    const pedido = presupuestos?.length || 0
    const revisión = presupuestos?.filter((p) => p.estado === 'en_almacen').length || 0
    const almacén = pedidos?.filter((p) => p.estado === 'preparando').length || 0
    const reparto = pedidos?.filter((p) => p.estado === 'en_ruta').length || 0
    const entregado = pedidos?.filter((p) => p.estado === 'entregado').length || 0
    const cobrado = pedidos?.filter((p) => p.pago_estado === 'pagado').length || 0

    return {
      success: true,
      data: [
        { etapa: 'Pedido', cantidad: pedido },
        { etapa: 'Revisión', cantidad: revisión },
        { etapa: 'Almacén', cantidad: almacén },
        { etapa: 'Reparto', cantidad: reparto },
        { etapa: 'Entregado', cantidad: entregado },
        { etapa: 'Cobrado', cantidad: cobrado },
      ],
    }
  } catch (error: any) {
    console.error('Error al obtener funnel de pedidos:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener funnel de pedidos',
    }
  }
}

/**
 * Obtiene clientes que piden pero no compran (lead scoring básico)
 */
export async function obtenerClientesSinComprar(
  filtros: ReporteFiltrosInput
): Promise<ApiResponse<any[]>> {
  try {
    const supabase = await createClient()

    const validated = reporteFiltrosSchema.parse({
      fechaDesde: filtros.fechaDesde,
      fechaHasta: filtros.fechaHasta,
    })

    // Obtener presupuestos que no se convirtieron en pedidos
    const { data: presupuestosSinPedido } = await supabase
      .from('presupuestos')
      .select(
        `
        id,
        numero_presupuesto,
        total_estimado,
        created_at,
        clientes(id, nombre, telefono, zona_entrega)
      `
      )
      .gte('created_at', `${validated.fechaDesde}T00:00:00`)
      .lte('created_at', `${validated.fechaHasta}T23:59:59`)
      .is('pedido_convertido_id', null)
      .neq('estado', 'anulado')

    // Obtener presupuestos que se convirtieron para comparar
    const { data: presupuestosConPedido } = await supabase
      .from('presupuestos')
      .select('cliente_id')
      .gte('created_at', `${validated.fechaDesde}T00:00:00`)
      .lte('created_at', `${validated.fechaHasta}T23:59:59`)
      .not('pedido_convertido_id', 'is', null)

    const clientesQueCompraron = new Set(
      presupuestosConPedido?.map((p) => p.cliente_id) || []
    )

    // Filtrar clientes que no compraron
    const clientesSinComprar = (presupuestosSinPedido || [])
      .filter((p: any) => {
        const clientesData = p.clientes
        const clienteId = Array.isArray(clientesData) ? clientesData[0]?.id : clientesData?.id
        return !clientesQueCompraron.has(clienteId)
      })
      .map((p: any) => {
        const clientesData = p.clientes
        const clienteId = Array.isArray(clientesData) ? clientesData[0]?.id : clientesData?.id
        const clienteNombre = Array.isArray(clientesData) ? clientesData[0]?.nombre : clientesData?.nombre
        const clienteTelefono = Array.isArray(clientesData) ? clientesData[0]?.telefono : clientesData?.telefono
        const clienteZona = Array.isArray(clientesData) ? clientesData[0]?.zona_entrega : clientesData?.zona_entrega
        return {
          cliente_id: clienteId,
          cliente_nombre: clienteNombre,
          cliente_telefono: clienteTelefono,
          cliente_zona: clienteZona,
          presupuestos_count: 1,
          total_estimado: Number(p.total_estimado || 0),
          ultimo_presupuesto: p.created_at,
        }
      })
      .reduce((acc: any[], item) => {
        const existing = acc.find((c) => c.cliente_id === item.cliente_id)
        if (existing) {
          existing.presupuestos_count += 1
          existing.total_estimado += item.total_estimado
          if (new Date(item.ultimo_presupuesto) > new Date(existing.ultimo_presupuesto)) {
            existing.ultimo_presupuesto = item.ultimo_presupuesto
          }
        } else {
          acc.push(item)
        }
        return acc
      }, [])
      .sort((a, b) => b.total_estimado - a.total_estimado)

    return {
      success: true,
      data: clientesSinComprar,
    }
  } catch (error: any) {
    console.error('Error al obtener clientes sin comprar:', error)
    return {
      success: false,
      error: error.message || 'Error al obtener clientes sin comprar',
    }
  }
}

