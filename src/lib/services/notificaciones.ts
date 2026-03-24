'use server'

import { createClient } from '@/lib/supabase/server'
import { getWhatsAppProvider, isWhatsAppMetaAvailable, sendWhatsAppMessage } from '@/lib/services/whatsapp-meta'

/**
 * Envía notificación de estado por WhatsApp al cliente
 * 
 * @param clienteId ID del cliente
 * @param tipo Tipo de notificación
 * @param data Datos adicionales según el tipo
 */
export async function enviarNotificacionWhatsApp(
    clienteId: string,
    tipo: 'presupuesto_creado' | 'pedido_confirmado' | 'en_camino' | 'entregado' | 'cancelado',
    data: {
        numero?: string
        total?: number
        fecha_entrega?: string
        turno?: string
        repartidor?: string
        vehiculo?: string
        motivo_cancelacion?: string
    }
) {
    try {
        const supabase = await createClient()

        // Obtener datos del cliente
        const { data: cliente, error: clienteError } = await supabase
            .from('clientes')
            .select('nombre, whatsapp')
            .eq('id', clienteId)
            .single()

        if (clienteError || !cliente?.whatsapp) {
            console.error('Cliente no encontrado o sin WhatsApp:', clienteError)
            return { success: false, error: 'Cliente sin WhatsApp' }
        }

        // Construir mensaje según tipo
        let mensaje = ''
        switch (tipo) {
            case 'presupuesto_creado':
                mensaje = `🛒 *Presupuesto Creado*

Hola ${cliente.nombre}! 👋

Tu presupuesto *${data.numero}* ha sido creado exitosamente.

💰 Total estimado: $${data.total?.toFixed(2)}
📅 Entrega estimada: ${data.fecha_entrega}
🕐 Turno: ${data.turno}

Nuestro equipo lo revisará y te contactaremos pronto.

¿Tenés alguna consulta? Escribinos aquí mismo.`
                break

            case 'pedido_confirmado':
                mensaje = `✅ *Pedido Confirmado*

Hola ${cliente.nombre}! 

Tu pedido *${data.numero}* fue confirmado y está siendo preparado.

💰 Total: $${data.total?.toFixed(2)}
📅 Entrega: ${data.fecha_entrega}
🕐 Turno: ${data.turno}

Te avisaremos cuando salga para entrega.`
                break

            case 'en_camino':
                mensaje = `🚛 *En Camino*

Hola ${cliente.nombre}!

Tu pedido *${data.numero}* salió para entrega.

🚗 Vehículo: ${data.vehiculo}
👤 Repartidor: ${data.repartidor}
🕐 Turno: ${data.turno}

Estimamos llegar en las próximas horas.`
                break

            case 'entregado':
                mensaje = `📦 *Pedido Entregado*

Hola ${cliente.nombre}!

Tu pedido *${data.numero}* fue entregado exitosamente.

¡Gracias por tu compra! 🙏

¿Todo OK? Escribinos si tenés alguna consulta.`
                break

            case 'cancelado':
                mensaje = `❌ *Pedido Cancelado*

Hola ${cliente.nombre},

Lamentablemente tu pedido *${data.numero}* fue **cancelado**.

Motivo: ${data.motivo_cancelacion}

Disculpá las molestias. Podés hacer un nuevo pedido cuando quieras.`
                break
        }

        // Enviar notificación usando el proveedor activo de WhatsApp
        const provider = getWhatsAppProvider()
        const useButtons = provider !== 'twilio' && isWhatsAppMetaAvailable()

        let buttons: Array<{ id: string; title: string }> | undefined
        let footer: string | undefined

        // Agregar botones según el tipo de notificación
        switch (tipo) {
          case 'presupuesto_creado':
            if (useButtons) {
              buttons = [
                { id: `ver_presupuesto_${data.numero}`, title: '📋 Ver Detalles' },
                { id: 'btn_menu', title: '🏠 Menú Principal' },
              ]
              footer = 'Selecciona una opción'
            }
            break
          case 'pedido_confirmado':
            if (useButtons) {
              buttons = [
                { id: `rastrear_pedido_${data.numero}`, title: '🚛 Rastrear Pedido' },
                { id: 'btn_menu', title: '🏠 Menú Principal' },
              ]
              footer = 'Te avisaremos cuando salga para entrega'
            }
            break
          case 'en_camino':
            if (useButtons) {
              buttons = [
                { id: `rastrear_pedido_${data.numero}`, title: '📍 Ver Ubicación' },
                { id: 'btn_menu', title: '🏠 Menú Principal' },
              ]
              footer = 'Estimamos llegar en las próximas horas'
            }
            break
          case 'entregado':
            if (useButtons) {
              buttons = [
                { id: `calificar_entrega_${data.numero}`, title: '⭐ Calificar' },
                { id: 'btn_menu', title: '🏠 Menú Principal' },
              ]
              footer = '¿Todo OK? Escribinos si tenés alguna consulta'
            }
            break
        }

        // Enviar mensaje según proveedor
        const result = await sendWhatsAppMessage({
          to: cliente.whatsapp,
          text: mensaje,
          ...(useButtons && buttons ? { buttons, footer } : {}),
        })

        if (result.success) {
          console.log(`[WhatsApp Notification] Enviada exitosamente a ${cliente.whatsapp}, Tipo: ${tipo}`)
          
          // Registrar notificación en BD
          await registrarNotificacion(clienteId, tipo, mensaje, data.numero)

          return { success: true, message: 'Notificación enviada exitosamente', messageId: result.messageId }
        } else {
          console.error(`[WhatsApp Notification] Error enviando a ${cliente.whatsapp}:`, result.error)
          return { success: false, error: result.error || 'Error enviando notificación' }
        }
    } catch (error: any) {
        console.error('Error enviando notificación WhatsApp:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Calcula tiempo estimado de entrega basado en zona y turno
 */
export async function calcularTiempoEntrega(
    zonaId: string,
    turno: 'mañana' | 'tarde',
    fechaEntrega: string
): Promise<{ ventana_inicio: string; ventana_fin: string }> {
    try {
        const supabase = await createClient()

        // Obtener rutas históricas de la zona
        const { data: rutasHistoricas } = await supabase
            .from('rutas_reparto')
            .select('tiempo_real_min, created_at, updated_at')
            .eq('zona_id', zonaId)
            .eq('turno', turno)
            .eq('estado', 'completada')
            .order('fecha_ruta', { ascending: false })
            .limit(10)

        // Calcular tiempo promedio
        let tiempoPromedio = 120 // Default 2 horas

        if (rutasHistoricas && rutasHistoricas.length > 0) {
            const tiempos = rutasHistoricas
                .filter(r => r.tiempo_real_min)
                .map(r => r.tiempo_real_min!)

            if (tiempos.length > 0) {
                tiempoPromedio = Math.round(
                    tiempos.reduce((sum, t) => sum + t, 0) / tiempos.length
                )
            }
        }

        // Definir ventanas según turno
        let ventanaInicio: string
        let ventanaFin: string

        if (turno === 'mañana') {
            ventanaInicio = '08:00'
            ventanaFin = `${Math.floor(8 + tiempoPromedio / 60).toString().padStart(2, '0')}:${(tiempoPromedio % 60).toString().padStart(2, '0')}`
        } else {
            ventanaInicio = '14:00'
            ventanaFin = `${Math.floor(14 + tiempoPromedio / 60).toString().padStart(2, '0')}:${(tiempoPromedio % 60).toString().padStart(2, '0')}`
        }

        return {
            ventana_inicio: ventanaInicio,
            ventana_fin: ventanaFin,
        }
    } catch (error) {
        console.error('Error calculando tiempo de entrega:', error)
        // Retornar ventanas por defecto en caso de error
        return {
            ventana_inicio: turno === 'mañana' ? '08:00' : '14:00',
            ventana_fin: turno === 'mañana' ? '12:00' : '18:00',
        }
    }
}

/**
 * Registra notificación en la base de datos para historial
 */
async function registrarNotificacion(
    clienteId: string,
    tipo: string,
    mensaje: string,
    referencia_id?: string
) {
    try {
        const supabase = await createClient()

        await supabase.from('notificaciones_clientes').insert({
            cliente_id: clienteId,
            tipo,
            mensaje,
            referencia_id,
            canal: 'whatsapp',
            estado: 'enviada',
        })
    } catch (error) {
        console.error('Error registrando notificación:', error)
    }
}
