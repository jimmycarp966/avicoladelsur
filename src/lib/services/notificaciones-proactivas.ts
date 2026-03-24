'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage } from '@/lib/services/whatsapp-meta'
import { generarMensajeOptOut } from '@/lib/vertex/tools/gestionar-notificaciones'

/**
 * Servicio de Notificaciones Proactivas
 * Maneja envío programado de notificaciones a clientes por WhatsApp
 */

/**
 * Tipos de notificación proactiva
 */
export type TipoNotificacionProactiva =
  | 'estado_pedido'
  | 'recordatorio_compra'
  | 'promocion'
  | 'entrega_cercana'
  | 'alerta_pago'

/**
 * Resultado de envío de notificación
 */
export interface EnvioNotificacionResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Datos de una notificación programada
 */
export interface NotificacionProgramada {
  id: string
  cliente_id: string
  tipo: TipoNotificacionProactiva
  mensaje: string
  datos: any
  programada_para: Date
}

interface NotificacionesPendientesPayload {
  success?: boolean
  notificaciones?: NotificacionProgramada[]
  total?: number
}

/**
 * Envía una notificación programada individual
 *
 * Flujo:
 * 1. Obtener datos del cliente
 * 2. Verificar que tiene WhatsApp
 * 3. Verificar preferencias del cliente
 * 4. Verificar rate limiting (frecuencia máxima del día)
 * 5. Enviar por WhatsApp
 * 6. Marcar como enviada en BD
 */
export async function enviarNotificacionProgramada(
  notificacionId: string
): Promise<EnvioNotificacionResult> {
  try {
    const supabase = createAdminClient()

    console.log(`[Notificación Proactiva] Procesando ID: ${notificacionId}`)

    // 1. Obtener datos de la notificación
    const { data: notificacion, error: notifError } = await supabase
      .from('notificaciones_programadas')
      .select('*')
      .eq('id', notificacionId)
      .eq('enviada', false)
      .single()

    if (notifError || !notificacion) {
      console.error('[Notificación Proactiva] No encontrada o ya enviada:', notifError)
      return { success: false, error: 'Notificación no encontrada o ya enviada' }
    }

    // 2. Obtener datos del cliente
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('id, nombre, whatsapp, activo')
      .eq('id', notificacion.cliente_id)
      .single()

    if (clienteError || !cliente) {
      console.error('[Notificación Proactiva] Cliente no encontrado:', clienteError)
      // Marcar como fallida
      await marcarNotificacionEnviada(notificacionId, false, 'Cliente no encontrado')
      return { success: false, error: 'Cliente no encontrado' }
    }

    // 2.1 Verificar que el cliente tiene WhatsApp
    if (!cliente.whatsapp) {
      console.warn(`[Notificación Proactiva] Cliente sin WhatsApp: ${cliente.id}`)
      await marcarNotificacionEnviada(notificacionId, false, 'Cliente sin WhatsApp')
      return { success: false, error: 'Cliente sin WhatsApp' }
    }

    // 2.2 Verificar que el cliente está activo
    if (!cliente.activo) {
      console.warn(`[Notificación Proactiva] Cliente inactivo: ${cliente.id}`)
      await marcarNotificacionEnviada(notificacionId, false, 'Cliente inactivo')
      return { success: false, error: 'Cliente inactivo' }
    }

    // 3. Obtener preferencias del cliente para este tipo
    const { data: preferencias } = await supabase.rpc('get_cliente_preferencias_notificaciones', {
      p_cliente_id: cliente.id,
    })

    const preferenciaTipo = preferencias?.preferencias?.find((p: any) => p.tipo === notificacion.tipo)

    // 3.1 Si la preferencia existe y está deshabilitada, no enviar
    if (preferenciaTipo && !preferenciaTipo.habilitado) {
      console.log(`[Notificación Proactiva] Tipo deshabilitado para cliente: ${notificacion.tipo}`)
      await marcarNotificacionEnviada(notificacionId, false, 'Notificación deshabilitada por cliente')
      return { success: false, error: 'Notificación deshabilitada por cliente' }
    }

    const frecuenciaMaxima = preferenciaTipo?.frecuencia_maxima || 3

    // 4. Verificar rate limiting
    const { data: countResult } = await supabase.rpc('contar_notificaciones_hoy', {
      p_cliente_id: cliente.id,
      p_tipo: notificacion.tipo,
    })

    const countHoy = countResult?.count || 0

    if (countHoy >= frecuenciaMaxima) {
      console.log(
        `[Notificación Proactiva] Límite diario alcanzado para ${notificacion.tipo}: ${countHoy}/${frecuenciaMaxima}`
      )
      await marcarNotificacionEnviada(notificacionId, false, 'Límite diario alcanzado')
      return { success: false, error: 'Límite diario de notificaciones alcanzado' }
    }

    // 5. Enviar mensaje por WhatsApp
    console.log(`[Notificación Proactiva] Enviando a ${cliente.whatsapp}:`, {
      tipo: notificacion.tipo,
      cliente: cliente.nombre,
      mensaje: notificacion.mensaje.substring(0, 50) + '...',
    })

    // Agregar mensaje de opt-out
    const mensajeFinal = notificacion.mensaje + generarMensajeOptOut()
    const result = await sendWhatsAppMessage({
      to: cliente.whatsapp,
      text: mensajeFinal,
    })

    if (!result.success) {
      console.error(`[Notificación Proactiva] Error WhatsApp: ${result.error}`)
      await marcarNotificacionEnviada(notificacionId, false, result.error)
      return { success: false, error: result.error }
    }

    // 6. Marcar como enviada
    await marcarNotificacionEnviada(notificacionId, true)

    console.log(`[Notificación Proactiva] ✅ Enviada exitosamente:`, {
      id: notificacion.id,
      cliente: cliente.nombre,
      tipo: notificacion.tipo,
      messageId: result.messageId,
    })

    return {
      success: true,
      messageId: result.messageId,
    }
  } catch (error: any) {
    console.error('[Notificación Proactiva] Error:', error)

    // Intentar marcar como fallida
    try {
      await marcarNotificacionEnviada(notificacionId, false, error.message)
    } catch (markError) {
      console.error('[Notificación Proactiva] Error marcando fallida:', markError)
    }

    return {
      success: false,
      error: error.message || 'Error desconocido',
    }
  }
}

