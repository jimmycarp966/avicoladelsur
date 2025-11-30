/**
 * GET /api/reparto/debug-rutas-mock
 * 
 * Endpoint de depuración para verificar rutas mock creadas
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTodayArgentina } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [DEBUG-API] Endpoint debug-rutas-mock llamado')
    const supabase = await createClient()

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.log('❌ [DEBUG-API] Error de autenticación:', authError)
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }
    console.log('✅ [DEBUG-API] Usuario autenticado:', user.email)

    const fecha = getTodayArgentina()

    // Obtener rutas mock creadas recientemente (últimas 24 horas)
    const yesterday = new Date(fecha)
    yesterday.setDate(yesterday.getDate() - 1)

    console.log('🔍 [DEBUG-API] Buscando rutas desde:', yesterday.toISOString(), 'hasta hoy')

    const { data: rutas, error: rutasError } = await supabase
      .from('rutas_reparto')
      .select(`
        id,
        numero_ruta,
        fecha_ruta,
        turno,
        estado,
        vehiculo_id,
        repartidor_id,
        zona_id,
        distancia_estimada_km,
        tiempo_estimado_min,
        created_at
      `)
      .gte('created_at', yesterday.toISOString())
      .in('estado', ['planificada', 'en_curso'])
      .order('created_at', { ascending: false })
      .limit(10)

    // Obtener ubicaciones de hoy
    const { data: ubicaciones, error: ubicacionesError } = await supabase
      .from('ubicaciones_repartidores')
      .select('*')
      .gte('created_at', `${fecha}T00:00:00`)
      .lt('created_at', `${fecha}T23:59:59`)
      .order('created_at', { ascending: false })
      .limit(20)

    // Obtener rutas planificadas
    const { data: rutasPlanificadas, error: rutasPlanificadasError } = await supabase
      .from('rutas_planificadas')
      .select('*')
      .eq('fecha', fecha)
      .limit(10)

    // Obtener vehiculos_estado
    const { data: vehiculosEstado, error: vehiculosEstadoError } = await supabase
      .from('vehiculos_estado')
      .select('*')
      .limit(10)

    // Llamar a la función RPC para ver qué devuelve
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'fn_obtener_ultima_ubicacion_por_vehiculo',
      {
        p_fecha: fecha,
        p_zona_id: null
      }
    )

    return NextResponse.json({
      success: true,
      data: {
        fecha,
        rutas: {
          data: rutas || [],
          error: rutasError?.message,
          count: rutas?.length || 0
        },
        ubicaciones: {
          data: ubicaciones || [],
          error: ubicacionesError?.message,
          count: ubicaciones?.length || 0
        },
        rutasPlanificadas: {
          data: rutasPlanificadas || [],
          error: rutasPlanificadasError?.message,
          count: rutasPlanificadas?.length || 0
        },
        vehiculosEstado: {
          data: vehiculosEstado || [],
          error: vehiculosEstadoError?.message,
          count: vehiculosEstado?.length || 0
        },
        rpcResult: {
          data: rpcData || [],
          error: rpcError?.message,
          count: rpcData?.length || 0
        }
      }
    })
  } catch (error: any) {
    console.error('Error en debug-rutas-mock:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al depurar rutas mock' },
      { status: 500 }
    )
  }
}


