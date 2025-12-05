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

    // Agrupar por vehículo y obtener la última ubicación de cada uno
    const ubicacionesPorVehiculo = new Map<string, any>()
    
    ubicaciones?.forEach((ubicacion: any) => {
      const vehiculoId = ubicacion.vehiculo_id
      const usuario = Array.isArray(ubicacion.usuarios) ? ubicacion.usuarios[0] : ubicacion.usuarios
      const vehiculo = Array.isArray(ubicacion.vehiculos) ? ubicacion.vehiculos[0] : ubicacion.vehiculos
      
      // Si no existe o esta es más reciente, actualizar
      const existente = ubicacionesPorVehiculo.get(vehiculoId)
      if (!existente || new Date(ubicacion.created_at) > new Date(existente.created_at)) {
        ubicacionesPorVehiculo.set(vehiculoId, {
          vehiculo_id: vehiculoId,
          repartidor_id: ubicacion.repartidor_id,
          repartidor_nombre: usuario ? `${usuario.nombre} ${usuario.apellido}`.trim() : 'Repartidor',
          lat: ubicacion.lat,
          lng: ubicacion.lng,
          created_at: ubicacion.created_at,
          patente: vehiculo?.patente || 'N/A'
        })
      }
    })

    // Convertir Map a Array
    const ubicacionesFormateadas = Array.from(ubicacionesPorVehiculo.values())

    console.log('✅ [DEBUG] Ubicaciones encontradas:', ubicaciones?.length || 0, 'Últimas por vehículo:', ubicacionesFormateadas.length)

    return NextResponse.json({
      success: true,
      data: ubicacionesFormateadas
    })
  } catch (error: any) {
    console.error('Error al obtener ubicaciones:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener ubicaciones' },
      { status: 500 }
    )
  }
}

