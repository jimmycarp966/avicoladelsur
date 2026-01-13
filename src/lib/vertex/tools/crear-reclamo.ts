/**
 * Tool: Crear Reclamo
 * Permite al agente crear reclamos desde WhatsApp
 */

import { createAdminClient } from '@/lib/supabase/server'

export interface CrearReclamoParams {
  cliente_id: string
  tipo_reclamo: 'producto_dañado' | 'entrega_tardia' | 'cantidad_erronea' | 'producto_equivocado' | 'precio_incorrecto' | 'calidad_deficiente' | 'empaque_dañado' | 'otro'
  descripcion: string
  pedido_id?: string
  prioridad?: 'baja' | 'media' | 'alta'
}

export interface CrearReclamoResult {
  success: boolean
  reclamo_id?: string
  numero_reclamo?: string
  error?: string
}

/**
 * Tool para crear reclamos desde el bot (llama directamente a DB sin validación de usuario)
 */
export async function crearReclamoTool(
  params: CrearReclamoParams
): Promise<CrearReclamoResult> {
  try {
    const supabase = createAdminClient()

    // Generar número de reclamo único
    const numeroReclamo = `REC-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`

    const { data, error } = await supabase
      .from('reclamos')
      .insert({
        numero_reclamo: numeroReclamo,
        cliente_id: params.cliente_id,
        pedido_id: params.pedido_id || null,
        tipo_reclamo: params.tipo_reclamo,
        descripcion: params.descripcion,
        estado: 'abierto',
        prioridad: params.prioridad || 'media',
        origen: 'whatsapp',
      })
      .select()
      .single()

    if (error) {
      console.error('[Tool: Crear Reclamo] Error:', error)
      return {
        success: false,
        error: 'Error al crear reclamo: ' + error.message
      }
    }

    return {
      success: true,
      reclamo_id: data.id,
      numero_reclamo: data.numero_reclamo
    }
  } catch (error) {
    console.error('[Tool: Crear Reclamo] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

/**
 * Descripción de la tool para Vertex AI
 */
export const crearReclamoToolDefinition = {
  name: 'crear_reclamo',
  description: 'Crea un nuevo reclamo para un cliente. Úsalo cuando el cliente reporte un problema con un pedido o producto.',
  parameters: {
    type: 'object',
    properties: {
      cliente_id: {
        type: 'string',
        description: 'ID del cliente en la base de datos'
      },
      tipo_reclamo: {
        type: 'string',
        enum: ['producto_dañado', 'entrega_tardia', 'cantidad_erronea', 'producto_equivocado', 'precio_incorrecto', 'calidad_deficiente', 'empaque_dañado', 'otro'],
        description: 'Tipo de problema reportado'
      },
      descripcion: {
        type: 'string',
        description: 'Descripción detallada del problema'
      },
      pedido_id: {
        type: 'string',
        description: 'ID del pedido relacionado (opcional)'
      },
      prioridad: {
        type: 'string',
        enum: ['baja', 'media', 'alta'],
        description: 'Prioridad del reclamo (opcional, por defecto: media)'
      }
    },
    required: ['cliente_id', 'tipo_reclamo', 'descripcion']
  }
}
