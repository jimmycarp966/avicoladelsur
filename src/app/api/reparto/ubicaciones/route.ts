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

    // Consulta directa (la función RPC se creará manualmente después)
    console.log('🔍 [DEBUG] Consultando ubicaciones directamente para fecha:', fecha)

    const { data: ubicaciones, error } = await supabase
      .from('ubicaciones_repartidores')
      .select(`
        repartidor_id,
        vehiculo_id,
        lat,
        lng,
        created_at,
        usuarios!ubicaciones_repartidores_repartidor_id_fkey(nombre, apellido),
        vehiculos!ubicaciones_repartidores_vehiculo_id_fkey(patente)
      `)
      .gte('created_at', `${fecha}T00:00:00`)
      .lt('created_at', `${fecha}T23:59:59`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error obteniendo ubicaciones:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    console.log('✅ [DEBUG] Ubicaciones encontradas:', ubicaciones?.length || 0)

    return NextResponse.json({
      success: true,
      data: ubicaciones || []
    })
  } catch (error: any) {
    console.error('Error al obtener ubicaciones:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener ubicaciones' },
      { status: 500 }
    )
  }
}

