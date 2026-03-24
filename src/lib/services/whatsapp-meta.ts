/**
 * Servicio principal para WhatsApp.
 * Mantiene compatibilidad con Meta, Kapso y Twilio durante la migracion.
 */

import { sendWhatsAppKapsoMessage, isWhatsAppKapsoAvailable } from '@/lib/services/whatsapp-kapso'
import { sendWhatsAppTwilioMessage } from '@/lib/services/whatsapp-twilio'
import type {
  MetaApiResponse,
  MetaInteractiveButton,
  MetaInteractiveMessage,
  MetaListSection,
  MetaMessage,
  SendMessageOptions,
  SendMessageResult,
  WhatsAppMetaConfig,
} from '@/types/whatsapp-meta'

const META_API_BASE_URL = 'https://graph.facebook.com/v21.0'

type WhatsAppProviderPreference = 'auto' | 'meta' | 'twilio' | 'kapso'
type WhatsAppProvider = 'meta' | 'twilio' | 'kapso'

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

function getWhatsAppProviderPreference(): WhatsAppProviderPreference {
  const provider = (process.env.WHATSAPP_PROVIDER || 'auto').toLowerCase()

  if (provider === 'meta' || provider === 'twilio' || provider === 'kapso') {
    return provider
  }

  return 'auto'
}

function isMetaConfigured(): boolean {
  return getMetaConfig() !== null
}

function isMetaButtonsAvailable(): boolean {
  const config = getMetaConfig()
  return config !== null && config.enableButtons !== false
}

function isTwilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_WHATSAPP_NUMBER
  )
}

function normalizePhoneNumber(phone: string): string {
  let normalized = phone.replace(/[^\d+]/g, '')

  if (!normalized) {
    return ''
  }

  if (!normalized.startsWith('+')) {
    if (normalized.startsWith('0')) {
      normalized = normalized.substring(1)
    }
    normalized = `+${normalized}`
  }

  return normalized
}

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
        text,
      },
      action: {
        buttons: interactiveButtons,
      },
      ...(footer && {
        footer: {
          text: footer,
        },
      }),
    } as MetaInteractiveMessage,
  }

  return sendMessage(config, message)
}

async function sendListMessage(
  config: WhatsAppMetaConfig,
  to: string,
  buttonText: string,
  text: string,
  sections: MetaListSection[],
  footer?: string
): Promise<SendMessageResult> {
  if (sections.length === 0) {
    throw new Error('Debes proporcionar al menos una seccion')
  }

  const totalOptions = sections.reduce((sum, section) => sum + section.rows.length, 0)
  if (totalOptions > 10) {
    throw new Error('No puedes tener mas de 10 opciones en total')
  }

  const normalizedPhone = normalizePhoneNumber(to)

  const message: MetaMessage = {
    messaging_product: 'whatsapp',
    to: normalizedPhone,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text,
      },
      action: {
        button: buttonText,
        sections,
      },
      ...(footer && {
        footer: {
          text: footer,
        },
      }),
    } as MetaInteractiveMessage,
  }

  return sendMessage(config, message)
}

async function sendLocationRequestMessage(
  config: WhatsAppMetaConfig,
  to: string,
  text: string,
  buttonText = '📍 Compartir Ubicacion'
): Promise<SendMessageResult> {
  const normalizedPhone = normalizePhoneNumber(to)

  const message: MetaMessage = {
    messaging_product: 'whatsapp',
    to: normalizedPhone,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text,
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
    } as MetaInteractiveMessage,
  }

  return sendMessage(config, message)
}

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
        text,
      },
      action: {
        buttons: [
          {
            type: 'phone_number',
            phone_number: normalizedCallPhone,
          },
        ],
      },
    } as MetaInteractiveMessage,
  }

  return sendMessage(config, message)
}

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
        message,
      })

      return {
        success: false,
        error: errorMessage,
        errorCode,
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
      messageId,
    }
  } catch (error: any) {
    console.error('[WhatsApp Meta] Error de red:', error)
    return {
      success: false,
      error: error.message || 'Error de red',
    }
  }
}

