/**
 * POST /api/integrations/google/directions
 * 
 * Endpoint interno para consultar Google Directions API
 * Nunca exponer la API key al cliente
 */

import { NextRequest, NextResponse } from 'next/server'
import { getGoogleDirections, isGoogleDirectionsAvailable } from '@/lib/rutas/google-directions'
import type { GoogleDirectionsRequest } from '@/lib/rutas/google-directions'

export async function POST(request: NextRequest) {
  try {
    // Verificar que Google Directions esté disponible
    if (!isGoogleDirectionsAvailable()) {
      return NextResponse.json(
        { success: false, error: 'Google Directions API no está configurada' },
        { status: 503 }
      )
    }
    
    // Validar body
    const body = await request.json() as GoogleDirectionsRequest
    
    if (!body.origin || !body.destination) {
      return NextResponse.json(
        { success: false, error: 'Origin y destination son requeridos' },
        { status: 400 }
      )
    }
    
    // Validar límites
    if (body.waypoints && body.waypoints.length > 25) {
      return NextResponse.json(
        { success: false, error: 'Máximo 25 waypoints permitidos' },
        { status: 400 }
      )
    }
    
    // Consultar Google Directions
    const result = await getGoogleDirections(body)
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: {
        orderedStops: result.orderedStops,
        polyline: result.polyline,
        distance: result.distance,
        duration: result.duration
      }
    })
  } catch (error: any) {
    console.error('Error al consultar Google Directions:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al consultar Google Directions' },
      { status: 500 }
    )
  }
}

