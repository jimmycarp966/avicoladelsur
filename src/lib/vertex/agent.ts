/**
 * Vertex AI Agent para Bot WhatsApp
 * Orquesta conversaciones con Gemini y tools
 */

import { VertexAI } from '@google-cloud/vertexai'
import { getOrCreateSession, updateSession } from './session-manager'
import { crearPresupuestoTool } from './tools/crear-presupuesto'
import { consultarStockTool } from './tools/consultar-stock'
import { consultarEstadoTool } from './tools/consultar-estado'
import { consultarSaldoTool } from './tools/consultar-saldo'
import { crearReclamoTool } from './tools/crear-reclamo'
import { consultarPreciosTool } from './tools/consultar-precios'
import { gestionarNotificacionesTool, detectarIntencionNotificaciones } from './tools/gestionar-notificaciones'
import { SYSTEM_PROMPT, generatePersonalizedContext } from './prompts/system-prompt'
import { createAdminClient } from '@/lib/supabase/server'
import { ensureGoogleApplicationCredentials } from './ensure-google-credentials'

// Configuración de Vertex AI
ensureGoogleApplicationCredentials()
const vertexAI = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT_ID || 'gen-lang-client-0184145853',
  location: 'us-central1',
})

// Modelo Gemini a usar
const MODEL_NAME = 'gemini-1.5-flash-001'

export interface AgentResponse {
  text: string
  toolCalls?: Array<{
    name: string
    parameters: any
  }>
  context?: Record<string, any>
}

function extractTextFromResponse(resp: any): string {
  return (
    resp?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p?.text)
      ?.filter(Boolean)
      ?.join('') ||
    ''
  )
}

/**
 * Procesa un mensaje del usuario y genera una respuesta
 */
export async function processMessage(
  phoneNumber: string,
  message: string
): Promise<AgentResponse> {
  try {
    // Obtener o crear sesión
    const session = await getOrCreateSession(phoneNumber)

    // Construir historial de conversación
    const history = session.history.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }))

    // Crear modelo con system prompt
    const model = vertexAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: SYSTEM_PROMPT
    })

    // Generar respuesta
    const chat = model.startChat({ history })
    const result = await chat.sendMessage(message)
    const response = result.response
    const text = extractTextFromResponse(response)

    // Actualizar sesión
    await updateSession(session.sessionId, {
      role: 'user',
      content: message
    })

    await updateSession(session.sessionId, {
      role: 'assistant',
      content: text
    })

    return {
      text,
      context: session.customerContext
    }
  } catch (error) {
    console.error('[Vertex AI Agent] Error:', error)
    throw error
  }
}

/**
 * Procesa mensaje con detección de intent y ejecución de tools
 */
