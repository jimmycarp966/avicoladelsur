/**
 * Servicio para WhatsApp Business API de Meta
 * Maneja envío de mensajes con botones interactivos
 */

import type {
  MetaMessage,
  MetaApiResponse,
  WhatsAppMetaConfig,
  SendMessageOptions,
  SendMessageResult,
  MetaInteractiveMessage,
  MetaInteractiveButton,
  MetaListSection,
} from '@/types/whatsapp-meta'

const META_API_BASE_URL = 'https://graph.facebook.com/v21.0'

/**
 * Obtiene la configuración de WhatsApp Meta desde variables de entorno
 */
function getMetaConfig(): WhatsAppMetaConfig | null {
  const accessToken = process.env.WHATSAPP_META_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_META_PHONE_NUMBER_ID
  const appId = process.env.WHATSAPP_META_APP_ID
  const appSecret = process.env.WHATSAPP_META_APP_SECRET
  const verifyToken = process.env.WHATSAPP_META_VERIFY_TOKEN
  const webhookUrl = process.env.WHATSAPP_META_WEBHOOK_URL
  const enableButtons = process.env.WHATSAPP_ENABLE_BUTTONS !== 'false'

  if (!accessToken || !phoneNumberId) {
    return null
  }

  return {
    accessToken,
    phoneNumberId,
    appId,
    appSecret,
    verifyToken,
    webhookUrl,
    enableButtons,
  }
}

/**
 * Normaliza número de teléfono al formato internacional
 */
function normalizePhoneNumber(phone: string): string {
  // Remover caracteres no numéricos excepto +
  let normalized = phone.replace(/[^\d+]/g, '')

  // Si no empieza con +, asumir código de país de Argentina (+54)
  if (!normalized.startsWith('+')) {
    // Si empieza con 0, removerlo
    if (normalized.startsWith('0')) {
      normalized = normalized.substring(1)
    }
    // Agregar código de país
    normalized = '+54' + normalized
  }

  return normalized
}

/**
 * Envía un mensaje de texto simple
 */
async function sendTextMessage(
  config: WhatsAppMetaConfig,
  to: string,
  text: string,
  previewUrl = false
): Promise<SendMessageResult> {
  const normalizedPhone = normalizePhoneNumber(to)

  const message: MetaMessage = {
    messaging_product: 'whatsapp',
    to: normalizedPhone,
    type: 'text',
    text: {
      body: text,
      preview_url: previewUrl,
    },
  }

  return sendMessage(config, message)
}

/**
 * Envía un mensaje con botones de respuesta (Reply Buttons)
 */
async function sendButtonMessage(
  config: WhatsAppMetaConfig,
  to: string,
  text: string,
  buttons: Array<{ id: string; title: string }>,
  footer?: string
): Promise<SendMessageResult> {
  if (buttons.length === 0 || buttons.length > 3) {
    throw new Error('Debes proporcionar entre 1 y 3 botones')
  }

  const normalizedPhone = normalizePhoneNumber(to)

  const interactiveButtons: MetaInteractiveButton[] = buttons.map((btn) => ({
    type: 'reply',
    reply: {
      id: btn.id,
      title: btn.title,
    },
  }))

  const message: MetaMessage = {
    messaging_product: 'whatsapp',
    to: normalizedPhone,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: text,
      },
      action: {
        buttons: interactiveButtons,
      },
      ...(footer && {
        footer: {
          text: footer,
        },
      }),
    },
  }

  return sendMessage(config, message)
}

/**
 * Envía un mensaje con lista desplegable (List Message)
 */
async function sendListMessage(
  config: WhatsAppMetaConfig,
  to: string,
  buttonText: string,
  text: string,
  sections: MetaListSection[],
  footer?: string
): Promise<SendMessageResult> {
  if (sections.length === 0) {
    throw new Error('Debes proporcionar al menos una sección')
  }

  // Validar que no haya más de 10 opciones en total
  const totalOptions = sections.reduce((sum, section) => sum + section.rows.length, 0)
  if (totalOptions > 10) {
    throw new Error('No puedes tener más de 10 opciones en total')
  }

  const normalizedPhone = normalizePhoneNumber(to)

  const message: MetaMessage = {
    messaging_product: 'whatsapp',
    to: normalizedPhone,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: text,
      },
      action: {
        button: buttonText,
        sections: sections,
      },
      ...(footer && {
        footer: {
          text: footer,
        },
      }),
    },
  }

  return sendMessage(config, message)
}

/**
 * Envía un mensaje con botón de compartir ubicación
 */
async function sendLocationRequestMessage(
  config: WhatsAppMetaConfig,
  to: string,
  text: string,
  buttonText = '📍 Compartir Ubicación'
): Promise<SendMessageResult> {
  const normalizedPhone = normalizePhoneNumber(to)

  // Para solicitar ubicación, usamos un botón que abre el selector de ubicación
  const message: MetaMessage = {
    messaging_product: 'whatsapp',
    to: normalizedPhone,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: text,
      },
      action: {
        buttons: [
          {
            type: 'reply',
            reply: {
              id: 'share_location',
              title: buttonText,
            },
          },
        ],
      },
    },
  }

  return sendMessage(config, message)
}

