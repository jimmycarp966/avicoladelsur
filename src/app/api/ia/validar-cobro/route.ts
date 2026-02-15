/**
 * POST /api/ia/validar-cobro
 * Endpoint legacy (deprecado): mantiene compatibilidad.
 */

import { NextRequest, NextResponse } from 'next/server'
import { GEMINI_MODEL_FLASH } from '@/lib/constants/gemini-models'
import { createAIMetadata } from '@/lib/ai/metadata'
import { logAIUsage } from '@/lib/ai/logger'
import { getGeminiModel } from '@/lib/ai/runtime'
import type { AIMetadata } from '@/types/ai.types'

interface ValidarCobroRequest {
  pedidoId: string
  pedidoNumero: string
  totalPedido: number
  montoCobrado: number
  descuentoAplicado: number
  metodoPago: string
  clienteNombre: string
  usuarioNombre: string
  historialDescuentos?: number[]
}

interface ValidarCobroResponse {
  success: boolean
  esAnomalo: boolean
  nivelRiesgo: 'alto' | 'medio' | 'bajo' | 'ninguno'
  alertas: string[]
  sugerencia?: string
  usandoIA?: boolean
  ai: AIMetadata
}

const LEGACY_DEPRECATED_MESSAGE =
  'Endpoint legacy. Migrar a /api/tesoreria/validar-cobro para semantica de dominio.'

export async function POST(request: NextRequest): Promise<NextResponse<ValidarCobroResponse>> {
  const startedAt = Date.now()

  try {
    const body: ValidarCobroRequest = await request.json()

    const alertas: string[] = []
    let nivelRiesgo: 'alto' | 'medio' | 'bajo' | 'ninguno' = 'ninguno'

    const porcentajeDescuento = body.totalPedido > 0 ? (body.descuentoAplicado / body.totalPedido) * 100 : 0

    if (porcentajeDescuento > 20) {
      alertas.push(`Descuento del ${porcentajeDescuento.toFixed(1)}% supera el limite del 20%`)
      nivelRiesgo = 'alto'
    } else if (porcentajeDescuento > 10) {
      alertas.push(`Descuento del ${porcentajeDescuento.toFixed(1)}% es alto (>10%)`)
      nivelRiesgo = nivelRiesgo === 'ninguno' ? 'medio' : nivelRiesgo
    }

    const diferencia = body.totalPedido - body.descuentoAplicado - body.montoCobrado
    const porcentajeDiferencia = body.totalPedido > 0 ? Math.abs((diferencia / body.totalPedido) * 100) : 0

    if (Math.abs(diferencia) > 100 && porcentajeDiferencia > 5) {
      alertas.push(`Diferencia de $${Math.abs(diferencia).toFixed(2)} entre total esperado y monto cobrado`)
      nivelRiesgo = 'alto'
    } else if (Math.abs(diferencia) > 50) {
      alertas.push(`Diferencia menor de $${Math.abs(diferencia).toFixed(2)} detectada`)
      nivelRiesgo = nivelRiesgo === 'ninguno' ? 'bajo' : nivelRiesgo
    }

    if (body.montoCobrado <= 0 && body.totalPedido > 0) {
      alertas.push('El monto cobrado es $0 o negativo')
      nivelRiesgo = 'alto'
    }

    if (body.historialDescuentos && body.historialDescuentos.length > 0) {
      const promedioDescuentosUsuario =
        body.historialDescuentos.reduce((a, b) => a + b, 0) / body.historialDescuentos.length

      if (porcentajeDescuento > promedioDescuentosUsuario * 2 && porcentajeDescuento > 5) {
        alertas.push(
          `Descuento inusual: ${porcentajeDescuento.toFixed(1)}% vs promedio historico ${promedioDescuentosUsuario.toFixed(1)}%`
        )
        nivelRiesgo = nivelRiesgo === 'ninguno' ? 'medio' : nivelRiesgo
      }
    }

    let sugerencia = ''
    let aiUsed = false
    let fallbackUsed = false
    let aiReason = 'Validacion resuelta solo con reglas.'

    if (nivelRiesgo === 'alto' && alertas.length > 0) {
      const model = getGeminiModel(GEMINI_MODEL_FLASH)

      if (model) {
        try {
          const prompt = `Eres un auditor de una empresa avicola. Se detecto una anomalia en un cobro:

Pedido: ${body.pedidoNumero}
Cliente: ${body.clienteNombre}
Total del pedido: $${body.totalPedido}
Descuento aplicado: $${body.descuentoAplicado} (${porcentajeDescuento.toFixed(1)}%)
Monto cobrado: $${body.montoCobrado}
Usuario que cobra: ${body.usuarioNombre}
Metodo de pago: ${body.metodoPago}

Alertas detectadas:
${alertas.map((a) => `- ${a}`).join('\n')}

En UNA sola oracion breve, sugiere que accion tomar (verificar, pedir autorizacion, rechazar, etc).`

          const result = await model.generateContent(prompt)
          sugerencia = result.response.text().trim()
          aiUsed = true
          aiReason = 'Gemini genero sugerencia para cobro de alto riesgo.'
        } catch (iaError) {
          console.error('[IA] Error con Gemini para sugerencia:', iaError)
          sugerencia = 'Verificar con supervisor antes de procesar este cobro.'
          fallbackUsed = true
          aiReason = 'Fallo Gemini; se uso sugerencia local de respaldo.'
        }
      } else {
        sugerencia = 'Verificar con supervisor antes de procesar este cobro.'
        fallbackUsed = true
        aiReason = 'Gemini no configurado; se uso sugerencia local de respaldo.'
      }
    }

    const ai = createAIMetadata({
      strategy: 'assisted',
      used: aiUsed,
      provider: aiUsed ? 'gemini' : 'none',
      model: aiUsed ? GEMINI_MODEL_FLASH : null,
      fallbackUsed,
      reason: aiReason,
      startedAt,
      deprecated: true,
      deprecatedMessage: LEGACY_DEPRECATED_MESSAGE,
    })

    logAIUsage({ endpoint: '/api/ia/validar-cobro', feature: 'validar_cobro', success: true, ai })

    return NextResponse.json({
      success: true,
      esAnomalo: alertas.length > 0,
      nivelRiesgo,
      alertas,
      sugerencia: sugerencia || undefined,
      usandoIA: aiUsed,
      ai,
    })
  } catch (error) {
    console.error('[IA] Error en validar-cobro:', error)

    const ai = createAIMetadata({
      strategy: 'assisted',
      used: false,
      provider: 'none',
      model: null,
      fallbackUsed: false,
      reason: 'Error no controlado en validacion de cobro.',
      startedAt,
      deprecated: true,
      deprecatedMessage: LEGACY_DEPRECATED_MESSAGE,
    })

    logAIUsage({
      endpoint: '/api/ia/validar-cobro',
      feature: 'validar_cobro',
      success: false,
      ai,
      error: error instanceof Error ? error.message : 'unknown',
    })

    return NextResponse.json({
      success: false,
      esAnomalo: false,
      nivelRiesgo: 'ninguno',
      alertas: [],
      ai,
    })
  }
}