async function sendWhatsAppViaMeta(options: SendMessageOptions): Promise<SendMessageResult> {
  const config = getMetaConfig()

  if (!config) {
    return {
      success: false,
      error: 'WhatsApp Meta no configurado',
    }
  }

  if (!config.enableButtons && (options.buttons || options.list)) {
    if (options.text) {
      return sendTextMessage(config, options.to, options.text, options.previewUrl)
    }

    return {
      success: false,
      error: 'Botones deshabilitados y no hay texto',
    }
  }

  if (options.location) {
    return sendTextMessage(
      config,
      options.to,
      `📍 ${options.location.name || 'Ubicacion'}\n${options.location.address || ''}\nLat: ${options.location.latitude}, Lng: ${options.location.longitude}`,
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
    error: 'No se proporciono contenido para el mensaje',
  }
}

async function sendWhatsAppViaTwilio(options: SendMessageOptions): Promise<SendMessageResult> {
  if (!isTwilioConfigured()) {
    return {
      success: false,
      error: 'Twilio no configurado',
    }
  }

  if (options.location) {
    const locationText = `📍 ${options.location.name || 'Ubicacion'}\n${options.location.address || ''}\nLat: ${options.location.latitude}, Lng: ${options.location.longitude}`
    return sendWhatsAppTwilioMessage(options.to, locationText)
  }

  if (options.buttons || options.list) {
    if (options.text) {
      return sendWhatsAppTwilioMessage(options.to, options.text)
    }

    return {
      success: false,
      error: 'Twilio no soporta mensajes interactivos sin texto',
    }
  }

  if (options.text) {
    return sendWhatsAppTwilioMessage(options.to, options.text)
  }

  return {
    success: false,
    error: 'No se proporciono contenido para el mensaje',
  }
}

/**
 * Envia mensajes usando el proveedor activo de WhatsApp.
 */
export async function sendWhatsAppMessage(
  options: SendMessageOptions
): Promise<SendMessageResult> {
  const preference = getWhatsAppProviderPreference()

  if (preference === 'kapso') {
    return sendWhatsAppKapsoMessage(options)
  }

  if (preference === 'meta') {
    return sendWhatsAppViaMeta(options)
  }

  if (preference === 'twilio') {
    return sendWhatsAppViaTwilio(options)
  }

  if (isWhatsAppKapsoAvailable()) {
    return sendWhatsAppKapsoMessage(options)
  }

  if (isMetaConfigured()) {
    return sendWhatsAppViaMeta(options)
  }

  if (isTwilioConfigured()) {
    return sendWhatsAppViaTwilio(options)
  }

  return {
    success: false,
    error: 'WhatsApp no configurado',
  }
}

/**
 * Verifica si WhatsApp interactivo esta disponible.
 */
export function isWhatsAppMetaAvailable(): boolean {
  const provider = getWhatsAppProvider()
  if (provider !== 'kapso' && provider !== 'meta') {
    return false
  }

  return process.env.WHATSAPP_ENABLE_BUTTONS !== 'false'
}

/**
 * Obtiene el proveedor activo de WhatsApp.
 */
export function getWhatsAppProvider(): WhatsAppProvider | null {
  const preference = getWhatsAppProviderPreference()

  if (preference === 'kapso') {
    return isWhatsAppKapsoAvailable() ? 'kapso' : null
  }

  if (preference === 'meta') {
    return isMetaConfigured() ? 'meta' : null
  }

  if (preference === 'twilio') {
    return isTwilioConfigured() ? 'twilio' : null
  }

  if (isWhatsAppKapsoAvailable()) {
    return 'kapso'
  }

  if (isMetaConfigured()) {
    return 'meta'
  }

  if (isTwilioConfigured()) {
    return 'twilio'
  }

  return null
}

export {
  sendTextMessage,
  sendButtonMessage,
  sendListMessage,
  sendLocationRequestMessage,
  sendPhoneButtonMessage,
}
