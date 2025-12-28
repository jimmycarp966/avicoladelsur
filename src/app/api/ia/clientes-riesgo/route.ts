/**
 * GET /api/ia/clientes-riesgo
 * 
 * Endpoint que analiza clientes y detecta aquellos en riesgo de abandono
 * basándose en historial de compras y patrones.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '')

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
}

export async function GET(request: NextRequest): Promise<NextResponse<ClienteRiesgoResponse>> {
    try {
        const supabase = await createClient()

        // Obtener clientes con sus últimos pedidos
        const { data: clientes, error: clientesError } = await supabase
            .from('clientes')
            .select(`
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
      `)
            .eq('activo', true)
            .order('created_at', { ascending: false })

        if (clientesError) {
            throw clientesError
        }

        const clientesEnRiesgo: ClienteRiesgo[] = []
        const hoy = new Date()
        const hace30Dias = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000)
        const hace60Dias = new Date(hoy.getTime() - 60 * 24 * 60 * 60 * 1000)

        for (const cliente of clientes || []) {
            const pedidosEntregados = (cliente.pedidos || [])
                .filter((p: any) => p.estado === 'entregado')
                .sort((a: any, b: any) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                )

            if (pedidosEntregados.length < 2) continue // Necesitamos historial

            const ultimoPedido = pedidosEntregados[0]
            const fechaUltimoPedido = new Date(ultimoPedido.created_at)
            const diasSinComprar = Math.floor(
                (hoy.getTime() - fechaUltimoPedido.getTime()) / (24 * 60 * 60 * 1000)
            )

            // Calcular promedio de días entre compras
            let sumaDias = 0
            for (let i = 0; i < pedidosEntregados.length - 1 && i < 10; i++) {
                const fecha1 = new Date(pedidosEntregados[i].created_at)
                const fecha2 = new Date(pedidosEntregados[i + 1].created_at)
                sumaDias += (fecha1.getTime() - fecha2.getTime()) / (24 * 60 * 60 * 1000)
            }
            const promedioDiasEntreCompras = sumaDias / Math.min(pedidosEntregados.length - 1, 9)

            // Calcular reducción en últimos 30 días vs 30-60 días
            const pedidosUltimos30Dias = pedidosEntregados.filter(
                (p: any) => new Date(p.created_at) >= hace30Dias
            )
            const pedidos30a60Dias = pedidosEntregados.filter(
                (p: any) =>
                    new Date(p.created_at) >= hace60Dias &&
                    new Date(p.created_at) < hace30Dias
            )

            const totalUltimos30 = pedidosUltimos30Dias.reduce((sum: number, p: any) => sum + (p.total_final || 0), 0)
            const total30a60 = pedidos30a60Dias.reduce((sum: number, p: any) => sum + (p.total_final || 0), 0)

            let reduccionPorcentaje = 0
            if (total30a60 > 0) {
                reduccionPorcentaje = Math.round(((total30a60 - totalUltimos30) / total30a60) * 100)
            }

            // Determinar nivel de riesgo
            let nivelRiesgo: 'alto' | 'medio' | 'bajo' = 'bajo'
            let razon = ''
            let sugerencia = ''

            if (diasSinComprar > promedioDiasEntreCompras * 2) {
                nivelRiesgo = 'alto'
                razon = `Sin compras hace ${diasSinComprar} días (promedio: ${Math.round(promedioDiasEntreCompras)} días)`
                sugerencia = 'Contactar urgente para conocer motivo'
            } else if (reduccionPorcentaje >= 50) {
                nivelRiesgo = 'alto'
                razon = `Redujo ${reduccionPorcentaje}% sus compras en los últimos 30 días`
                sugerencia = 'Ofrecer promoción o descuento especial'
            } else if (reduccionPorcentaje >= 30 || diasSinComprar > promedioDiasEntreCompras * 1.5) {
                nivelRiesgo = 'medio'
                razon = reduccionPorcentaje >= 30
                    ? `Redujo ${reduccionPorcentaje}% sus compras`
                    : `${diasSinComprar} días sin comprar`
                sugerencia = 'Enviar mensaje de seguimiento'
            } else {
                continue // No está en riesgo
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

        // Ordenar por nivel de riesgo (alto primero) y días sin comprar
        clientesEnRiesgo.sort((a, b) => {
            const riesgoOrder = { alto: 0, medio: 1, bajo: 2 }
            if (riesgoOrder[a.nivelRiesgo] !== riesgoOrder[b.nivelRiesgo]) {
                return riesgoOrder[a.nivelRiesgo] - riesgoOrder[b.nivelRiesgo]
            }
            return b.diasSinComprar - a.diasSinComprar
        })

        return NextResponse.json({
            success: true,
            data: clientesEnRiesgo.slice(0, 20), // Limitar a 20
            total: clientesEnRiesgo.length,
            usandoIA: false, // Por ahora usa lógica local, se puede agregar Gemini para sugerencias personalizadas
        })
    } catch (error) {
        console.error('[IA] Error en clientes-riesgo:', error)
        return NextResponse.json({
            success: false,
            error: 'Error al analizar clientes en riesgo',
        })
    }
}
