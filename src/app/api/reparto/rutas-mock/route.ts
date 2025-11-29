/**
 * POST /api/reparto/rutas-mock
 * 
 * Genera rutas mock para el monitor GPS en Monteros, Tucumán
 * Parámetros: cantidad_rutas (2-3), clientes_por_ruta (5-10)
 */

import { NextRequest, NextResponse } from 'next/server'
import { crearRutasMockMonteros } from '@/actions/reparto.actions'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const cantidadRutas = Math.min(Math.max(parseInt(body.cantidad_rutas) || 2, 1), 5) // Entre 1 y 5
    const clientesPorRuta = Math.min(Math.max(parseInt(body.clientes_por_ruta) || 7, 3), 15) // Entre 3 y 15

    const result = await crearRutasMockMonteros(cantidadRutas, clientesPorRuta)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: result.message,
    })
  } catch (error: any) {
    console.error('Error en endpoint rutas-mock:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al generar rutas mock' },
      { status: 500 }
    )
  }
}

