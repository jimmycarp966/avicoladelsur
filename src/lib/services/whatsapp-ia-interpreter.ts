/**
 * Interpretador de Mensajes con IA para WhatsApp Bot
 * 
 * Usa Gemini AI para interpretar mensajes en lenguaje natural
 * y extraer intención, productos, cantidades, fechas, etc.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_MODEL_FLASH } from '@/lib/constants/gemini-models'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '')

export interface InterpretacionMensaje {
    intencion: 'pedido' | 'consulta_precio' | 'consulta_estado' | 'saludo' | 'cancelar' | 'confirmar' | 'ayuda' | 'otro'
    productos: Array<{
        nombre: string
        cantidad: number
        unidad: string
    }>
    fecha?: string // Formato ISO o descripción ("mañana", "hoy")
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

// Productos comunes para contexto
const PRODUCTOS_COMUNES = [
    'ala', 'alas', 'ala de pollo',
    'patamuslo', 'pata muslo', 'pata-muslo',
    'pechuga', 'pechugas',
    'filet', 'filete',
    'pollo entero', 'pollo',
    'menudo', 'menudos',
    'puchero',
    'suprema', 'supremas',
    'muslo', 'muslos',
    'pata', 'patas',
    'cogote', 'cogotes',
]

/**
 * Interpreta un mensaje de WhatsApp usando Gemini AI
 */
export async function interpretarMensajeConIA(
    mensaje: string,
    historialConversacion?: string[]
): Promise<InterpretacionResponse> {
    try {
        // Intentar con Gemini - modelo flash estandarizado
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_FLASH })

        const historialContext = historialConversacion && historialConversacion.length > 0
            ? `Historial reciente:\n${historialConversacion.slice(-5).join('\n')}\n\n`
            : ''

        const prompt = `Eres un asistente de una avícola argentina. Interpreta el siguiente mensaje de un cliente de WhatsApp y extrae la información relevante.

${historialContext}Mensaje del cliente: "${mensaje}"

Productos que vendemos: ${PRODUCTOS_COMUNES.join(', ')}

Responde SOLO con un JSON válido con esta estructura:
{
  "intencion": "pedido" | "consulta_precio" | "consulta_estado" | "saludo" | "cancelar" | "confirmar" | "ayuda" | "otro",
  "productos": [
    { "nombre": "nombre del producto", "cantidad": número, "unidad": "kg" | "unidades" | "cajones" }
  ],
  "fecha": "hoy" | "mañana" | "YYYY-MM-DD" | null,
  "turno": "mañana" | "tarde" | null,
  "confianza": número del 1 al 100,
  "respuestaSugerida": "respuesta amigable para el cliente en español argentino"
}

IMPORTANTE:
- Si menciona "cajón" o "cajones", la unidad es "cajones" (1 cajón ≈ 10-12 kg)
- Si no especifica unidad, asume "kg"
- Si dice "para mañana a la mañana" el turno es "mañana"
- Usa lenguaje amigable y argentino en la respuesta
- Si es un saludo, responde con saludo y ofrece ayuda
- Si no entendés algo, preguntá amablemente`

        const result = await model.generateContent(prompt)
        const responseText = result.response.text()

        // Limpiar respuesta
        const cleanedText = responseText
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim()

        const parsed = JSON.parse(cleanedText)

        return {
            success: true,
            interpretacion: {
                intencion: parsed.intencion || 'otro',
                productos: parsed.productos || [],
                fecha: parsed.fecha || undefined,
                turno: parsed.turno || undefined,
                confianza: parsed.confianza || 50,
                respuestaSugerida: parsed.respuestaSugerida || 'Disculpá, no entendí tu mensaje. ¿Podés repetirlo?',
            },
            usandoIA: true,
        }
    } catch (error) {
        console.error('[IA] Error interpretando mensaje:', error)

        // Fallback básico
        return interpretarMensajeFallback(mensaje)
    }
}

/**
 * Fallback de interpretación sin IA (regex básico)
 */
