/**
 * Dialogflow Handler
 * 
 * Maneja las conversaciones con Dialogflow y procesa las respuestas
 * para integrarlas con el sistema de pedidos.
 */

import { detectIntent, createSessionId, type DialogflowResponse } from '@/lib/services/google-cloud/dialogflow'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

export interface BotContext {
  clienteId: string
  numeroWhatsApp: string
  ultimoMensaje?: string
  estado?: string
  datosParciales?: Record<string, any>
}

export interface BotResponse {
  mensaje: string
  estado?: string
  accion?: 'crear_pedido' | 'consultar_stock' | 'consultar_precio' | 'cancelar' | 'continuar'
  datos?: Record<string, any>
}

/**
 * Procesa un mensaje del cliente usando Dialogflow
 */
export async function procesarMensajeDialogflow(
  supabase: SupabaseClient<Database>,
  clienteId: string,
  mensaje: string,
  numeroWhatsApp: string
): Promise<BotResponse> {
  try {
    // Obtener o crear contexto del cliente
    const sessionId = createSessionId(clienteId)
    
    // Obtener contexto previo si existe
    const { data: conversacion } = await supabase
      .from('conversaciones_bot')
      .select('contexto')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const contexto = (conversacion as any)?.contexto || {}

    // Detectar intención con Dialogflow
    const dialogflowResponse = await detectIntent({
      sessionId,
      message: mensaje,
      context: contexto
    })

    if (!dialogflowResponse.success) {
      // Fallback a procesamiento básico si Dialogflow falla
      return procesarMensajeBasico(mensaje)
    }

    // Guardar conversación
    await supabase
      .from('conversaciones_bot')
      .insert({
        cliente_id: clienteId,
        mensaje_cliente: mensaje,
        mensaje_bot: dialogflowResponse.response || '',
        intent_detectado: dialogflowResponse.intent || 'unknown',
        confianza: dialogflowResponse.confidence || 0,
        contexto: {
          ...contexto,
          ...(dialogflowResponse.contexts?.reduce((acc, ctx) => {
            acc[ctx.name] = ctx.parameters || {}
            return acc
          }, {} as Record<string, any>) || {})
        }
      })

    // Procesar según la intención detectada
    const intent = dialogflowResponse.intent?.toLowerCase() || ''

    if (intent.includes('pedido') || intent.includes('comprar')) {
      return {
        mensaje: dialogflowResponse.response || 'Perfecto, vamos a crear tu pedido. ¿Qué productos necesitas?',
        estado: 'creando_pedido',
        accion: 'crear_pedido',
        datos: dialogflowResponse.parameters
      }
    }

    if (intent.includes('stock') || intent.includes('disponible')) {
      return {
        mensaje: dialogflowResponse.response || 'Déjame consultar el stock disponible...',
        accion: 'consultar_stock',
        datos: dialogflowResponse.parameters
      }
    }

    if (intent.includes('precio') || intent.includes('costo')) {
      return {
        mensaje: dialogflowResponse.response || 'Te ayudo con los precios...',
        accion: 'consultar_precio',
        datos: dialogflowResponse.parameters
      }
    }

    if (intent.includes('cancelar')) {
      return {
        mensaje: dialogflowResponse.response || 'Entendido, cancelando tu pedido...',
        accion: 'cancelar',
        datos: dialogflowResponse.parameters
      }
    }

    // Respuesta genérica
    return {
      mensaje: dialogflowResponse.response || '¿En qué más puedo ayudarte?',
      accion: 'continuar'
    }
  } catch (error: any) {
    console.error('Error al procesar mensaje con Dialogflow:', error)
    return procesarMensajeBasico(mensaje)
  }
}

/**
 * Procesamiento básico de mensajes (fallback)
 */
function procesarMensajeBasico(mensaje: string): BotResponse {
  const mensajeLower = mensaje.toLowerCase().trim()

  if (mensajeLower.includes('hola') || mensajeLower.includes('buenos días') || mensajeLower.includes('buenas')) {
    return {
      mensaje: '¡Hola! Soy el asistente de Avícola del Sur. ¿En qué puedo ayudarte hoy?',
      accion: 'continuar'
    }
  }

  if (mensajeLower.includes('pedido') || mensajeLower.includes('comprar')) {
    return {
      mensaje: 'Perfecto, vamos a crear tu pedido. ¿Qué productos necesitas?',
      estado: 'creando_pedido',
      accion: 'crear_pedido'
    }
  }

  if (mensajeLower.includes('stock') || mensajeLower.includes('disponible')) {
    return {
      mensaje: 'Déjame consultar el stock disponible. ¿Qué producto te interesa?',
      accion: 'consultar_stock'
    }
  }

  if (mensajeLower.includes('precio') || mensajeLower.includes('costo')) {
    return {
      mensaje: 'Te ayudo con los precios. ¿De qué producto querés saber el precio?',
      accion: 'consultar_precio'
    }
  }

  return {
    mensaje: 'No entendí tu mensaje. ¿Podrías reformularlo? Puedo ayudarte con pedidos, consultas de stock y precios.',
    accion: 'continuar'
  }
}

