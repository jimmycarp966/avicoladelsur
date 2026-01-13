'use server'

type SendMessageResult = {
  success: boolean
  messageId?: string
  error?: string
}

function normalizeWhatsAppAddress(phone: string): string {
  const trimmed = (phone || '').trim()
  if (!trimmed) return ''

  if (trimmed.startsWith('whatsapp:')) {
    return trimmed
  }

  // Aceptar formatos con +, con espacios, etc.
  const normalized = trimmed.replace(/[^\d+]/g, '')

  if (normalized.startsWith('+')) {
    return `whatsapp:${normalized}`
  }

  // Si no empieza con +, asumir Argentina (+54)
  const noLeadingZero = normalized.startsWith('0') ? normalized.substring(1) : normalized
  return `whatsapp:+54${noLeadingZero}`
}

export async function sendWhatsAppTwilioMessage(to: string, body: string): Promise<SendMessageResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    return {
      success: false,
      error: 'Twilio no configurado (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_WHATSAPP_NUMBER)',
    }
  }

  const toAddr = normalizeWhatsAppAddress(to)
  const fromAddr = normalizeWhatsAppAddress(fromNumber)

  if (!toAddr) {
    return { success: false, error: 'Destino (to) inválido' }
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`

  const params = new URLSearchParams()
  params.set('To', toAddr)
  params.set('From', fromAddr)
  params.set('Body', body)

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const data = (await res.json()) as any

    if (!res.ok) {
      const msg = data?.message || `Twilio error ${res.status}`
      console.error('[WhatsApp Twilio] Error enviando mensaje:', { status: res.status, msg, data })
      return { success: false, error: msg }
    }

    return {
      success: true,
      messageId: data?.sid,
    }
  } catch (error: any) {
    console.error('[WhatsApp Twilio] Error de red:', error)
    return { success: false, error: error?.message || 'Error de red' }
  }
}
