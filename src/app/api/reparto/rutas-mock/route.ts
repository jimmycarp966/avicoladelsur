/**
 * POST /api/reparto/rutas-mock
 * 
 * Genera rutas mock para el monitor GPS en Monteros, Tucumán
 * Parámetros: cantidad_rutas (2-3), clientes_por_ruta (5-10)
 * 
 * IMPORTANTE: Esta función puede tardar más de 10 segundos.
 * En Vercel, requiere plan Pro o superior para maxDuration > 10s
 */

import { NextRequest, NextResponse } from 'next/server'
import { crearRutasMockMonteros } from '@/actions/reparto.actions'

// Vercel Free (Hobby) tiene límite de 10 segundos
// Intentamos optimizar para que quepa en 10s, pero si falla necesitarás plan Pro
export const maxDuration = 10

export async function POST(request: NextRequest) {
  const inicioEndpoint = Date.now()
  try {
    console.log('📥 [ENDPOINT] POST /api/reparto/rutas-mock recibido')
    const body = await request.json()
    const cantidadRutas = Math.min(Math.max(parseInt(body.cantidad_rutas) || 2, 1), 5) // Entre 1 y 5
    const clientesPorRuta = Math.min(Math.max(parseInt(body.cantidad_ruta) || 7, 3), 15) // Entre 3 y 15

    console.log('📥 [ENDPOINT] Parámetros recibidos:', { cantidadRutas, clientesPorRuta })
    console.log('⏱️ [ENDPOINT] Llamando crearRutasMockMonteros...')
    const result = await crearRutasMockMonteros(cantidadRutas, clientesPorRuta)
    const tiempoEndpoint = Date.now() - inicioEndpoint
    console.log('⏱️ [ENDPOINT] Endpoint completado en:', tiempoEndpoint, 'ms')

    if (!result.success) {
      console.error('❌ [ENDPOINT] Error en crearRutasMockMonteros:', result.error)
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    console.log('✅ [ENDPOINT] Éxito, retornando respuesta')
    return NextResponse.json({
      success: true,
      data: result.data,
      message: result.message,
    })
  } catch (error: any) {
    const tiempoEndpoint = Date.now() - inicioEndpoint
    console.error('❌ [ENDPOINT] Error en endpoint rutas-mock después de:', tiempoEndpoint, 'ms')
    console.error('❌ [ENDPOINT] Error:', error)
    console.error('❌ [ENDPOINT] Stack:', error.stack)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al generar rutas mock' },
      { status: 500 }
    )
  }
}
