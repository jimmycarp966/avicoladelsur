import { createClient } from '@/lib/supabase/server'

/**
 * Tool: Gestionar Notificaciones
 * Permite al cliente ver y modificar sus preferencias de notificaciones proactivas
 *
 * Comandos que activan esta tool:
 * - "notificaciones"
 * - "notificaciones estado"
 * - "desactivar notificaciones"
 * - "activar notificaciones"
 */

interface ClientePreferencias {
  tipo: string
  habilitado: boolean
  frecuencia_maxima: number
}

interface GestionarNotificacionesParams {
  tipo?: string
  accion?: 'ver' | 'activar' | 'desactivar'
}

export interface GestionarNotificacionesResult {
  success: boolean
  message: string
  preferences?: ClientePreferencias[]
  error?: string
}

/**
 * Mapea nombres de tipos a IDs
 */
const TIPOS_NOTIFICACION = {
  'estado_pedido': 'estado_pedido',
  'estado': 'estado_pedido',
  'pedidos': 'estado_pedido',
  'recordatorio': 'recordatorio_compra',
  'recordatorio compra': 'recordatorio_compra',
  'recordatorio compras': 'recordatorio_compra',
  'promociones': 'promocion',
  'promocion': 'promocion',
  'promociones personalizadas': 'promocion',
  'entrega': 'entrega_cercana',
  'entrega cercana': 'entrega_cercana',
  'llegada': 'entrega_cercana',
  'alerta': 'alerta_pago',
  'alerta pago': 'alerta_pago',
  'pagos': 'alerta_pago',
  'pagos pendientes': 'alerta_pago',
  'deuda': 'alerta_pago',
  'saldo': 'alerta_pago',
} as const

const NOMBRES_AMIGABLES = {
  estado_pedido: 'Estado de Pedidos',
  recordatorio_compra: 'Recordatorios de Compra',
  promocion: 'Promociones',
  entrega_cercana: 'Alertas de Entrega',
  alerta_pago: 'Alertas de Pago Pendiente',
} as const

/**
 * Analiza la intención del usuario para gestionar notificaciones
 */
function analizarIntencionNotificaciones(
  mensaje: string
): { accion: 'ver' | 'activar' | 'desactivar' | null; tipo?: string } {
  const mensajeLimpio = mensaje.toLowerCase().trim()

  // Ver preferencias actuales
  if (['notificaciones', 'mi configuracion', 'configurar notificaciones', 'mis notificaciones'].some(k => mensajeLimpio.includes(k))) {
    return { accion: 'ver' as const }
  }

  // Activar todas
  if (['activar notificaciones', 'habilitar notificaciones', 'prender notificaciones', 'si quiero notificaciones'].some(k => mensajeLimpio.includes(k))) {
    return { accion: 'activar' as const }
  }

  // Desactivar todas
  if (['desactivar notificaciones', 'deshabilitar notificaciones', 'apagar notificaciones', 'no quiero notificaciones', 'stop notificaciones', 'bajar notificaciones'].some(k => mensajeLimpio.includes(k))) {
    return { accion: 'desactivar' as const }
  }

  // Detectar tipo específico
  for (const [key, valor] of Object.entries(TIPOS_NOTIFICACION)) {
    const palabrasClave = key.split(' ').concat(['notificaciones', 'alertas'])
    if (palabrasClave.some(palabra => mensajeLimpio.includes(palabra))) {
      const accion = mensajeLimpio.includes('activar') || mensajeLimpio.includes('habilitar') || mensajeLimpio.includes('si') || mensajeLimpio.includes('quiero')
        ? 'activar'
        : mensajeLimpio.includes('desactivar') || mensajeLimpio.includes('deshabilitar') || mensajeLimpio.includes('no') || mensajeLimpio.includes('stop') || mensajeLimpio.includes('bajar')
        ? 'desactivar'
        : 'ver' as const

      return { accion, tipo: valor }
    }
  }

  // Si no se puede determinar la acción, mostrar preferencias
  return { accion: 'ver' as const }
}

/**
 * Tool principal: Gestionar Notificaciones
 */
