/**
 * API Route: Rutas Alternativas
 * 
 * Obtiene rutas alternativas de OpenRouteService (con fallback a Google) para un origen y destino.
 * POST /api/rutas/alternativas
 * 
 * Body: { origen: { lat, lng }, destino: { lat, lng } }
 * Response: { rutas: RutaAlternativa[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDirectionsWithFallback, type RutaAlternativa } from '@/lib/rutas/ors-directions'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { origen, destino } = body

        if (!origen?.lat || !origen?.lng || !destino?.lat || !destino?.lng) {
            return NextResponse.json(
                { error: 'Origen y destino son requeridos' },
                { status: 400 }
            )
        }

        console.log('[API rutas/alternativas] Solicitando rutas:', { origen, destino })

        // Usar OpenRouteService con fallback a Google y local
        const { response, provider } = await getDirectionsWithFallback({
            origin: origen,
            destination: destino,
            waypoints: [], // Sin waypoints para habilitar alternativas
            alternatives: true,
            vehicle: 'driving-car'
        })

        console.log('[API rutas/alternativas] Proveedor usado:', provider)

        if (!response.success) {
            console.error('[API rutas/alternativas] Error:', response.error)
            return NextResponse.json(
                { error: response.error || 'No se pudieron obtener rutas' },
                { status: 500 }
            )
        }

        // Si no hay alternativas, crear una sola ruta
        const rutas: RutaAlternativa[] = response.rutasAlternativas || [
            {
                polyline: response.polyline || '',
                distancia: response.distance || 0,
                duracion: response.duration || 0,
                resumen: 'Ruta principal',
                esPreferida: true
            }
        ]

        console.log('[API rutas/alternativas] Rutas encontradas:', rutas.length)

        return NextResponse.json({ rutas, provider })
    } catch (error: any) {
        console.error('[API rutas/alternativas] Error:', error)
        return NextResponse.json(
            { error: error.message || 'Error interno' },
            { status: 500 }
        )
    }
}
