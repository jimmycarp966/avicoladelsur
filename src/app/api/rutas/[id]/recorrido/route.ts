/**
 * GET /api/rutas/:id/recorrido
 * 
 * Devuelve polyline y puntos históricos del día para una ruta
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    
    const rutaId = params.id
    
    // Obtener ruta planificada con polyline
    const { data: rutaPlanificada, error: rutaError } = await supabase
      .from('rutas_planificadas')
      .select('polyline, orden_visita, ruta_reparto_id')
      .eq('ruta_reparto_id', rutaId)
      .single()
    
    if (rutaError || !rutaPlanificada) {
      return NextResponse.json(
        { success: false, error: 'Ruta planificada no encontrada' },
        { status: 404 }
      )
    }
    
    // Obtener ruta reparto para fecha y vehículo
    const { data: rutaReparto, error: rutaRepartoError } = await supabase
      .from('rutas_reparto')
      .select('fecha_ruta, vehiculo_id')
      .eq('id', rutaId)
      .single()
    
    if (rutaRepartoError || !rutaReparto) {
      return NextResponse.json(
        { success: false, error: 'Ruta no encontrada' },
        { status: 404 }
      )
    }
    
    // Obtener ubicaciones históricas del día para el vehículo
    const fecha = rutaReparto.fecha_ruta
    const { data: ubicaciones, error: ubicacionesError } = await supabase
      .from('ubicaciones_repartidores')
      .select('lat, lng, created_at')
      .eq('vehiculo_id', rutaReparto.vehiculo_id)
      .gte('created_at', `${fecha}T00:00:00`)
      .lt('created_at', `${fecha}T23:59:59`)
      .order('created_at', { ascending: true })
    
    if (ubicacionesError) throw ubicacionesError
    
    return NextResponse.json({
      success: true,
      data: {
        polyline: rutaPlanificada.polyline,
        ordenVisita: rutaPlanificada.orden_visita,
        historial: ubicaciones || []
      }
    })
  } catch (error: any) {
    console.error('Error al obtener recorrido:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener recorrido' },
      { status: 500 }
    )
  }
}