export async function processMessageWithTools(
  phoneNumber: string,
  message: string,
  clienteId?: string
): Promise<AgentResponse> {
  try {
    // Obtener sesión
    const session = await getOrCreateSession(phoneNumber)

    // Generar contexto personalizado basado en hechos aprendidos
    const personalizedContext = generatePersonalizedContext(
      session.customerContext?.learned_facts,
      session.customerContext?.nombre
    )

    // Crear modelo con system prompt + contexto personalizado
    const model = vertexAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: SYSTEM_PROMPT + personalizedContext
    })

    // Construir contexto de historial reciente (últimos 8 mensajes)
    const historialReciente = session.history.length > 0
      ? session.history.slice(-8)
        .map(m => `${m.role === 'user' ? 'Cliente' : 'Bot'}: ${m.content.substring(0, 200)}`)
        .join('\n')
      : ''

    // Prompt para detectar intención CON contexto conversacional
    const intentPrompt = `Analiza el siguiente mensaje de WhatsApp y determina la intención del usuario.
 ${historialReciente ? `\nContexto de la conversación:\n${historialReciente}\n` : ''}
 Mensaje actual: "${message}"

 Posibles intenciones:
 - pedido: El cliente quiere hacer un pedido o menciona productos con cantidades
 - consulta_precio: El cliente pregunta por precios, lista de precios, cuánto cuesta algo, o responde "completa/todos" a una pregunta sobre precios
 - consulta_stock: El cliente pregunta por productos disponibles o stock
 - consulta_estado: El cliente pregunta por el estado de un pedido
 - consulta_saldo: El cliente pregunta por su saldo pendiente
 - reclamo: El cliente quiere hacer un reclamo
 - notificaciones: El cliente quiere ver o configurar sus preferencias de notificaciones
 - saludo: El cliente está saludando
 - otro: Cualquier otra intención

 IMPORTANTE: Si el mensaje es una respuesta corta como "completa", "todos", "si", "dale", etc., usa el CONTEXTO de la conversación para determinar la intención real.

 Responde SOLO con el nombre de la intención (ej: "pedido", "consulta_precio", "consulta_stock", etc.)`

    const intentResult = await model.generateContent(intentPrompt)
    const intent = extractTextFromResponse(intentResult.response).trim().toLowerCase()

    // Ejecutar tool según intención
    switch (intent) {
      case 'pedido':
        if (clienteId) {
          // Extraer productos del mensaje
          const productos = await extraerProductosDelMensaje(message)

          if (productos.length > 0) {
            const result = await crearPresupuestoTool({
              cliente_id: clienteId,
              productos
            })

            if (result.success) {
              let responseText = `¡Perfecto! Creé tu presupuesto ${result.numero_presupuesto} por un total de $${result.total_estimado}.

¿Para cuándo lo querés (hoy/mañana) y en qué turno (mañana/tarde)?`

              if (result.upselling_suggestion) {
                responseText += `\n\n${result.upselling_suggestion.mensaje}`
              }

              return {
                text: responseText,
                context: { 
                  presupuesto_id: result.presupuesto_id,
                  upselling_product_id: result.upselling_suggestion?.producto_id
                }
              }
            } else {
              return {
                text: `Hubo un error creando el presupuesto: ${result.error}. ¿Podés intentarlo de otra forma?`
              }
            }
          } else {
            // No se detectaron productos - insistir para que agregue al menos uno
            const supabase = createAdminClient()
            const { data: productosDisponibles } = await supabase
              .from('productos')
              .select('nombre')
              .eq('activo', true)
              .limit(8)
              .order('nombre', { ascending: true })

            const listaProductos = productosDisponibles?.map((p: any) => p.nombre).join(', ') || 'Ala, Pechuga, Muslo, Filet'

            return {
              text: `¡Genial que quieras hacer un pedido! 🛒

Para armar tu presupuesto necesito saber qué productos querés llevar.

📦 *Productos disponibles:*
${listaProductos}

Por ejemplo, podés escribir:
• "5 kg de ala y 3 kg de pechuga"
• "2 cajones de filet"

¿Qué te gustaría llevar?`
            }
          }
        }
        break

      case 'consulta_precio': {
        // Extraer posible nombre de producto del mensaje
        const productoFiltro = message.toLowerCase().replace(/precio|cuesta|cuanto|cuánto|lista|precios?/gi, '').trim()

        const preciosResult = await consultarPreciosTool({
          cliente_id: clienteId,
          producto_nombre: productoFiltro.length > 2 ? productoFiltro : undefined,
          mostrar_todos: productoFiltro.length <= 2
        })

        if (preciosResult.success && preciosResult.productos && preciosResult.productos.length > 0) {
          const listaPrecios = preciosResult.productos
            .map(p => `• ${p.nombre}: $${p.precio.toLocaleString('es-AR')}/${p.unidad_medida}`)
            .join('\n')

          return {
            text: `📋 *Lista de Precios* (${preciosResult.lista_nombre})

${listaPrecios}

💡 Para hacer un pedido, escribí algo como:
"Quiero 5 kg de pechuga y 3 kg de ala"`
          }
        } else {
          return {
            text: `No encontré productos con ese nombre. ¿Podés ser más específico?

Escribí "lista de precios" para ver todos los productos disponibles.`
          }
        }
      }

      case 'consulta_stock':
        const stockResult = await consultarStockTool({
          producto_nombre: message
        })

        if (stockResult.success && stockResult.productos) {
          const productosList = stockResult.productos
            .map(p => `- ${p.nombre}: ${p.stock_disponible} ${p.unidad_medida}`)
            .join('\n')
          return {
            text: `Tenemos disponibles:\n${productosList}\n\n¿Querés que te arme un presupuesto con algo de esto?`
          }
        }
        break

      case 'consulta_estado':
        if (clienteId) {
          const estadoResult = await consultarEstadoTool({
            cliente_id: clienteId
          })

          if (estadoResult.success && estadoResult.pedidos) {
            const pedidosList = estadoResult.pedidos
              .map(p => `- ${p.numero_pedido}: ${p.estado}`)
              .join('\n')
            return {
              text: `Tus pedidos:\n${pedidosList}`
            }
          }
        }
        break

      case 'consulta_saldo':
        if (clienteId) {
          const saldoResult = await consultarSaldoTool({
            cliente_id: clienteId
          })

          if (saldoResult.success) {
            const saldo = saldoResult.saldo || 0
            const limite_credito = saldoResult.limite_credito || 0
            const credito_disponible = saldoResult.credito_disponible || 0
            const bloqueado = saldoResult.bloqueado || false
            const mensaje = bloqueado
              ? `⚠️ Tu cuenta está bloqueada por saldo pendiente.\n\nSaldo actual: $${saldo.toFixed(2)}\nLímite de crédito: $${limite_credito.toFixed(2)}\n\nPor favor regulariza tu cuenta para realizar nuevos pedidos.`
              : `💰 Tu saldo actual: $${saldo.toFixed(2)}\nLímite de crédito: $${limite_credito.toFixed(2)}\nCrédito disponible: $${credito_disponible.toFixed(2)}`
            return { text: mensaje }
          }
        }
        break

      case 'reclamo':
        if (clienteId) {
          // Extraer tipo de reclamo y descripción del mensaje
          const reclamoData = await extraerReclamoDelMensaje(message)

          if (reclamoData) {
            const result = await crearReclamoTool({
              cliente_id: clienteId,
              tipo_reclamo: reclamoData.tipo as 'producto_dañado' | 'entrega_tardia' | 'cantidad_erronea' | 'producto_equivocado' | 'precio_incorrecto' | 'calidad_deficiente' | 'empaque_dañado' | 'otro',
              descripcion: reclamoData.descripcion,
              prioridad: 'media'
            })

            if (result.success) {
              return {
                text: `✅ Reclamo creado exitosamente.\n\nNúmero: ${result.numero_reclamo}\nTipo: ${reclamoData.tipo}\n\nNuestro equipo revisará tu caso y te contactará pronto.`
              }
            } else {
              return {
                text: `Hubo un error creando el reclamo: ${result.error}. ¿Podés intentarlo de otra forma?`
              }
            }
          }
        }
        break

      case 'notificaciones':
        if (clienteId) {
          const notificacionesParams = detectarIntencionNotificaciones(message) || { accion: 'ver' }
          const notificacionesResult = await gestionarNotificacionesTool(
            notificacionesParams,
            { cliente_id: clienteId }
          )
          return {
            text: notificacionesResult.message
          }
        }
        break
    }

    // Si no se ejecutó ninguna tool, usar respuesta normal de Gemini
    return await processMessage(phoneNumber, message)
  } catch (error) {
    console.error('[Vertex AI Agent] Error con tools:', error)
    throw error
  }
}

