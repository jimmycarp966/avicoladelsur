import { NextRequest, NextResponse } from 'next/server'
import type { MetaWebhookPayload, MetaIncomingMessage } from '@/types/whatsapp-meta'

/**
 * Webhook para WhatsApp Business API de Meta
 * 
 * GET: Verificación del webhook (Meta requiere esto para configurar el webhook)
 * POST: Recepción de mensajes entrantes y estados de mensajes
 */

const VERIFY_TOKEN = process.env.WHATSAPP_META_VERIFY_TOKEN || 'avicola_del_sur_verify_token_2025'

/**
 * Maneja la verificación del webhook (GET)
 * Meta envía una petición GET con parámetros para verificar que el webhook es válido
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  console.log('[WhatsApp Meta Webhook] Verificación recibida:', {
    mode,
    token: token ? '***' : null,
    challenge: challenge ? '***' : null,
  })

  // Verificar que el modo es 'subscribe' y el token coincide
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[WhatsApp Meta Webhook] Verificación exitosa')
    return new NextResponse(challenge, { status: 200 })
  }

  console.error('[WhatsApp Meta Webhook] Verificación fallida:', {
    mode,
    tokenMatch: token === VERIFY_TOKEN,
  })

  return new NextResponse('Forbidden', { status: 403 })
}

/**
 * Maneja mensajes entrantes y estados (POST)
 */
export async function POST(request: NextRequest) {
  try {
    const body: MetaWebhookPayload = await request.json()

    console.log('[WhatsApp Meta Webhook] Payload recibido:', JSON.stringify(body, null, 2))

    // Verificar que el objeto es de tipo whatsapp_business_account
    if (body.object !== 'whatsapp_business_account') {
      console.warn('[WhatsApp Meta Webhook] Objeto desconocido:', body.object)
      return new NextResponse('OK', { status: 200 })
    }

    // Procesar cada entrada
    for (const entry of body.entry) {
      for (const change of entry.changes) {
        if (change.field === 'messages') {
          const value = change.value

          // Procesar mensajes entrantes
          if (value.messages && value.messages.length > 0) {
            for (const message of value.messages) {
              await processIncomingMessage(message, value.metadata.phone_number_id)
            }
          }

          // Procesar estados de mensajes (enviado, entregado, leído)
          if (value.statuses && value.statuses.length > 0) {
            for (const status of value.statuses) {
              await processMessageStatus(status)
            }
          }
        }
      }
    }

    // Siempre responder 200 OK a Meta para evitar reintentos
    return new NextResponse('OK', { status: 200 })
  } catch (error: any) {
    console.error('[WhatsApp Meta Webhook] Error procesando webhook:', error)
    // Responder 200 para evitar que Meta reintente
    return new NextResponse('OK', { status: 200 })
  }
}

/**
 * Procesa un mensaje entrante
 */
async function processIncomingMessage(
  message: MetaIncomingMessage,
  phoneNumberId: string
) {
  console.log('[WhatsApp Meta Webhook] Procesando mensaje:', {
    from: message.from,
    type: message.type,
    id: message.id,
  })

  // Extraer el número de teléfono (formato internacional)
  const phoneNumber = message.from

  // Determinar el contenido del mensaje según el tipo
  let messageText = ''

  if (message.type === 'text' && message.text) {
    messageText = message.text.body
  } else if (message.type === 'interactive') {
    // Manejar respuestas de botones o listas
    if (message.interactive?.type === 'button_reply' && message.interactive.button_reply) {
      messageText = message.interactive.button_reply.id // Usar el ID del botón como comando
      console.log('[WhatsApp Meta Webhook] Botón presionado:', {
        id: message.interactive.button_reply.id,
        title: message.interactive.button_reply.title,
      })
    } else if (message.interactive?.type === 'list_reply' && message.interactive.list_reply) {
      messageText = message.interactive.list_reply.id // Usar el ID de la opción como comando
      console.log('[WhatsApp Meta Webhook] Opción de lista seleccionada:', {
        id: message.interactive.list_reply.id,
        title: message.interactive.list_reply.title,
      })
    }
  } else if (message.type === 'location' && message.location) {
    // Manejar ubicación compartida
    messageText = `LOCATION:${message.location.latitude},${message.location.longitude}`
    if (message.location.name) {
      messageText += `|${message.location.name}`
    }
    if (message.location.address) {
      messageText += `|${message.location.address}`
    }
    console.log('[WhatsApp Meta Webhook] Ubicación recibida:', {
      lat: message.location.latitude,
      lng: message.location.longitude,
      name: message.location.name,
    })
  }

  if (!messageText) {
    console.warn('[WhatsApp Meta Webhook] Tipo de mensaje no soportado:', message.type)
    return
  }

  // Redirigir al handler principal del bot
  // Crear un FormData similar al que espera el bot de Twilio para mantener compatibilidad
  const formData = new FormData()
  formData.append('Body', messageText)
  formData.append('From', `whatsapp:${phoneNumber}`)

  // Llamar al endpoint del bot principal usando fetch interno
  // El bot detectará automáticamente que viene de Meta y usará botones si están disponibles
  try {
    const botUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const botEndpoint = `${botUrl}/api/bot`

    const formData = new FormData()
    formData.append('Body', messageText)
    formData.append('From', `whatsapp:${phoneNumber}`)

    // Usar fetch interno (mismo servidor) para mejor rendimiento
    const response = await fetch(botEndpoint, {
      method: 'POST',
      body: formData,
      headers: {
        'X-WhatsApp-Provider': 'meta',
        'X-Phone-Number-Id': phoneNumberId,
      },
    })

    if (!response.ok) {
      console.error('[WhatsApp Meta Webhook] Error llamando al bot:', {
        status: response.status,
        statusText: response.statusText,
      })
    } else {
      console.log('[WhatsApp Meta Webhook] Mensaje procesado exitosamente por el bot')
    }
  } catch (error: any) {
    console.error('[WhatsApp Meta Webhook] Error redirigiendo al bot:', {
      error: error.message,
      stack: error.stack,
    })
  }
}

/**
 * Procesa estados de mensajes (enviado, entregado, leído)
 */
async function processMessageStatus(status: {
  id: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
  recipient_id: string
  errors?: Array<{
    code: number
    title: string
    message: string
  }>
}) {
  console.log('[WhatsApp Meta Webhook] Estado de mensaje:', {
    messageId: status.id,
    status: status.status,
    recipient: status.recipient_id,
    timestamp: status.timestamp,
  })

  // Si hay errores, registrarlos
  if (status.errors && status.errors.length > 0) {
    console.error('[WhatsApp Meta Webhook] Errores en mensaje:', {
      messageId: status.id,
      errors: status.errors,
    })
  }

  // Aquí podrías guardar el estado en la base de datos si es necesario
  // Por ejemplo, para tracking de entregas de notificaciones
}

