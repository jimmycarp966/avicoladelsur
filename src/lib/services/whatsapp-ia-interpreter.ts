/**
 * Interpretador de mensajes con IA para WhatsApp.
 */

import { GEMINI_MODEL_FLASH } from '@/lib/constants/gemini-models'
import { getGeminiModel } from '@/lib/ai/runtime'

export interface InterpretacionMensaje {
  intencion:
    | 'pedido'
    | 'consulta_precio'
    | 'consulta_estado'
    | 'saludo'
    | 'cancelar'
    | 'confirmar'
    | 'ayuda'
    | 'otro'
  productos: Array<{
    nombre: string
    cantidad: number
    unidad: string
  }>
  fecha?: string
  turno?: 'mañana' | 'tarde'
  confianza: number
  respuestaSugerida: string
  datosAdicionales?: Record<string, any>
}

interface InterpretacionResponse {
  success: boolean
  interpretacion?: InterpretacionMensaje
  error?: string
  usandoIA?: boolean
}

const PRODUCTOS_COMUNES = [
  'ala',
  'alas',
  'ala de pollo',
  'patamuslo',
  'pata muslo',
  'pata-muslo',
  'pechuga',
  'pechugas',
  'filet',
  'filete',
  'pollo entero',
  'pollo',
  'menudo',
  'menudos',
  'puchero',
  'suprema',
  'supremas',
  'muslo',
  'muslos',
  'pata',
  'patas',
  'cogote',
  'cogotes',
]

export async function interpretarMensajeConIA(
  mensaje: string,
  historialConversacion?: string[]
): Promise<InterpretacionResponse> {
  try {
    const model = getGeminiModel(GEMINI_MODEL_FLASH)
    if (!model) {
      return interpretarMensajeFallback(mensaje)
    }

    const historialContext =
      historialConversacion && historialConversacion.length > 0
        ? `Historial reciente:\n${historialConversacion.slice(-5).join('\n')}\n\n`
        : ''

    const prompt = `Eres un asistente de una avicola argentina. Interpreta el siguiente mensaje de un cliente de WhatsApp y extrae la informacion relevante.

${historialContext}Mensaje del cliente: "${mensaje}"

Productos que vendemos: ${PRODUCTOS_COMUNES.join(', ')}

Responde SOLO con un JSON valido con esta estructura:
{
  "intencion": "pedido" | "consulta_precio" | "consulta_estado" | "saludo" | "cancelar" | "confirmar" | "ayuda" | "otro",
  "productos": [
    { "nombre": "nombre del producto", "cantidad": numero, "unidad": "kg" | "unidades" | "cajones" }
  ],
  "fecha": "hoy" | "mañana" | "YYYY-MM-DD" | null,
  "turno": "mañana" | "tarde" | null,
  "confianza": numero del 1 al 100,
  "respuestaSugerida": "respuesta amigable para el cliente en espanol argentino"
}

IMPORTANTE:
- Si menciona "cajon" o "cajones", la unidad es "cajones" (1 cajon ~= 10-12 kg)
- Si no especifica unidad, asume "kg"
- Si dice "para mañana a la mañana" el turno es "mañana"
- Usa lenguaje amigable y argentino en la respuesta
- Si es un saludo, responde con saludo y ofrece ayuda
- Si no entendes algo, pregunta amablemente`

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleanedText)

    const turnoNormalizado = parsed.turno === 'manana' ? 'mañana' : parsed.turno

    return {
      success: true,
      interpretacion: {
        intencion: parsed.intencion || 'otro',
        productos: parsed.productos || [],
        fecha: parsed.fecha || undefined,
        turno: turnoNormalizado || undefined,
        confianza: parsed.confianza || 50,
        respuestaSugerida:
          parsed.respuestaSugerida ||
          'Disculpa, no entendi tu mensaje. Podes repetirlo?',
      },
      usandoIA: true,
    }
  } catch (error) {
    console.error('[IA] Error interpretando mensaje:', error)
    return interpretarMensajeFallback(mensaje)
  }
}