export async function gestionarNotificacionesTool(
  params: GestionarNotificacionesParams,
  customerContext: { cliente_id?: string } = {}
): Promise<GestionarNotificacionesResult> {
  try {
    // Si no hay cliente_id, no podemos gestionar
    if (!customerContext.cliente_id) {
      return {
        success: false,
        message: 'Necesito saber quién eres para gestionar tus notificaciones. ¿Podrías decirme tu nombre o código de cliente?',
      }
    }

    const supabase = await createClient()
    const clienteId = customerContext.cliente_id

    // Obtener preferencias actuales
    const { data: preferencias, error: prefError } = await supabase.rpc('get_cliente_preferencias_notificaciones', {
      p_cliente_id: clienteId,
    })

    if (prefError) {
      return {
        success: false,
        message: 'Hubo un error al obtener tus preferencias. Por favor intenta más tarde.',
      }
    }

    const listaPreferencias = (preferencias?.preferencias || []) as ClientePreferencias[]

    // Si es una acción específica (activar/desactivar)
    if (params.accion && params.accion !== 'ver') {
      const tipoId = params.tipo || 'estado_pedido'

      // Solo permitir modificar recordatorios y promociones (no estado_pedido ni alerta_pago)
      const tiposPermitidos = ['recordatorio_compra', 'promocion', 'entrega_cercana', 'alerta_pago']
      if (!tiposPermitidos.includes(tipoId)) {
        return {
          success: false,
          message: `Las notificaciones de estado de pedido y alertas de pago son obligatorias y no pueden ser desactivadas. Puedes configurar: Recordatorios de Compra, Promociones, Alertas de Entrega o Alertas de Pago.`,
        }
      }

      // Upsert preferencia
      const nuevoHabilitado = params.accion === 'activar'

      const { data: upsertData, error: upsertError } = await supabase.rpc('upsert_cliente_preferencia_notificacion', {
        p_cliente_id: clienteId,
        p_tipo: tipoId,
        p_habilitado: nuevoHabilitado,
        p_frecuencia_maxima: 3, // Default: máximo 3 por día
      })

      if (upsertError || !upsertData?.success) {
        return {
          success: false,
          message: 'Hubo un error al actualizar tus preferencias. Por favor intenta más tarde.',
        }
      }

      const estadoTexto = nuevoHabilitado ? 'activadas' : 'desactivadas'
      return {
        success: true,
        message: `✅ Notificaciones de ${NOMBRES_AMIGABLES[tipoId as keyof typeof NOMBRES_AMIGABLES]} ahora están ${estadoTexto}.\n\nPara cambiar otros tipos de notificaciones, escribe: "notificaciones"`,
      }
    }

    // Mostrar preferencias actuales
    if (listaPreferencias.length === 0) {
      return {
        success: true,
        message: `📋 *Configuración de Notificaciones*\n\nAún no tienes preferencias configuradas. Las notificaciones están activadas con los valores por defecto (máximo 3 por día).\n\n**Tipos de notificaciones disponibles:**\n\n1. 📦 Estado de Pedidos (obligatorio)\n2. 📝 Recordatorios de Compra\n3. 🎁 Promociones\n4. 🚛 Alertas de Entrega\n5. ⚠️ Alertas de Pago Pendiente\n\n**Para activar/desactivar:**\n• "Activar recordatorios"\n• "Desactivar promociones"\n• "Activar alertas de pago"\n\n**Para desactivar todas las promocionales:**\n• "Desactivar notificaciones"`,
      }
    }

    // Agrupar por estado
    const activas = listaPreferencias.filter(p => p.habilitado)
    const desactivadas = listaPreferencias.filter(p => !p.habilitado)

    let mensaje = `📋 *Tu Configuración de Notificaciones*\n\n`

    if (activas.length > 0) {
      mensaje += `✅ **Activadas:**\n`
      for (const pref of activas) {
        const nombre = NOMBRES_AMIGABLES[pref.tipo as keyof typeof NOMBRES_AMIGABLES] || pref.tipo
        const frecuencia = pref.frecuencia_maxima === 1 ? 'máx 1/día'
          : pref.frecuencia_maxima === 2 ? 'máx 2/días'
          : pref.frecuencia_maxima === 5 ? 'máx 5/días'
          : `máx ${pref.frecuencia_maxima}/días`
        mensaje += `  • ${nombre} (${frecuencia})\n`
      }
    }

    if (desactivadas.length > 0) {
      mensaje += desactivadas.length > 0 ? '\n' : ''
      mensaje += `⬜ **Desactivadas:**\n`
      for (const pref of desactivadas) {
        const nombre = NOMBRES_AMIGABLES[pref.tipo as keyof typeof NOMBRES_AMIGABLES] || pref.tipo
        mensaje += `  • ${nombre}\n`
      }
    }

    mensaje += `\n**Para activar/desactivar:**\n• "Activar recordatorios" / "Desactivar recordatorios"\n• "Activar promociones" / "Desactivar promociones"\n• "Activar alertas de pago" / "Desactivar alertas de pago"\n• "Desactivar notificaciones" (para todas las promocionales)\n\n**Nota:** Las notificaciones de Estado de Pedidos y Alertas de Pago son obligatorias y no pueden ser desactivadas.`

    mensaje += `\n---\n💡 *Tip:* Si en alguna notificación recibes "Responde STOP para desactivar", simplemente envíame esa respuesta y dejaré de enviarte ese tipo de notificación.`

    return {
      success: true,
      message: mensaje,
      preferences: listaPreferencias,
    }
  } catch (error: any) {
    console.error('[Tool Gestionar Notificaciones] Error:', error)
    return {
      success: false,
      message: 'Hubo un error al procesar tu solicitud. Por favor intenta más tarde.',
    }
  }
}

/**
 * Versión simplificada para detección de intención desde mensajes cortos
 */
export function detectarIntencionNotificaciones(mensaje: string): GestionarNotificacionesParams | null {
  const analisis = analizarIntencionNotificaciones(mensaje)

  if (!analisis.accion || analisis.accion === 'ver') {
    return null // Solo responder cuando hay una acción clara
  }

  return {
    accion: analisis.accion,
    tipo: analisis.tipo,
  }
}

/**
 * Genera mensaje de ayuda para opt-out en cada notificación
 */
export function generarMensajeOptOut(): string {
  return `\n\n---\n💡 *No quieres más notificaciones como esta?* \n\nResponde "STOP" o "No quiero" para desactivar este tipo de notificación.\n\nO escribe "notificaciones" para gestionar todas tus preferencias.`
}
