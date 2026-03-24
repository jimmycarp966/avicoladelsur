import { WhatsAppClient } from '@kapso/whatsapp-cloud-api'
import type { SendMessageOptions, SendMessageResult } from '@/types/whatsapp-meta'

const DEFAULT_KAPSO_BASE_URL = 'https://api.kapso.ai/meta/whatsapp'

interface KapsoConfig {
  apiKey: string
  phoneNumberId: string
  baseUrl: string
  enableButtons: boolean
}

interface KapsoClientCache {
  apiKey: string
  phoneNumberId: string
  baseUrl: string
  client: WhatsAppClient
}

let kapsoClientCache: KapsoClientCache | null = null

function normalizePhoneNumber(phone: string): string {
  let normalized = (phone || '').trim()
  if (!normalized) {
    return ''
  }

  if (normalized.startsWith('whatsapp:')) {
    normalized = normalized.replace(/^whatsapp:/, '')
  }

  normalized = normalized.replace(/[^\d+]/g, '')

  if (!normalized) {
    return ''
  }

  if (normalized.startsWith('+')) {
    return normalized
  }

  if (normalized.startsWith('0')) {
    normalized = normalized.substring(1)
  }

  return `+${normalized}`
}

function getKapsoConfig(): KapsoConfig | null {
  const apiKey = process.env.KAPSO_API_KEY
  const phoneNumberId = process.env.KAPSO_WHATSAPP_PHONE_NUMBER_ID
  const baseUrl = process.env.KAPSO_WHATSAPP_BASE_URL || DEFAULT_KAPSO_BASE_URL
  const enableButtons = process.env.WHATSAPP_ENABLE_BUTTONS !== 'false'

  if (!apiKey || !phoneNumberId) {
    return null
  }

  return {
    apiKey,
    phoneNumberId,
    baseUrl,
    enableButtons,
  }
}

function getKapsoClient(config: KapsoConfig): WhatsAppClient {
  if (
    kapsoClientCache &&
    kapsoClientCache.apiKey === config.apiKey &&
    kapsoClientCache.phoneNumberId === config.phoneNumberId &&
    kapsoClientCache.baseUrl === config.baseUrl
  ) {
    return kapsoClientCache.client
  }

  const client = new WhatsAppClient({
    kapsoApiKey: config.apiKey,
    baseUrl: config.baseUrl,
  })

  kapsoClientCache = {
    apiKey: config.apiKey,
    phoneNumberId: config.phoneNumberId,
    baseUrl: config.baseUrl,
    client,
  }

  return client
}

async function sendKapsoTextMessage(
  client: WhatsAppClient,
  config: KapsoConfig,
  to: string,
  text: string,
  previewUrl = false
): Promise<SendMessageResult> {
  const normalizedPhone = normalizePhoneNumber(to)
  if (!normalizedPhone) {
    return {
      success: false,
      error: 'Destino (to) invalido',
    }
  }

  const messagesClient: any = client.messages
  const result = await messagesClient.sendText({
    phoneNumberId: config.phoneNumberId,
    to: normalizedPhone,
    body: text,
    previewUrl,
  })

  return {
    success: true,
    messageId: result.messages?.[0]?.id,
  }
}

async function sendKapsoButtonMessage(
  client: WhatsAppClient,
  config: KapsoConfig,
  to: string,
  text: string,
  buttons: Array<{ id: string; title: string }>,
  footer?: string
): Promise<SendMessageResult> {
  if (buttons.length === 0 || buttons.length > 3) {
    throw new Error('Debes proporcionar entre 1 y 3 botones')
  }

  const normalizedPhone = normalizePhoneNumber(to)
  if (!normalizedPhone) {
    return {
      success: false,
      error: 'Destino (to) invalido',
    }
  }

  const messagesClient: any = client.messages
  const result = await messagesClient.sendInteractiveButtons({
    phoneNumberId: config.phoneNumberId,
    to: normalizedPhone,
    bodyText: text,
    footerText: footer,
    buttons,
  })

  return {
    success: true,
    messageId: result.messages?.[0]?.id,
  }
}

async function sendKapsoListMessage(
  client: WhatsAppClient,
  config: KapsoConfig,
  to: string,
  buttonText: string,
  text: string,
  sections: Array<{ title?: string; rows: Array<{ id: string; title: string; description?: string }> }>,
  footer?: string
): Promise<SendMessageResult> {
  if (!sections || sections.length === 0) {
    throw new Error('Debes proporcionar al menos una seccion')
  }

  const normalizedPhone = normalizePhoneNumber(to)
  if (!normalizedPhone) {
    return {
      success: false,
      error: 'Destino (to) invalido',
    }
  }

  const messagesClient: any = client.messages
  const result = await messagesClient.sendInteractiveList({
    phoneNumberId: config.phoneNumberId,
    to: normalizedPhone,
    bodyText: text,
    buttonText,
    sections,
    footerText: footer,
  })

  return {
    success: true,
    messageId: result.messages?.[0]?.id,
  }
}

export function isWhatsAppKapsoAvailable(): boolean {
  return getKapsoConfig() !== null
}

export async function sendWhatsAppKapsoMessage(
  options: SendMessageOptions
): Promise<SendMessageResult> {
  const config = getKapsoConfig()

  if (!config) {
    return {
      success: false,
      error: 'Kapso no configurado',
    }
  }

  const client = getKapsoClient(config)

  if (!config.enableButtons && (options.buttons || options.list)) {
    if (options.text) {
      return sendKapsoTextMessage(client, config, options.to, options.text, options.previewUrl)
    }

    return {
      success: false,
      error: 'Botones deshabilitados y no hay texto',
    }
  }

  try {
    if (options.location) {
      const locationText = `\ud83d\udccd ${options.location.name || 'Ubicacion'}\n${options.location.address || ''}\nLat: ${options.location.latitude}, Lng: ${options.location.longitude}`.trim()
      return sendKapsoTextMessage(client, config, options.to, locationText, options.previewUrl)
    }

    if (options.list) {
      return sendKapsoListMessage(
        client,
        config,
        options.to,
        options.list.buttonText,
        options.text || '',
        options.list.sections,
        options.footer
      )
    }

    if (options.buttons && options.buttons.length > 0) {
      return sendKapsoButtonMessage(
        client,
        config,
        options.to,
        options.text || '',
        options.buttons,
        options.footer
      )
    }

    if (options.text) {
      return sendKapsoTextMessage(client, config, options.to, options.text, options.previewUrl)
    }

    return {
      success: false,
      error: 'No se proporciono contenido para el mensaje',
    }
  } catch (error: any) {
    console.error('[WhatsApp Kapso] Error enviando mensaje:', error)
    return {
      success: false,
      error: error?.message || 'Error desconocido',
    }
  }
}

export function getKapsoWebhookSecret(): string | null {
  return process.env.KAPSO_WHATSAPP_WEBHOOK_SECRET || process.env.KAPSO_WEBHOOK_SECRET || null
}
