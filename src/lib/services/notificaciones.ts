'use server'

import { createClient } from '@/lib/supabase/server'

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

        // Aquí iría la integración con Twilio API para enviar el mensaje
        // Por ahora solo registramos en logs
        console.log(`[WhatsApp Notification] To: ${cliente.whatsapp}, Message: ${mensaje}`)

        // TODO: Integrar con Twilio WhatsApp API
        // const twilioResponse = await fetch('https://api.twilio.com/2010-04-01/Accounts/...', {
        //   method: 'POST',
        //   headers: { ... },
        //   body: { ... }
        // })

        return { success: true, message: 'Notificación enviada (pendiente integración Twilio)' }
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
