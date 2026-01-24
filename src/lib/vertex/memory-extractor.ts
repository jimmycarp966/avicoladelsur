/**
 * Memory Extractor - Extrae hechos y preferencias de conversaciones
 * 
 * Usa Gemini para analizar conversaciones y extraer información útil
 * que se guarda en el CustomerContext para personalizar futuras interacciones.
 */

import { VertexAI } from '@google-cloud/vertexai'
import { ensureGoogleApplicationCredentials } from './ensure-google-credentials'

ensureGoogleApplicationCredentials()

const vertexAI = new VertexAI({
    project: process.env.GOOGLE_CLOUD_PROJECT_ID || 'gen-lang-client-0184145853',
    location: 'us-central1',
})

const MODEL_NAME = 'gemini-1.5-flash-001'

export interface ExtractedFacts {
    tipo_negocio?: string        // ej: "restaurante", "carnicería", "familia"
    dia_preferido?: string       // ej: "viernes", "lunes"
    horario_preferido?: string   // ej: "mañana", "tarde"
    zona_mencionada?: string     // ej: "Monteros", "Concepción"
    productos_favoritos?: string[] // productos que menciona frecuentemente
    cantidad_tipica?: string     // ej: "grandes cantidades", "porciones chicas"
    observaciones?: string       // cualquier otro dato relevante
    confianza: number            // 0-100 qué tan seguro está de los hechos
}

/**
 * Extrae hechos y preferencias de una conversación usando Gemini
 * Se ejecuta en background para no bloquear la respuesta al usuario
 */
export async function extractFactsFromConversation(
    messages: Array<{ role: string; content: string }>
): Promise<ExtractedFacts | null> {
    try {
        // Necesitamos al menos 2 mensajes para extraer algo útil
        if (messages.length < 2) {
            return null
        }

        const model = vertexAI.getGenerativeModel({ model: MODEL_NAME })

        // Construir el historial para análisis
        const conversacion = messages
            .slice(-6) // últimos 6 mensajes
            .map(m => `${m.role === 'user' ? 'Cliente' : 'Bot'}: ${m.content}`)
            .join('\n')

        const prompt = `Analiza esta conversación de WhatsApp de una avícola y extrae información útil sobre el cliente.

CONVERSACIÓN:
${conversacion}

Extrae SOLO hechos que el cliente mencionó explícitamente. No inventes información.

Responde SOLO con un JSON válido con esta estructura (campos opcionales, incluir solo si hay evidencia clara):
{
  "tipo_negocio": "restaurante|carnicería|rotisería|hotel|familia|otro",
  "dia_preferido": "día de la semana si lo menciona",
  "horario_preferido": "mañana|tarde si lo menciona",
  "zona_mencionada": "localidad o zona si la menciona",
  "productos_favoritos": ["lista de productos que pide frecuentemente"],
  "cantidad_tipica": "descripción de las cantidades típicas",
  "observaciones": "cualquier otro dato relevante del cliente",
  "confianza": 0-100
}

Si no hay información clara para extraer, responde: {"confianza": 0}`

        const result = await model.generateContent(prompt)
        const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || ''

        // Limpiar y parsear
        const cleaned = text
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim()

        try {
            const facts = JSON.parse(cleaned) as ExtractedFacts

            // Solo retornar si hay confianza mínima
            if (facts.confianza && facts.confianza >= 30) {
                return facts
            }

            return null
        } catch {
            console.warn('[Memory Extractor] JSON inválido:', cleaned)
            return null
        }
    } catch (error) {
        console.error('[Memory Extractor] Error:', error)
        return null
    }
}

/**
 * Combina hechos nuevos con hechos existentes
 * Los nuevos tienen prioridad si contradicen los anteriores
 * Retorna los hechos combinados y una lista de campos importantes que cambiaron
 */
export function mergeLearnedFacts(
    existing: Partial<ExtractedFacts> | undefined,
    newFacts: ExtractedFacts
): { merged: ExtractedFacts, changes: string[] } {
    if (!existing) {
        // Si no había nada previo, todo es un cambio si tiene confianza alta
        const changes = []
        if (newFacts.tipo_negocio) changes.push('tipo_negocio')
        if (newFacts.dia_preferido) changes.push('dia_preferido')
        if (newFacts.horario_preferido) changes.push('horario_preferido')
        
        return { merged: newFacts, changes }
    }

    const changes: string[] = []
    
    // Detectar cambios en campos importantes
    if (newFacts.tipo_negocio && newFacts.tipo_negocio !== existing.tipo_negocio) {
        changes.push('tipo_negocio')
    }
    if (newFacts.dia_preferido && newFacts.dia_preferido !== existing.dia_preferido) {
        changes.push('dia_preferido')
    }
    if (newFacts.horario_preferido && newFacts.horario_preferido !== existing.horario_preferido) {
        changes.push('horario_preferido')
    }

    // Combinar productos favoritos (sin duplicados)
    const productosCombinados = [
        ...(existing.productos_favoritos || []),
        ...(newFacts.productos_favoritos || [])
    ]
    const productosUnicos = [...new Set(productosCombinados)]

    // Combinar observaciones
    const observacionesCombinadas = [existing.observaciones, newFacts.observaciones]
        .filter(Boolean)
        .join('. ')

    const merged: ExtractedFacts = {
        tipo_negocio: newFacts.tipo_negocio || existing.tipo_negocio,
        dia_preferido: newFacts.dia_preferido || existing.dia_preferido,
        horario_preferido: newFacts.horario_preferido || existing.horario_preferido,
        zona_mencionada: newFacts.zona_mencionada || existing.zona_mencionada,
        productos_favoritos: productosUnicos.length > 0 ? productosUnicos.slice(0, 10) : undefined,
        cantidad_tipica: newFacts.cantidad_tipica || existing.cantidad_tipica,
        observaciones: observacionesCombinadas || undefined,
        confianza: Math.max(existing.confianza || 0, newFacts.confianza)
    }

    return { merged, changes }
}

/**
 * Genera un mensaje de confirmación amigable para los hechos aprendidos
 */
export function generateConfirmationMessage(facts: ExtractedFacts, changes: string[]): string | null {
    if (changes.length === 0) return null

    const messages: string[] = []

    if (changes.includes('dia_preferido') && facts.dia_preferido) {
        messages.push(`que preferís las entregas los *${facts.dia_preferido}*`)
    }
    
    if (changes.includes('tipo_negocio') && facts.tipo_negocio) {
        const tipo = facts.tipo_negocio === 'familia' ? 'para tu hogar' : `para tu *${facts.tipo_negocio}*`
        messages.push(`que tus pedidos son ${tipo}`)
    }

    if (changes.includes('horario_preferido') && facts.horario_preferido) {
        messages.push(`que te queda mejor recibir por la *${facts.horario_preferido}*`)
    }

    if (messages.length === 0) return null

    let text = `📝 *Anotado:* Me guardo ${messages.join(' y ')} para tenerlo en cuenta en tus próximos pedidos.`
    text += `\n\n_(Si algo está mal, avisame y lo corrijo)_`

    return text
}

