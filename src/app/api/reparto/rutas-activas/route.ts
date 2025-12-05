/**
 * GET /api/reparto/rutas-activas
 * 
 * Devuelve rutas activas (en_curso o planificada) para una fecha
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    const searchParams = request.nextUrl.searchParams
    const fecha = searchParams.get('fecha') || null
    const zonaId = searchParams.get('zona_id') || null

    // Obtener rutas activas
    let query = supabase
      .from('rutas_reparto')
      .select(`
        id,
        numero_ruta,
        fecha_ruta,
        estado,
        vehiculo_id,
        repartidor_id,
        zona_id,
        vehiculo:vehiculos(patente, marca, modelo),
        repartidor:usuarios!rutas_reparto_repartidor_id_fkey(nombre, apellido)
      `)
      .in('estado', ['planificada', 'en_curso'])

    // Filtrar por fecha solo si se proporciona
    if (fecha) {
      query = query.eq('fecha_ruta', fecha)
    }

    if (zonaId) {
      query = query.eq('zona_id', zonaId)
    }

    const { data: rutas, error } = await query.order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({
      success: true,
      data: rutas || []
    })
  } catch (error: any) {
    console.error('Error al obtener rutas activas:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener rutas activas' },
      { status: 500 }
    )
  }
}

