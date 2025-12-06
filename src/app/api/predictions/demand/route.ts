/**
 * GET /api/predictions/demand
 * 
 * Endpoint para obtener predicciones de demanda
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { predecirDemandaProducto } from '@/lib/services/predictions/demand-predictor'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const productoId = searchParams.get('productoId')
    const diasFuturos = parseInt(searchParams.get('diasFuturos') || '7')

    if (!productoId) {
      return NextResponse.json(
        { success: false, error: 'productoId es requerido' },
        { status: 400 }
      )
    }

    // Predecir demanda
    const prediccion = await predecirDemandaProducto(supabase, productoId, diasFuturos)

    if (!prediccion) {
      return NextResponse.json(
        { success: false, error: 'No se pudo generar predicción. Insuficientes datos históricos.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: prediccion
    })
  } catch (error: any) {
    console.error('Error al obtener predicción de demanda:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener predicción' },
      { status: 500 }
    )
  }
}

