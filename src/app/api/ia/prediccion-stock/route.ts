/**
 * POST /api/ia/prediccion-stock
 * 
 * Endpoint que predice la demanda de productos para los próximos días
 * usando análisis de historial y Gemini AI.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '')

interface PrediccionRequest {
    productoId?: string
    diasFuturos?: number
}

interface PrediccionProducto {
    productoId: string
    productoNombre: string
    stockActual: number
    demandaPredicha: number
    diasCobertura: number
    alerta: 'critico' | 'bajo' | 'normal' | 'alto'
    confianza: number
    tendencia: 'subiendo' | 'estable' | 'bajando'
    sugerencia: string
}

interface PrediccionResponse {
    success: boolean
    data?: PrediccionProducto[]
    error?: string
    usandoIA?: boolean
}

export async function POST(request: NextRequest): Promise<NextResponse<PrediccionResponse>> {
    try {
        const body: PrediccionRequest = await request.json()
        const diasFuturos = body.diasFuturos || 7
        const supabase = await createClient()

        // Obtener productos con stock y movimientos
        const { data: productos, error: productosError } = await supabase
            .from('productos')
            .select(`
        id,
        nombre,
        stock_actual,
        stock_minimo,
        unidad_medida,
        lotes (
          id,
          cantidad_actual
        )
      `)
            .eq('activo', true)
            .order('nombre')

        if (productosError) throw productosError

        // Obtener ventas de los últimos 30 días para calcular promedio
        const hace30Dias = new Date()
        hace30Dias.setDate(hace30Dias.getDate() - 30)

        const { data: ventasHistoricas, error: ventasError } = await supabase
            .from('presupuestos_items')
            .select(`
        producto_id,
        cantidad,
        presupuesto:presupuestos (
          created_at,
          estado
        )
      `)
            .gte('presupuesto.created_at', hace30Dias.toISOString())
            .in('presupuesto.estado', ['entregado', 'facturado', 'preparado'])

        if (ventasError) throw ventasError

        // Calcular predicciones
        const predicciones: PrediccionProducto[] = []

        for (const producto of productos || []) {
            // Calcular stock total (incluyendo lotes)
            const stockLotes = (producto.lotes || []).reduce(
                (sum: number, lote: any) => sum + (lote.cantidad_actual || 0),
                0
            )
            const stockTotal = producto.stock_actual || stockLotes

            // Calcular ventas del producto en los últimos 30 días
            const ventasProducto = (ventasHistoricas || [])
                .filter((v: any) => v.producto_id === producto.id)
                .reduce((sum: number, v: any) => sum + (v.cantidad || 0), 0)

            // Promedio diario
            const promedioDiario = ventasProducto / 30

            // Demanda predicha para los próximos días
            const demandaPredicha = Math.ceil(promedioDiario * diasFuturos)

            // Días de cobertura con stock actual
            const diasCobertura = promedioDiario > 0
                ? Math.floor(stockTotal / promedioDiario)
                : 999

            // Determinar alerta
            let alerta: 'critico' | 'bajo' | 'normal' | 'alto' = 'normal'
            let sugerencia = ''

            if (diasCobertura < diasFuturos * 0.5) {
                alerta = 'critico'
                sugerencia = `Stock para ${diasCobertura} días. Reabastecer urgente.`
            } else if (diasCobertura < diasFuturos) {
                alerta = 'bajo'
                sugerencia = `Stock para ${diasCobertura} días. Considerar reabastecimiento.`
            } else if (diasCobertura > diasFuturos * 3) {
                alerta = 'alto'
                sugerencia = `Stock elevado (${diasCobertura} días). Reducir próxima compra.`
            } else {
                sugerencia = `Stock adecuado para ${diasCobertura} días.`
            }

            // Calcular tendencia (últimos 14 días vs 14-28 días)
            const hace14Dias = new Date()
            hace14Dias.setDate(hace14Dias.getDate() - 14)

            const ventasUltimos14 = (ventasHistoricas || [])
                .filter((v: any) =>
                    v.producto_id === producto.id &&
                    new Date(v.presupuesto?.created_at) >= hace14Dias
                )
                .reduce((sum: number, v: any) => sum + (v.cantidad || 0), 0)

            const ventas14a28 = (ventasHistoricas || [])
                .filter((v: any) =>
                    v.producto_id === producto.id &&
                    new Date(v.presupuesto?.created_at) < hace14Dias
                )
                .reduce((sum: number, v: any) => sum + (v.cantidad || 0), 0)

            let tendencia: 'subiendo' | 'estable' | 'bajando' = 'estable'
            if (ventas14a28 > 0) {
                const cambio = ((ventasUltimos14 - ventas14a28) / ventas14a28) * 100
                if (cambio > 15) tendencia = 'subiendo'
                else if (cambio < -15) tendencia = 'bajando'
            }

            // Solo incluir productos con movimiento o stock crítico
            if (promedioDiario > 0 || alerta === 'critico') {
                predicciones.push({
                    productoId: producto.id,
                    productoNombre: producto.nombre,
                    stockActual: stockTotal,
                    demandaPredicha,
                    diasCobertura,
                    alerta,
                    confianza: Math.min(90, 60 + (ventasProducto / 10)), // Mayor confianza con más datos
                    tendencia,
                    sugerencia,
                })
            }
        }

        // Ordenar por urgencia (crítico primero)
        predicciones.sort((a, b) => {
            const alertaOrder = { critico: 0, bajo: 1, normal: 2, alto: 3 }
            return alertaOrder[a.alerta] - alertaOrder[b.alerta]
        })

        return NextResponse.json({
            success: true,
            data: predicciones.slice(0, 30), // Limitar a 30
            usandoIA: false, // Usa algoritmo local
        })
    } catch (error) {
        console.error('[IA] Error en prediccion-stock:', error)
        return NextResponse.json({
            success: false,
            error: 'Error al calcular predicción de stock',
        })
    }
}