/**
 * Envía todas las notificaciones pendientes en lote
 *
 * @param limit Cantidad máxima de notificaciones a procesar
 * @returns Resumen del procesamiento
 */
export async function procesarNotificacionesPendientes(
  limit: number = 50
): Promise<{
  procesadas: number
  exitosas: number
  fallidas: number
  errores: string[]
}> {
  try {
    const supabase = createAdminClient()

    console.log(`[Notificaciones Proactivas] Procesando lote de hasta ${limit}...`)

    // Obtener notificaciones pendientes
    const { data: pendientes, error } = await supabase.rpc('obtener_notificaciones_pendientes', {
      p_limit: limit,
    })

    const payload = pendientes as NotificacionesPendientesPayload | null

    if (error || !payload || payload.success === false) {
      console.error('[Notificaciones Proactivas] Error obteniendo pendientes:', error)
      return {
        procesadas: 0,
        exitosas: 0,
        fallidas: 0,
        errores: ['Error obteniendo notificaciones pendientes'],
      }
    }

    const notificaciones = Array.isArray(payload.notificaciones) ? payload.notificaciones : []
    console.log(`[Notificaciones Proactivas] ${notificaciones.length} pendientes encontradas`)

    let exitosas = 0
    let fallidas = 0
    const errores: string[] = []

    // Procesar cada notificación
    for (const notif of notificaciones) {
      const resultado = await enviarNotificacionProgramada(notif.id)

      if (resultado.success) {
        exitosas++
      } else {
        fallidas++
        errores.push(`${notif.tipo} (${notif.cliente_id}): ${resultado.error}`)
      }
    }

    console.log(`[Notificaciones Proactivas] Lote completado:`, {
      procesadas: notificaciones.length,
      exitosas,
      fallidas,
    })

    return {
      procesadas: notificaciones.length,
      exitosas,
      fallidas,
      errores,
    }
  } catch (error: any) {
    console.error('[Notificaciones Proactivas] Error procesando lote:', error)
    return {
      procesadas: 0,
      exitosas: 0,
      fallidas: 0,
      errores: [error.message || 'Error desconocido'],
    }
  }
}

/**
 * Marca una notificación como enviada o fallida en la BD
 */
async function marcarNotificacionEnviada(
  notificacionId: string,
  enviada: boolean,
  error?: string
): Promise<void> {
  try {
    const supabase = createAdminClient()
    await supabase.rpc('marcar_notificacion_enviada', {
      p_notificacion_id: notificacionId,
      p_enviada: enviada,
      p_error: error,
    })
  } catch (error) {
    console.error('[Notificación Proactiva] Error marcando enviada:', error)
    // No propagamos el error porque esto es un paso secundario
  }
}

/**
 * Obtiene el historial de notificaciones de un cliente
 */
export async function obtenerHistorialNotificaciones(
  clienteId: string,
  dias: number = 30
) {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('obtener_historial_notificaciones', {
      p_cliente_id: clienteId,
      p_dias: dias,
    })

    return {
      success: !error,
      historial: data?.historial || [],
      error: error?.message,
    }
  } catch (error: any) {
    return {
      success: false,
      historial: [],
      error: error.message,
    }
  }
}

/**
 * Limpia notificaciones antiguas enviadas
 */
export async function limpiarNotificacionesAntiguas(dias: number = 90) {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('cleanup_notificaciones_antiguas', {
      p_dias: dias,
    })

    return {
      success: !error,
      eliminadas: data?.deleted_count || 0,
      error: error?.message,
    }
  } catch (error: any) {
    return {
      success: false,
      eliminadas: 0,
      error: error.message,
    }
  }
}
