/**
 * Tipos TypeScript para WhatsApp Business API de Meta
 */

// Tipos de mensajes interactivos
export type InteractiveType = 'button' | 'list'

// Tipos de botones
export type ButtonType = 'reply' | 'url' | 'phone_number'

// Respuesta de botón
export interface MetaButtonReply {
  id: string
  title: string
}

// Botón interactivo
export interface MetaInteractiveButton {
  type: ButtonType
  reply?: {
    id: string
    title: string
  }
  url?: string
  phone_number?: string
}

// Opción de lista
export interface MetaListOption {
  id: string
  title: string
  description?: string
}

// Sección de lista
export interface MetaListSection {
  title?: string
  rows: MetaListOption[]
}

// Cuerpo del mensaje interactivo
export interface MetaInteractiveBody {
  text: string
}

// Acción del mensaje interactivo (botones)
export interface MetaInteractiveActionButtons {
  buttons: MetaInteractiveButton[]
}

// Acción del mensaje interactivo (lista)
export interface MetaInteractiveActionList {
  button?: string
  sections: MetaListSection[]
}

// Mensaje interactivo completo
export interface MetaInteractiveMessage {
  type: InteractiveType
  body: MetaInteractiveBody
  action: MetaInteractiveActionButtons | MetaInteractiveActionList
  footer?: {
    text: string
  }
}

// Mensaje de texto simple
export interface MetaTextMessage {
  text: {
    body: string
    preview_url?: boolean
  }
}

// Mensaje de ubicación
export interface MetaLocationMessage {
  type: 'location'
  location: {
    latitude: number
    longitude: number
    name?: string
    address?: string
  }
}

// Mensaje completo para enviar
export interface MetaMessage {
  messaging_product: 'whatsapp'
  to: string
  type: 'text' | 'interactive' | 'location'
  text?: MetaTextMessage['text']
  interactive?: MetaInteractiveMessage
  location?: MetaLocationMessage['location']
}

// Respuesta de botón recibida en webhook
export interface MetaButtonReplyPayload {
  button_reply: {
    id: string
    title: string
  }
}

// Respuesta de lista recibida en webhook
export interface MetaListReplyPayload {
  list_reply: {
    id: string
    title: string
    description?: string
  }
}

// Tipo de mensaje recibido
export interface MetaTextPayload {
  text: {
    body: string
  }
}

// Mensaje entrante en webhook
export interface MetaIncomingMessage {
  from: string
  id: string
  timestamp: string
  type: 'text' | 'interactive' | 'location' | 'button' | 'list'
  text?: MetaTextPayload['text']
  interactive?: {
    type: 'button_reply' | 'list_reply'
    button_reply?: MetaButtonReplyPayload['button_reply']
    list_reply?: MetaListReplyPayload['list_reply']
  }
  location?: {
    latitude: number
    longitude: number
    name?: string
    address?: string
  }
}

// Valor del webhook
export interface MetaWebhookValue {
  messaging_product: 'whatsapp'
  metadata: {
    display_phone_number: string
    phone_number_id: string
  }
  contacts?: Array<{
    profile: {
      name: string
    }
    wa_id: string
  }>
  messages?: MetaIncomingMessage[]
  statuses?: Array<{
    id: string
    status: 'sent' | 'delivered' | 'read' | 'failed'
    timestamp: string
    recipient_id: string
    errors?: Array<{
      code: number
      title: string
      message: string
      error_data?: {
        details: string
      }
    }>
  }>
}

// Payload completo del webhook
export interface MetaWebhookPayload {
  object: 'whatsapp_business_account'
  entry: Array<{
    id: string
    changes: Array<{
      value: MetaWebhookValue
      field: 'messages'
    }>
  }>
}

// Respuesta de la API de Meta
export interface MetaApiResponse {
  messaging_product: 'whatsapp'
  contacts?: Array<{
    input: string
    wa_id: string
  }>
  messages?: Array<{
    id: string
  }>
  error?: {
    message: string
    type: string
    code: number
    error_subcode?: number
    fbtrace_id?: string
  }
}

// Configuración de WhatsApp Meta
export interface WhatsAppMetaConfig {
  accessToken: string
  phoneNumberId: string
  appId?: string
  appSecret?: string
  verifyToken?: string
  webhookUrl?: string
  enableButtons?: boolean
}

// Opciones para enviar mensaje
export interface SendMessageOptions {
  to: string
  text?: string
  buttons?: MetaButtonReply[]
  list?: {
    buttonText: string
    sections: MetaListSection[]
  }
  location?: {
    latitude: number
    longitude: number
    name?: string
    address?: string
  }
  previewUrl?: boolean
  footer?: string
}

// Resultado de envío
export interface SendMessageResult {
  success: boolean
  messageId?: string
  error?: string
  errorCode?: number
}