/**
 * Extrae productos de un mensaje usando Gemini con lista real de Supabase
 */
async function extraerProductosDelMensaje(
  message: string
): Promise<Array<{ producto_id: string; nombre: string; cantidad: number }>> {
  try {
    const supabase = createAdminClient()

    // Obtener lista real de productos activos desde Supabase
    const { data: productosDB, error: prodError } = await supabase
      .from('productos')
      .select('id, codigo, nombre')
      .eq('activo', true)
      .order('nombre', { ascending: true })

    if (prodError || !productosDB || productosDB.length === 0) {
      console.error('[Extraer Productos] Error obteniendo productos de BD:', prodError)
      return []
    }

    // Construir lista de productos para el prompt
    const listaProductos = productosDB
      .map((p: any) => `${p.codigo}: ${p.nombre}`)
      .join('\n')

    const model = vertexAI.getGenerativeModel({
      model: MODEL_NAME
    })

    const prompt = `Extrae los productos y cantidades del siguiente mensaje de WhatsApp:

"${message}"

Lista de productos disponibles (CÓDIGO: NOMBRE):
${listaProductos}

REGLAS:
- Identifica los productos mencionados en el mensaje
- Usa el CÓDIGO exacto del producto (no el nombre)
- Si mencionan un producto parcialmente (ej: "ala", "pechuga"), encuentra el más cercano
- Las cantidades pueden estar en kg, unidades o cajones

Responde SOLO con un JSON válido. Ejemplo:
[
  {"codigo": "ALA", "cantidad": 5},
  {"codigo": "PECH", "cantidad": 10}
]

Si no mencionan productos claramente, devuelve un array vacío []`

    const result = await model.generateContent(prompt)
    const text = extractTextFromResponse(result.response)

    // Limpiar respuesta
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let parsed: Array<{ codigo: string; cantidad: number }> = []
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.warn('[Extraer Productos] JSON inválido:', cleaned)
      return []
    }

    if (!Array.isArray(parsed) || parsed.length === 0) return []

    // Resolver productos por código o nombre
    const resolved: Array<{ producto_id: string; nombre: string; cantidad: number }> = []

    for (const item of parsed) {
      const codigo = (item?.codigo || '').toString().trim().toUpperCase()
      const cantidad = Number(item?.cantidad || 0)
      if (!codigo || !Number.isFinite(cantidad) || cantidad <= 0) continue

      // Buscar primero por código exacto, luego por nombre similar
      let producto = productosDB.find((p: any) =>
        p.codigo.toUpperCase() === codigo
      )

      if (!producto) {
        // Buscar por nombre similar
        producto = productosDB.find((p: any) =>
          p.nombre.toUpperCase().includes(codigo) ||
          codigo.includes(p.nombre.toUpperCase().slice(0, 3))
        )
      }

      if (producto) {
        resolved.push({
          producto_id: producto.id,
          nombre: producto.nombre,
          cantidad: cantidad
        })
      }
    }

    return resolved
  } catch (error) {
    console.error('[Extraer Productos] Error:', error)
    return []
  }
}