/**
 * Envía un mensaje con botón para llamar
 */
async function sendPhoneButtonMessage(
  config: WhatsAppMetaConfig,
  to: string,
  text: string,
  phoneNumber: string,
  buttonText = '📞 Llamar'
): Promise<SendMessageResult> {
  const normalizedPhone = normalizePhoneNumber(to)
  const normalizedCallPhone = normalizePhoneNumber(phoneNumber)

  const message: MetaMessage = {
    messaging_product: 'whatsapp',
    to: normalizedPhone,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: text,
      },
      action: {
        buttons: [
          {
            type: 'phone_number',
            phone_number: normalizedCallPhone,
          },
        ],
      },
    },
  }

  return sendMessage(config, message)
}

/**
 * Envía un mensaje a la API de Meta
 */
async function sendMessage(
  config: WhatsAppMetaConfig,
  message: MetaMessage
): Promise<SendMessageResult> {
  const url = `${META_API_BASE_URL}/${config.phoneNumberId}/messages`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify(message),
    })

    const data: MetaApiResponse = await response.json()

    if (!response.ok || data.error) {
      const errorMessage = data.error?.message || 'Error desconocido'
      const errorCode = data.error?.code || response.status

      console.error('[WhatsApp Meta] Error enviando mensaje:', {
        error: errorMessage,
        code: errorCode,
        message: message,
      })

      return {
        success: false,
        error: errorMessage,
        errorCode: errorCode,
      }
    }

    const messageId = data.messages?.[0]?.id

    console.log('[WhatsApp Meta] Mensaje enviado exitosamente:', {
      messageId,
      to: message.to,
      type: message.type,
    })

    return {
      success: true,
      messageId: messageId,
    }
  } catch (error: any) {
    console.error('[WhatsApp Meta] Error de red:', error)
    return {
      success: false,
      error: error.message || 'Error de red',
    }
  }
}

/**
 * Función principal para enviar mensajes con detección automática
 */
export async function sendWhatsAppMessage(
  options: SendMessageOptions
): Promise<SendMessageResult> {
  const config = getMetaConfig()

  if (!config) {
    console.warn('[WhatsApp Meta] Configuración no disponible, usando fallback a texto')
    // Fallback: retornar error para que el sistema use otro método
    return {
      success: false,
      error: 'WhatsApp Meta no configurado',
    }
  }

  // Si los botones están deshabilitados, enviar solo texto
  if (!config.enableButtons && (options.buttons || options.list)) {
    console.log('[WhatsApp Meta] Botones deshabilitados, enviando solo texto')
    if (options.text) {
      return sendTextMessage(config, options.to, options.text, options.previewUrl)
    }
    return {
      success: false,
      error: 'Botones deshabilitados y no hay texto',
    }
  }

  try {
    // Prioridad: ubicación > lista > botones > texto
    if (options.location) {
      return sendTextMessage(
        config,
        options.to,
        `📍 ${options.location.name || 'Ubicación'}\n${options.location.address || ''}\nLat: ${options.location.latitude}, Lng: ${options.location.longitude}`,
        options.previewUrl
      )
    }

    if (options.list) {
      return sendListMessage(
        config,
        options.to,
        options.list.buttonText,
        options.text || '',
        options.list.sections,
        options.footer
      )
    }

    if (options.buttons && options.buttons.length > 0) {
      return sendButtonMessage(config, options.to, options.text || '', options.buttons, options.footer)
    }

    if (options.text) {
      return sendTextMessage(config, options.to, options.text, options.previewUrl)
    }

    return {
      success: false,
      error: 'No se proporcionó contenido para el mensaje',
    }
  } catch (error: any) {
    console.error('[WhatsApp Meta] Error enviando mensaje:', error)
    return {
      success: false,
      error: error.message || 'Error desconocido',
    }
  }
}

/**
 * Verifica si WhatsApp Meta está configurado y disponible
 */
export function isWhatsAppMetaAvailable(): boolean {
  const provider = process.env.WHATSAPP_PROVIDER
  if (provider === 'twilio') {
    return false
  }

  const config = getMetaConfig()
  return config !== null && config.enableButtons !== false
}

/**
 * Obtiene el proveedor activo de WhatsApp
 */
export function getWhatsAppProvider(): 'meta' | 'twilio' | null {
  const provider = process.env.WHATSAPP_PROVIDER
  if (provider === 'meta' || provider === 'twilio') {
    return provider
  }

  // Auto-detección: si Meta está configurado, usarlo; sino Twilio
  if (isWhatsAppMetaAvailable()) {
    return 'meta'
  }

  // Verificar si Twilio está configurado
  const twilioConfig = {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER,
  }

  if (twilioConfig.accountSid && twilioConfig.authToken) {
    return 'twilio'
  }

  return null
}

// Exportar funciones específicas para uso directo si es necesario
export { sendTextMessage, sendButtonMessage, sendListMessage, sendLocationRequestMessage, sendPhoneButtonMessage }

