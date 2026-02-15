/**
 * GET /api/ia/clientes-riesgo
 * Endpoint legacy (deprecado): mantiene compatibilidad y agrega metadata IA estandar.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GEMINI_MODEL_FLASH } from '@/lib/constants/gemini-models'
import { getGeminiModel } from '@/lib/ai/runtime'
import { createAIMetadata } from '@/lib/ai/metadata'
import { logAIUsage } from '@/lib/ai/logger'
import type { AIMetadata } from '@/types/ai.types'

interface ClienteRiesgo {
  id: string
  nombre: string
  email?: string
  telefono?: string
  ultimaCompra: string
  diasSinComprar: number
  promedioDiasEntreCompras: number
  reduccionPorcentaje: number
  nivelRiesgo: 'alto' | 'medio' | 'bajo'
  razon: string
  sugerencia: string
}

interface ClienteRiesgoResponse {
  success: boolean
  data?: ClienteRiesgo[]
  total?: number
  error?: string
  usandoIA?: boolean
  ai: AIMetadata
}

interface GeminiClienteSugerencia {
  id: string
  razonIA: string
  accionSugerida: string
}

async function enriquecerClientesConGemini(clientes: ClienteRiesgo[]): Promise<{
  updated: ClienteRiesgo[]
  used: boolean
  fallbackUsed: boolean
  reason: string
}> {
  const model = getGeminiModel(GEMINI_MODEL_FLASH)

  if (!model) {
    return {
      updated: clientes,
      used: false,
      fallbackUsed: true,
      reason: 'Gemini no configurado. Se mantuvo scoring estadistico.',
    }
  }

  const candidatos = clientes.filter((c) => c.nivelRiesgo === 'alto' || c.nivelRiesgo === 'medio').slice(0, 10)

  if (candidatos.length === 0) {
    return {
      updated: clientes,
      used: false,
      fallbackUsed: false,
      reason: 'No hubo clientes de riesgo medio/alto para enriquecer con IA.',
    }
  }

  try {
    const payload = candidatos.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      nivelRiesgo: c.nivelRiesgo,
      diasSinComprar: c.diasSinComprar,
      promedioDiasEntreCompras: c.promedioDiasEntreCompras,
      reduccionPorcentaje: c.reduccionPorcentaje,
      razonActual: c.razon,
      sugerenciaActual: c.sugerencia,
    }))

    const prompt = `Eres analista comercial de una avicola. Debes mejorar acciones para retencion de clientes.
Devuelve SOLO JSON valido con un array:
[
  { "id": "clienteId", "razonIA": "insight breve", "accionSugerida": "accion concreta" }
]

Clientes:
${JSON.stringify(payload, null, 2)}

Reglas:
- No inventar ids.
- Escribir recomendaciones comerciales accionables.
- Limite: 140 caracteres por texto.`

    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('Gemini no devolvio lista JSON valida')
    }

    const sugerencias = JSON.parse(jsonMatch[0]) as GeminiClienteSugerencia[]
    const byId = new Map(sugerencias.map((s) => [s.id, s]))

    const updated = clientes.map((cliente) => {
      const extra = byId.get(cliente.id)
      if (!extra) return cliente

      return {
        ...cliente,
        razon: extra.razonIA || cliente.razon,
        sugerencia: extra.accionSugerida || cliente.sugerencia,
      }
    })

    return {
      updated,
      used: true,
      fallbackUsed: false,
      reason: 'Gemini enriquecio razones y acciones para clientes en riesgo.',
    }
  } catch (error) {
    console.error('[IA] Error enriqueciendo clientes-riesgo con Gemini:', error)
    return {
      updated: clientes,
      used: false,
      fallbackUsed: true,
      reason: 'Fallo Gemini; se mantuvieron razones y acciones estadisticas.',
    }
  }
}

export async function GET(_request: NextRequest): Promise<NextResponse<ClienteRiesgoResponse>> {
  const startedAt = Date.now()

  try {
    const supabase = await createClient()

    const { data: clientes, error: clientesError } = await supabase
      .from('clientes')
      .select(
        `
        id,
        nombre,
        email,
        telefono,
        created_at,
        pedidos (
          id,
          created_at,
          total_final,
          estado
        )
      `
      )
      .eq('activo', true)
      .order('created_at', { ascending: false })

    if (clientesError) throw clientesError

    const clientesEnRiesgo: ClienteRiesgo[] = []
    const hoy = new Date()
    const hace30Dias = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000)
    const hace60Dias = new Date(hoy.getTime() - 60 * 24 * 60 * 60 * 1000)

    for (const cliente of clientes || []) {
      const pedidosEntregados = (cliente.pedidos || [])
        .filter((p: any) => p.estado === 'entregado')
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      if (pedidosEntregados.length < 2) continue

      const ultimoPedido = pedidosEntregados[0]
      const fechaUltimoPedido = new Date(ultimoPedido.created_at)
      const diasSinComprar = Math.floor((hoy.getTime() - fechaUltimoPedido.getTime()) / (24 * 60 * 60 * 1000))

      let sumaDias = 0
      for (let i = 0; i < pedidosEntregados.length - 1 && i < 10; i++) {
        const fecha1 = new Date(pedidosEntregados[i].created_at)
        const fecha2 = new Date(pedidosEntregados[i + 1].created_at)
        sumaDias += (fecha1.getTime() - fecha2.getTime()) / (24 * 60 * 60 * 1000)
      }
      const promedioDiasEntreCompras = sumaDias / Math.min(pedidosEntregados.length - 1, 9)

      const pedidosUltimos30Dias = pedidosEntregados.filter((p: any) => new Date(p.created_at) >= hace30Dias)
      const pedidos30a60Dias = pedidosEntregados.filter(
        (p: any) => new Date(p.created_at) >= hace60Dias && new Date(p.created_at) < hace30Dias
      )

      const totalUltimos30 = pedidosUltimos30Dias.reduce((sum: number, p: any) => sum + (p.total_final || 0), 0)
      const total30a60 = pedidos30a60Dias.reduce((sum: number, p: any) => sum + (p.total_final || 0), 0)

      let reduccionPorcentaje = 0
      if (total30a60 > 0) {
        reduccionPorcentaje = Math.round(((total30a60 - totalUltimos30) / total30a60) * 100)
      }

      let nivelRiesgo: ClienteRiesgo['nivelRiesgo'] = 'bajo'
      let razon = ''
      let sugerencia = ''

      if (diasSinComprar > promedioDiasEntreCompras * 2) {
        nivelRiesgo = 'alto'
        razon = `Sin compras hace ${diasSinComprar} dias (promedio: ${Math.round(promedioDiasEntreCompras)} dias)`
        sugerencia = 'Contactar urgente para conocer motivo.'
      } else if (reduccionPorcentaje >= 50) {
        nivelRiesgo = 'alto'
        razon = `Redujo ${reduccionPorcentaje}% sus compras en los ultimos 30 dias`
        sugerencia = 'Ofrecer promocion o descuento especial.'
      } else if (reduccionPorcentaje >= 30 || diasSinComprar > promedioDiasEntreCompras * 1.5) {
        nivelRiesgo = 'medio'
        razon = reduccionPorcentaje >= 30 ? `Redujo ${reduccionPorcentaje}% sus compras` : `${diasSinComprar} dias sin comprar`
        sugerencia = 'Enviar mensaje de seguimiento.'
      } else {
        continue
      }

      clientesEnRiesgo.push({
        id: cliente.id,
        nombre: cliente.nombre,
        email: cliente.email,
        telefono: cliente.telefono,
        ultimaCompra: ultimoPedido.created_at,
        diasSinComprar,
        promedioDiasEntreCompras: Math.round(promedioDiasEntreCompras),
        reduccionPorcentaje,
        nivelRiesgo,
        razon,
        sugerencia,
      })
    }

    clientesEnRiesgo.sort((a, b) => {
      const riesgoOrder = { alto: 0, medio: 1, bajo: 2 }
      if (riesgoOrder[a.nivelRiesgo] !== riesgoOrder[b.nivelRiesgo]) {
        return riesgoOrder[a.nivelRiesgo] - riesgoOrder[b.nivelRiesgo]
      }
      return b.diasSinComprar - a.diasSinComprar
    })

    const aiEnrichment = await enriquecerClientesConGemini(clientesEnRiesgo)

    const ai = createAIMetadata({
      strategy: 'assisted',
      used: aiEnrichment.used,
      provider: aiEnrichment.used ? 'gemini' : 'none',
      model: aiEnrichment.used ? GEMINI_MODEL_FLASH : null,
      fallbackUsed: aiEnrichment.fallbackUsed,
      reason: aiEnrichment.reason,
      startedAt,
      deprecated: true,
      deprecatedMessage:
        'Endpoint legacy. Migrar a /api/predictions/customer-risk para semantica mas clara.',
    })

    logAIUsage({ endpoint: '/api/ia/clientes-riesgo', feature: 'clientes_riesgo', success: true, ai })

    return NextResponse.json({
      success: true,
      data: aiEnrichment.updated.slice(0, 20),
      total: aiEnrichment.updated.length,
      usandoIA: aiEnrichment.used,
      ai,
    })
  } catch (error) {
    console.error('[IA] Error en clientes-riesgo:', error)

    const ai = createAIMetadata({
      strategy: 'assisted',
      used: false,
      provider: 'none',
      model: null,
      fallbackUsed: false,
      reason: 'Error no controlado al analizar clientes en riesgo.',
      startedAt,
      deprecated: true,
      deprecatedMessage:
        'Endpoint legacy. Migrar a /api/predictions/customer-risk para semantica mas clara.',
    })

    logAIUsage({
      endpoint: '/api/ia/clientes-riesgo',
      feature: 'clientes_riesgo',
      success: false,
      ai,
      error: error instanceof Error ? error.message : 'unknown',
    })

    return NextResponse.json({
      success: false,
      error: 'Error al analizar clientes en riesgo',
      ai,
    })
  }
}
