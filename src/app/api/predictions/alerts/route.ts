/**
 * GET /api/predictions/alerts
 * 
 * Endpoint para obtener alertas de stock generadas por IA
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { obtenerAlertasStockActivas } from '@/lib/services/predictions/stock-alert'

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

    // Obtener alertas activas
    const alertas = await obtenerAlertasStockActivas(supabase)

    return NextResponse.json({
      success: true,
      data: alertas
    })
  } catch (error: any) {
    console.error('Error al obtener alertas de stock:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener alertas' },
      { status: 500 }
    )
  }
}

