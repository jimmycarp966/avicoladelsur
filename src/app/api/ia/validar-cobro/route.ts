/**
 * POST /api/ia/validar-cobro
 * 
 * Endpoint que valida un cobro usando IA para detectar posibles anomalías
 * o fraudes (descuentos excesivos, montos incorrectos, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '')

interface ValidarCobroRequest {
    pedidoId: string
    pedidoNumero: string
    totalPedido: number
    montoCobrado: number
    descuentoAplicado: number
    metodoPago: string
    clienteNombre: string
    usuarioNombre: string
    historialDescuentos?: number[] // Descuentos previos del usuario
}

interface ValidarCobroResponse {
    success: boolean
    esAnomalo: boolean
    nivelRiesgo: 'alto' | 'medio' | 'bajo' | 'ninguno'
    alertas: string[]
    sugerencia?: string
    usandoIA?: boolean
}

export async function POST(request: NextRequest): Promise<NextResponse<ValidarCobroResponse>> {
    try {
        const body: ValidarCobroRequest = await request.json()

        const alertas: string[] = []
        let nivelRiesgo: 'alto' | 'medio' | 'bajo' | 'ninguno' = 'ninguno'

        // Validación 1: Descuento excesivo
        const porcentajeDescuento = body.totalPedido > 0
            ? (body.descuentoAplicado / body.totalPedido) * 100
            : 0

        if (porcentajeDescuento > 20) {
            alertas.push(`Descuento del ${porcentajeDescuento.toFixed(1)}% supera el límite del 20%`)
            nivelRiesgo = 'alto'
        } else if (porcentajeDescuento > 10) {
            alertas.push(`Descuento del ${porcentajeDescuento.toFixed(1)}% es alto (>10%)`)
            nivelRiesgo = nivelRiesgo === 'ninguno' ? 'medio' : nivelRiesgo
        }

        // Validación 2: Diferencia entre total y cobrado
        const diferencia = body.totalPedido - body.descuentoAplicado - body.montoCobrado
        const porcentajeDiferencia = body.totalPedido > 0
            ? Math.abs(diferencia / body.totalPedido) * 100
            : 0

        if (Math.abs(diferencia) > 100 && porcentajeDiferencia > 5) {
            alertas.push(`Diferencia de $${Math.abs(diferencia).toFixed(2)} entre total esperado y monto cobrado`)
            nivelRiesgo = 'alto'
        } else if (Math.abs(diferencia) > 50) {
            alertas.push(`Diferencia menor de $${Math.abs(diferencia).toFixed(2)} detectada`)
            nivelRiesgo = nivelRiesgo === 'ninguno' ? 'bajo' : nivelRiesgo
        }

        // Validación 3: Monto cobrado es 0 o negativo
        if (body.montoCobrado <= 0 && body.totalPedido > 0) {
            alertas.push('El monto cobrado es $0 o negativo')
            nivelRiesgo = 'alto'
        }

        // Validación 4: Comparar con historial de descuentos del usuario
        if (body.historialDescuentos && body.historialDescuentos.length > 0) {
            const promedioDescuentosUsuario = body.historialDescuentos.reduce((a, b) => a + b, 0) / body.historialDescuentos.length

            if (porcentajeDescuento > promedioDescuentosUsuario * 2 && porcentajeDescuento > 5) {
                alertas.push(`Descuento inusual: ${porcentajeDescuento.toFixed(1)}% vs promedio histórico ${promedioDescuentosUsuario.toFixed(1)}%`)
                nivelRiesgo = nivelRiesgo === 'ninguno' ? 'medio' : nivelRiesgo
            }
        }

        // Si hay alertas de alto riesgo, usar Gemini para sugerencia
        let sugerencia = ''
        if (nivelRiesgo === 'alto' && alertas.length > 0) {
            try {
                const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

                const prompt = `Eres un auditor de una empresa avícola. Se detectó una anomalía en un cobro:

Pedido: ${body.pedidoNumero}
Cliente: ${body.clienteNombre}
Total del pedido: $${body.totalPedido}
Descuento aplicado: $${body.descuentoAplicado} (${porcentajeDescuento.toFixed(1)}%)
Monto cobrado: $${body.montoCobrado}
Usuario que cobra: ${body.usuarioNombre}
Método de pago: ${body.metodoPago}

Alertas detectadas:
${alertas.map(a => `- ${a}`).join('\n')}

En UNA sola oración breve, sugiere qué acción tomar (verificar, pedir autorización, rechazar, etc).`

                const result = await model.generateContent(prompt)
                sugerencia = result.response.text().trim()
            } catch (iaError) {
                console.error('[IA] Error con Gemini para sugerencia:', iaError)
                sugerencia = 'Verificar con supervisor antes de procesar este cobro.'
            }
        }

        return NextResponse.json({
            success: true,
            esAnomalo: alertas.length > 0,
            nivelRiesgo,
            alertas,
            sugerencia: sugerencia || undefined,
            usandoIA: !!sugerencia,
        })
    } catch (error) {
        console.error('[IA] Error en validar-cobro:', error)
        return NextResponse.json({
            success: false,
            esAnomalo: false,
            nivelRiesgo: 'ninguno',
            alertas: [],
        })
    }
}
