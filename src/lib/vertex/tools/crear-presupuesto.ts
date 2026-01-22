/**
 * Tool: Crear Presupuesto
 * Permite al agente crear presupuestos desde WhatsApp
 */

import { createAdminClient } from '@/lib/supabase/server'

export interface CrearPresupuestoParams {
  cliente_id: string
  productos: Array<{
    producto_id: string
    cantidad: number
    precio_unitario?: number
  }>
  observaciones?: string
  lista_precio_id?: string | null
  zona_id?: string | null
  fecha_entrega_estimada?: string | null
}

export interface CrearPresupuestoResult {
  success: boolean
  presupuesto_id?: string
  numero_presupuesto?: string
  total_estimado?: number
  error?: string
  message?: string // Para compatibilidad con ApiResponse
}

/**
 * Tool para crear presupuestos desde el bot (llama directamente a RPC sin validación de usuario)
 */
export async function crearPresupuestoTool(
  params: CrearPresupuestoParams
): Promise<CrearPresupuestoResult> {
  try {
    const supabase = createAdminClient()

    // Preparar items para RPC (la RPC calcula precios automáticamente si se pasan como 0)
    const itemsJson = params.productos.map((p) => ({
      producto_id: p.producto_id,
      cantidad: p.cantidad,
      precio_unitario: p.precio_unitario || 0,
      lista_precio_id: params.lista_precio_id || null
    }))

    // Llamar RPC directamente (bypass validación de usuario)
    const { data: result, error } = await supabase.rpc('fn_crear_presupuesto_desde_bot', {
      p_cliente_id: params.cliente_id,
      p_items: itemsJson,
      p_observaciones: params.observaciones || 'Presupuesto desde WhatsApp',
      p_zona_id: params.zona_id || null,
      p_fecha_entrega_estimada: params.fecha_entrega_estimada || null,
      p_lista_precio_id: params.lista_precio_id || null
    })

    if (error) {
      console.error('[Tool: Crear Presupuesto] Error RPC:', error)
      return {
        success: false,
        error: 'Error al crear presupuesto: ' + error.message
      }
    }

    if (!result || !result.success) {
      console.error('[Tool: Crear Presupuesto] Error: result.success es false:', result)
      return {
        success: false,
        error: result?.error || 'Error en la creación del presupuesto'
      }
    }

    return {
      success: true,
      presupuesto_id: result.presupuesto_id,
      numero_presupuesto: result.numero_presupuesto,
      total_estimado: result.total_estimado,
      message: `Presupuesto ${result.numero_presupuesto} creado exitosamente`
    }
  } catch (error) {
    console.error('[Tool: Crear Presupuesto] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

/**
 * Descripción de la tool para Vertex AI
 */
export const crearPresupuestoToolDefinition = {
  name: 'crear_presupuesto',
  description:
    'Crea un nuevo presupuesto con los productos especificados. Úsalo cuando el cliente quiera realizar un pedido.',
  parameters: {
    type: 'object',
    properties: {
      cliente_id: {
        type: 'string',
        description: 'ID del cliente en la base de datos'
      },
      productos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            producto_id: {
              type: 'string',
              description: 'ID del producto'
            },
            cantidad: {
              type: 'number',
              description: 'Cantidad solicitada'
            }
          },
          required: ['producto_id', 'cantidad']
        },
        description: 'Lista de productos con sus cantidades'
      },
      observaciones: {
        type: 'string',
        description: 'Observaciones adicionales del pedido (opcional)'
      }
    },
    required: ['cliente_id', 'productos']
  }
}
