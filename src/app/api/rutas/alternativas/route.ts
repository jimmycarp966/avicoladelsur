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
import { getGoogleDirections, isGoogleDirectionsAvailable, type RutaAlternativa } from '@/lib/rutas/google-directions'

export async function POST(request: NextRequest) {
    try {
        if (!isGoogleDirectionsAvailable()) {
            return NextResponse.json(
                { error: 'Google Directions API no está configurada' },
                { status: 503 }
            )
        }

        const body = await request.json()
        const { origen, destino } = body

        if (!origen?.lat || !origen?.lng || !destino?.lat || !destino?.lng) {
            return NextResponse.json(
                { error: 'Origen y destino son requeridos' },
                { status: 400 }
            )
        }

        console.log('[API rutas/alternativas] Solicitando rutas:', { origen, destino })

        const response = await getGoogleDirections({
            origin: origen,
            destination: destino,
            waypoints: [], // Sin waypoints para habilitar alternativas
            alternatives: true,
        })

        console.log('[API rutas/alternativas] Proveedor usado: google')

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

        return NextResponse.json({ rutas, provider: 'google' })
    } catch (error: any) {
        console.error('[API rutas/alternativas] Error:', error)
        return NextResponse.json(
            { error: error.message || 'Error interno' },
            { status: 500 }
        )
    }
}