/**
 * Extrae información de reclamo de un mensaje usando Gemini
 */
async function extraerReclamoDelMensaje(
  message: string
): Promise<{ tipo: string; descripcion: string } | null> {
  try {
    const model = vertexAI.getGenerativeModel({
      model: MODEL_NAME
    })

    const prompt = `Analiza el siguiente mensaje de WhatsApp y extrae la información del reclamo:

"${message}"

Tipos de reclamo posibles:
- producto_dañado: El producto llegó dañado o en mal estado
- entrega_tardia: La entrega llegó tarde o no llegó
- cantidad_erronea: La cantidad entregada no coincide con lo pedido
- producto_equivocado: Entregaron un producto diferente al pedido
- precio_incorrecto: El precio cobrado no coincide con lo acordado
- calidad_deficiente: La calidad del producto no es la esperada
- empaque_dañado: El empaque está roto o dañado
- otro: Cualquier otro problema

Responde SOLO con un JSON válido:
{
  "tipo": "TIPO_RECLAMO",
  "descripcion": "DESCRIPCION_DETALLADA_DEL_PROBLEMA"
}

Si no hay un reclamo claro, devuelve null`

    const result = await model.generateContent(prompt)
    const text = extractTextFromResponse(result.response)

    // Limpiar respuesta
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    if (cleaned.toLowerCase() === 'null') return null

    try {
      const parsed = JSON.parse(cleaned)
      if (parsed.tipo && parsed.descripcion) {
        return {
          tipo: parsed.tipo,
          descripcion: parsed.descripcion
        }
      }
    } catch {
      return null
    }

    return null
  } catch (error) {
    console.error('[Extraer Reclamo] Error:', error)
    return null
  }
}

/**
 * Extrae hechos de la conversación y los guarda en el CustomerContext
 * Se ejecuta en background (fire-and-forget) para no bloquear la respuesta
 */
export async function extractAndSaveFactsInBackground(
  phoneNumber: string
): Promise<void> {
  try {
    // Importar dinámicamente para evitar dependencias circulares
    const { extractFactsFromConversation, mergeLearnedFacts, generateConfirmationMessage } = await import('./memory-extractor')
    const { getOrCreateSession, updateCustomerContext, saveCustomerMemory } = await import('./session-manager')
    const { sendWhatsAppMessage } = await import('@/lib/services/whatsapp-meta')

    const session = await getOrCreateSession(phoneNumber)

    // Solo extraer si hay suficiente historial
    if (session.history.length < 4) {
      return
    }

    // Solo extraer si pasó al menos 5 minutos desde la última extracción
    const ultimaExtraccion = session.customerContext?.learned_facts?.ultima_extraccion
    if (ultimaExtraccion) {
      const minutosDesdeUltima = (Date.now() - new Date(ultimaExtraccion).getTime()) / 1000 / 60
      if (minutosDesdeUltima < 5) {
        return
      }
    }

    // Extraer hechos
    const newFacts = await extractFactsFromConversation(session.history)

    if (newFacts && newFacts.confianza >= 30) {
      // Combinar con hechos existentes
      const { merged: mergedFacts, changes } = mergeLearnedFacts(
        session.customerContext?.learned_facts,
        newFacts
      )

      // Agregar timestamp
      const factsWithTimestamp = {
        ...mergedFacts,
        ultima_extraccion: new Date().toISOString()
      }

      // Guardar en sesión (expira en 24h)
      await updateCustomerContext(phoneNumber, {
        learned_facts: factsWithTimestamp
      })

      // Guardar en memoria persistente (no expira) si tenemos cliente_id
      if (session.customerContext?.cliente_id) {
        await saveCustomerMemory(session.customerContext.cliente_id, factsWithTimestamp)
      }

      // Generar y enviar mensaje de confirmación si hubo cambios importantes
      const confirmationMessage = generateConfirmationMessage(factsWithTimestamp, changes)
      if (confirmationMessage) {
        await sendWhatsAppMessage({
          to: phoneNumber,
          text: confirmationMessage
        })
        console.log(`[Memory Bank] Confirmación enviada a ${phoneNumber}: ${confirmationMessage}`)
      }

      console.log(`[Memory Bank] Hechos extraídos para ${phoneNumber}:`, factsWithTimestamp)
    }
  } catch (error) {
    // No fallar silenciosamente pero no bloquear
    console.error('[Memory Bank] Error extrayendo hechos:', error)
  }
}