function interpretarMensajeFallback(mensaje: string): InterpretacionResponse {
    const msgLower = mensaje.toLowerCase().trim()

    // Detectar saludos
    const saludos = ['hola', 'buenas', 'buen día', 'buenos días', 'buenas tardes', 'buenas noches', 'que tal', 'qué tal']
    if (saludos.some(s => msgLower.startsWith(s))) {
        return {
            success: true,
            interpretacion: {
                intencion: 'saludo',
                productos: [],
                confianza: 90,
                respuestaSugerida: '¡Hola! 👋 Bienvenido a Avícola del Sur. ¿En qué puedo ayudarte hoy? Podés pedirme productos, consultar precios o ver el estado de tu pedido.',
            },
            usandoIA: false,
        }
    }

    // Detectar ayuda
    if (msgLower.includes('ayuda') || msgLower.includes('help') || msgLower === '?') {
        return {
            success: true,
            interpretacion: {
                intencion: 'ayuda',
                productos: [],
                confianza: 95,
                respuestaSugerida: '📋 *Puedo ayudarte con:*\n\n• Hacer un pedido: "Quiero 5 kg de ala"\n• Ver precios: "¿Cuánto está la pechuga?"\n• Estado de pedido: "¿Cómo va mi pedido?"\n\n¿Qué necesitás?',
            },
            usandoIA: false,
        }
    }

    // Detectar confirmación
    if (msgLower === 'si' || msgLower === 'sí' || msgLower === 'confirmar' || msgLower === 'dale' || msgLower === 'ok') {
        return {
            success: true,
            interpretacion: {
                intencion: 'confirmar',
                productos: [],
                confianza: 90,
                respuestaSugerida: '✅ ¡Perfecto! Tu pedido está confirmado. Te avisamos cuando salga.',
            },
            usandoIA: false,
        }
    }

    // Detectar cancelación
    if (msgLower.includes('cancel') || msgLower === 'no') {
        return {
            success: true,
            interpretacion: {
                intencion: 'cancelar',
                productos: [],
                confianza: 85,
                respuestaSugerida: 'Entendido, cancelamos la operación. ¿Te puedo ayudar en algo más?',
            },
            usandoIA: false,
        }
    }

    // Intentar detectar pedido con regex básico
    const productos: Array<{ nombre: string; cantidad: number; unidad: string }> = []

    // Patrones como "5 kg de ala", "2 cajones de patamuslo"
    const patronCantidad = /(\d+(?:\.\d+)?)\s*(kg|kilos?|cajón|cajones?|unidad|unidades?)?\s*(?:de\s+)?(ala|patamuslo|pechuga|filet|pollo|menudo|puchero|suprema|muslo|pata)/gi

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
                respuestaSugerida: `Perfecto, anotado: ${productos.map(p => `${p.cantidad} ${p.unidad} de ${p.nombre}`).join(', ')}. ¿Confirmamos el pedido?`,
            },
            usandoIA: false,
        }
    }

    // No se pudo interpretar
    return {
        success: true,
        interpretacion: {
            intencion: 'otro',
            productos: [],
            confianza: 30,
            respuestaSugerida: 'Disculpá, no entendí tu mensaje. ¿Podés contarme qué necesitás? Por ejemplo: "Quiero 5 kg de ala para mañana"',
        },
        usandoIA: false,
    }
}

/**
 * Genera una respuesta contextual usando IA
 */
export async function generarRespuestaIA(
    contexto: {
        cliente: string
        ultimoMensaje: string
        productos?: Array<{ nombre: string; precio: number }>
        pedidoActual?: any
    }
): Promise<string> {
    try {
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_FLASH })

        const prompt = `Eres el bot de WhatsApp de una avícola argentina. Genera una respuesta amigable y concisa.

Cliente: ${contexto.cliente}
Último mensaje: "${contexto.ultimoMensaje}"
${contexto.productos ? `Productos disponibles: ${JSON.stringify(contexto.productos)}` : ''}
${contexto.pedidoActual ? `Pedido actual: ${JSON.stringify(contexto.pedidoActual)}` : ''}

Genera una respuesta corta, amigable, en español argentino (máximo 2 líneas). 
Usa emojis moderadamente.
No uses markdown.`

        const result = await model.generateContent(prompt)
        return result.response.text().trim()
    } catch (error) {
        console.error('[IA] Error generando respuesta:', error)
        return 'Disculpá, hubo un problema. ¿Podés repetir tu mensaje?'
    }
}
