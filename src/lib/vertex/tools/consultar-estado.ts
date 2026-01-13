/**
 * Tool: Consultar Estado de Pedido
 * Permite al agente consultar el estado de pedidos de un cliente
 */

import { createAdminClient } from '@/lib/supabase/server'

export interface ConsultarEstadoParams {
  cliente_id: string
  pedido_id?: string
  numero_pedido?: string
}

export interface PedidoEstado {
  id: string
  numero_pedido: string
  fecha_pedido: string
  estado: string
  total: number
  items: Array<{
    producto_nombre: string
    cantidad: number
  }>
}

export interface ConsultarEstadoResult {
  success: boolean
  pedidos?: PedidoEstado[]
  mensaje?: string
  error?: string
}

/**
 * Tool para consultar estado de pedidos
 */
export async function consultarEstadoTool(
  params: ConsultarEstadoParams
): Promise<ConsultarEstadoResult> {
  try {
    const supabase = createAdminClient()

    let query = supabase
      .from('pedidos')
      .select(`
        id,
        numero_pedido,
        fecha_pedido,
        estado,
        total,
        detalles_pedido (
          cantidad,
          productos (nombre)
        )
      `)
      .eq('cliente_id', params.cliente_id)
      .order('fecha_pedido', { ascending: false })

    // Filtrar por pedido específico si se proporciona
    if (params.pedido_id) {
      query = query.eq('id', params.pedido_id)
    }

    if (params.numero_pedido) {
      query = query.eq('numero_pedido', params.numero_pedido)
    }

    const { data: pedidos, error } = await query.limit(5)

    if (error) {
      return {
        success: false,
        error: error.message
      }
    }

    if (!pedidos || pedidos.length === 0) {
      return {
        success: true,
        pedidos: [],
        mensaje: 'No encontré pedidos para este cliente'
      }
    }

    // Formatear resultados
    const pedidosFormateados = pedidos.map((p: any) => ({
      id: p.id,
      numero_pedido: p.numero_pedido,
      fecha_pedido: p.fecha_pedido,
      estado: p.estado,
      total: p.total,
      items: (p.detalles_pedido || []).map((i: any) => ({
        producto_nombre: i.productos?.nombre || 'Producto',
        cantidad: Number(i.cantidad || 0)
      }))
    }))

    return {
      success: true,
      pedidos: pedidosFormateados,
      mensaje: `Encontré ${pedidos.length} pedido(s)`
    }
  } catch (error) {
    console.error('[Tool: Consultar Estado] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

/**
 * Descripción de la tool para Vertex AI
 */
export const consultarEstadoToolDefinition = {
  name: 'consultar_estado_pedido',
  description:
    'Consulta el estado de pedidos de un cliente. Úsalo cuando el cliente pregunte por sus pedidos o el estado de un pedido específico.',
  parameters: {
    type: 'object',
    properties: {
      cliente_id: {
        type: 'string',
        description: 'ID del cliente'
      },
      pedido_id: {
        type: 'string',
        description: 'ID del pedido específico (opcional)'
      },
      numero_pedido: {
        type: 'string',
        description: 'Número de pedido específico (opcional)'
      }
    },
    required: ['cliente_id']
  }
}
