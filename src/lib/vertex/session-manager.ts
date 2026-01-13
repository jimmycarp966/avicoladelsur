/**
 * Gestión de Sesiones de Vertex AI para Bot WhatsApp
 * Usa Vertex AI Agent Engine Sessions para memoria conversacional
 */

import { createAdminClient } from '@/lib/supabase/server'

export interface SessionContext {
  phoneNumber: string
  sessionId: string
  history: Array<{ role: string; content: string; timestamp: string }>
  customerContext?: CustomerContext
}

export interface CustomerContext {
  cliente_id?: string
  nombre?: string
  productos_frecuentes?: Array<{ producto_id: string; nombre: string; count: number }>
  zona_id?: string
  lista_precio_id?: string
  preferencias?: {
    tipo_venta?: 'reparto' | 'retira_casa_central'
    horario_preferido?: 'mañana' | 'tarde'
  }
  metadata?: {
    ultima_interaccion?: string
    total_pedidos?: number
    total_gastado?: number
  }
}

/**
 * Obtiene o crea una sesión para un número de teléfono
 */
export async function getOrCreateSession(phoneNumber: string): Promise<SessionContext> {
  const sessionId = `whatsapp_${phoneNumber}`

  const supabase = createAdminClient()

  // Buscar sesión existente en Supabase
  const { data: existingSession } = await supabase
    .from('bot_sessions')
    .select('*')
    .eq('phone_number', phoneNumber)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (existingSession) {
    // Verificar si expiró (24 horas)
    const expiresAt = new Date(existingSession.expires_at)
    if (expiresAt > new Date()) {
      return {
        phoneNumber,
        sessionId: existingSession.session_id,
        history: existingSession.messages || [],
        customerContext: existingSession.context as CustomerContext || {}
      }
    }
  }

  // Crear nueva sesión
  const { data: newSession } = await supabase
    .from('bot_sessions')
    .insert({
      session_id: sessionId,
      phone_number: phoneNumber,
      messages: [],
      context: {},
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    })
    .select()
    .single()

  if (!newSession) {
    return {
      phoneNumber,
      sessionId,
      history: [],
      customerContext: {}
    }
  }

  return {
    phoneNumber,
    sessionId: newSession.session_id,
    history: [],
    customerContext: {}
  }
}

/**
 * Actualiza una sesión con un nuevo mensaje
 */
export async function updateSession(
  sessionId: string,
  message: { role: string; content: string },
  context?: CustomerContext
): Promise<void> {
  const supabase = createAdminClient()

  const payload = {
    ...message,
    timestamp: new Date().toISOString(),
  }

  await supabase.rpc('append_bot_session_message', {
    p_session_id: sessionId,
    p_message: payload,
  })

  if (context) {
    await supabase
      .from('bot_sessions')
      .update({
        context,
      })
      .eq('session_id', sessionId)
  }
}

/**
 * Actualiza el contexto del cliente (persistente entre sesiones)
 */
export async function updateCustomerContext(
  phoneNumber: string,
  updates: Partial<CustomerContext>
): Promise<void> {
  const supabase = createAdminClient()

  const { data: session } = await supabase
    .from('bot_sessions')
    .select('session_id, context')
    .eq('phone_number', phoneNumber)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (session) {
    const currentContext = (session.context as CustomerContext) || {}
    const updatedContext = {
      ...currentContext,
      ...updates,
      metadata: {
        ...currentContext.metadata,
        ultima_interaccion: new Date().toISOString()
      }
    }

    await supabase
      .from('bot_sessions')
      .update({
        context: updatedContext,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Renovar expiración
      })
      .eq('session_id', session.session_id)
  }
}

/**
 * Registra un producto frecuentemente pedido por el cliente
 */
export async function addFrequentProduct(
  phoneNumber: string,
  productoId: string,
  productoNombre: string
): Promise<void> {
  const supabase = createAdminClient()

  const { data: session } = await supabase
    .from('bot_sessions')
    .select('session_id, context')
    .eq('phone_number', phoneNumber)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (session) {
    const context = (session.context as CustomerContext) || {}
    const productosFrecuentes = context.productos_frecuentes || []

    // Buscar si ya existe el producto
    const existingIndex = productosFrecuentes.findIndex(p => p.producto_id === productoId)
    if (existingIndex >= 0) {
      productosFrecuentes[existingIndex].count += 1
    } else {
      productosFrecuentes.push({
        producto_id: productoId,
        nombre: productoNombre,
        count: 1
      })
    }

    // Mantener solo los 10 más frecuentes
    productosFrecuentes.sort((a, b) => b.count - a.count)
    const topProductos = productosFrecuentes.slice(0, 10)

    await updateCustomerContext(phoneNumber, {
      productos_frecuentes: topProductos
    })
  }
}

/**
 * Genera memorias de una sesión usando Vertex AI Memory Bank
 */
export async function generateMemories(sessionId: string, phoneNumber: string): Promise<void> {
  try {
    // En una implementación completa con Vertex AI Agent Engine:
    // await vertexAI.agentEngines.memories.generate({
    //   name: 'avicola-whatsapp-agent',
    //   vertex_session_source: { session: sessionId },
    //   scope: { user_id: phoneNumber }
    // })

    console.log(`[Memory Bank] Generando memorias para sesión ${sessionId}`)
  } catch (error) {
    console.error('[Memory Bank] Error generando memorias:', error)
  }
}

/**
 * Limpia sesiones expiradas
 */
export async function cleanupExpiredSessions(): Promise<void> {
  const supabase = createAdminClient()

  await supabase
    .from('bot_sessions')
    .delete()
    .lt('expires_at', new Date().toISOString())
}
