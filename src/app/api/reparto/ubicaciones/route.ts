/**
 * GET /api/reparto/ubicaciones
 * 
 * Devuelve última ubicación por vehículo (agrupado)
 * Query params: zona_id?, fecha?
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTodayArgentina } from '@/lib/utils'

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

    // Verificar permisos (admin, almacenista o repartidor)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // Obtener query params
    const searchParams = request.nextUrl.searchParams
    const fecha = searchParams.get('fecha') || getTodayArgentina()
    const zonaId = searchParams.get('zona_id') || null

    // Llamar RPC
    const { data, error } = await supabase.rpc('fn_obtener_ultima_ubicacion_por_vehiculo', {
      p_fecha: fecha,
      p_zona_id: zonaId
    })

    if (error) {
      console.error('Error RPC ubicaciones:', error)
      return NextResponse.json(
        { success: false, error: error.message, details: error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || []
    })
  } catch (error: any) {
    console.error('Error al obtener ubicaciones:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener ubicaciones' },
      { status: 500 }
    )
  }
}

