/**
 * API Route: Rutas Alternativas
 * 
 * Obtiene rutas alternativas de Google Directions para un origen y destino.
 * POST /api/rutas/alternativas
 * 
 * Body: { origen: { lat, lng }, destino: { lat, lng } }
 * Response: { rutas: RutaAlternativa[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getGoogleDirections, type RutaAlternativa } from '@/lib/rutas/google-directions'

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

        // Llamar a Google Directions con alternatives=true
        const result = await getGoogleDirections({
            origin: origen,
            destination: destino,
            waypoints: [], // Sin waypoints para habilitar alternativas
            alternatives: true
        })

        if (!result.success) {
            console.error('[API rutas/alternativas] Error:', result.error)
            return NextResponse.json(
                { error: result.error || 'No se pudieron obtener rutas' },
                { status: 500 }
            )
        }

        // Si no hay alternativas, crear una sola ruta
        const rutas: RutaAlternativa[] = result.rutasAlternativas || [
            {
                polyline: result.polyline || '',
                distancia: result.distance || 0,
                duracion: result.duration || 0,
                resumen: 'Ruta principal',
                esPreferida: true
            }
        ]

        console.log('[API rutas/alternativas] Rutas encontradas:', rutas.length)

        return NextResponse.json({ rutas })
    } catch (error: any) {
        console.error('[API rutas/alternativas] Error:', error)
        return NextResponse.json(
            { error: error.message || 'Error interno' },
            { status: 500 }
        )
    }
}