function interpretarMensajeFallback(mensaje: string): InterpretacionResponse {
  const msgLower = mensaje.toLowerCase().trim()

  const saludos = ['hola', 'buenas', 'buen dia', 'buenos dias', 'buenas tardes', 'buenas noches', 'que tal']
  if (saludos.some((s) => msgLower.startsWith(s))) {
    return {
      success: true,
      interpretacion: {
        intencion: 'saludo',
        productos: [],
        confianza: 90,
        respuestaSugerida:
          'Hola. Bienvenido a Avicola del Sur. En que puedo ayudarte hoy? Podes pedirme productos, consultar precios o ver el estado de tu pedido.',
      },
      usandoIA: false,
    }
  }

  if (msgLower.includes('ayuda') || msgLower.includes('help') || msgLower === '?') {
    return {
      success: true,
      interpretacion: {
        intencion: 'ayuda',
        productos: [],
        confianza: 95,
        respuestaSugerida:
          'Puedo ayudarte con: hacer un pedido, ver precios o consultar estado de pedido. Que necesitas?',
      },
      usandoIA: false,
    }
  }

  if (msgLower === 'si' || msgLower === 'sí' || msgLower === 'confirmar' || msgLower === 'dale' || msgLower === 'ok') {
    return {
      success: true,
      interpretacion: {
        intencion: 'confirmar',
        productos: [],
        confianza: 90,
        respuestaSugerida: 'Perfecto. Tu pedido esta confirmado. Te avisamos cuando salga.',
      },
      usandoIA: false,
    }
  }

  if (msgLower.includes('cancel') || msgLower === 'no') {
    return {
      success: true,
      interpretacion: {
        intencion: 'cancelar',
        productos: [],
        confianza: 85,
        respuestaSugerida: 'Entendido, cancelamos la operacion. Te puedo ayudar en algo mas?',
      },
      usandoIA: false,
    }
  }

  const productos: Array<{ nombre: string; cantidad: number; unidad: string }> = []
  const patronCantidad =
    /(\d+(?:\.\d+)?)\s*(kg|kilos?|cajon|cajones?|unidad|unidades?)?\s*(?:de\s+)?(ala|patamuslo|pechuga|filet|pollo|menudo|puchero|suprema|muslo|pata)/gi

  let match
  while ((match = patronCantidad.exec(msgLower)) !== null) {
    productos.push({
      nombre: match[3],
      cantidad: parseFloat(match[1]),
      unidad: match[2]?.replace(/es?$/, '') || 'kg',
    })
  }

  if (productos.length > 0) {
    return {
      success: true,
      interpretacion: {
        intencion: 'pedido',
        productos,
        confianza: 70,
        respuestaSugerida: `Perfecto, anotado: ${productos
          .map((p) => `${p.cantidad} ${p.unidad} de ${p.nombre}`)
          .join(', ')}. Confirmamos el pedido?`,
      },
      usandoIA: false,
    }
  }

  return {
    success: true,
    interpretacion: {
      intencion: 'otro',
      productos: [],
      confianza: 30,
      respuestaSugerida:
        'Disculpa, no entendi tu mensaje. Podes contarme que necesitas? Ejemplo: Quiero 5 kg de ala para mañana.',
    },
    usandoIA: false,
  }
}

export async function generarRespuestaIA(contexto: {
  cliente: string
  ultimoMensaje: string
  productos?: Array<{ nombre: string; precio: number }>
  pedidoActual?: any
}): Promise<string> {
  try {
    const model = getGeminiModel(GEMINI_MODEL_FLASH)
    if (!model) {
      return 'Disculpa, hubo un problema. Podes repetir tu mensaje?'
    }

    const prompt = `Eres el bot de WhatsApp de una avicola argentina. Genera una respuesta amigable y concisa.

Cliente: ${contexto.cliente}
Ultimo mensaje: "${contexto.ultimoMensaje}"
${contexto.productos ? `Productos disponibles: ${JSON.stringify(contexto.productos)}` : ''}
${contexto.pedidoActual ? `Pedido actual: ${JSON.stringify(contexto.pedidoActual)}` : ''}

Genera una respuesta corta, amigable, en espanol argentino (maximo 2 lineas).
Usa emojis moderadamente.
No uses markdown.`

    const result = await model.generateContent(prompt)
    return result.response.text().trim()
  } catch (error) {
    console.error('[IA] Error generando respuesta:', error)
    return 'Disculpa, hubo un problema. Podes repetir tu mensaje?'
  }
}
