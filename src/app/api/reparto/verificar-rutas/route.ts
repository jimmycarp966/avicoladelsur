/**
 * GET /api/reparto/verificar-rutas
 *
 * Endpoint temporal para verificar qué rutas existen en la base de datos
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

    console.log('🔍 [DEBUG] Verificando rutas en la base de datos')

    // Verificar rutas_reparto
    const { data: rutasReparto, error: errorRutas } = await supabase
      .from('rutas_reparto')
      .select('id, numero_ruta, fecha_ruta, estado, created_at')
      .order('created_at', { ascending: false })
      .limit(5)

    // Verificar rutas_planificadas
    const { data: rutasPlanificadas, error: errorPlanificadas } = await supabase
      .from('rutas_planificadas')
      .select('id, fecha, estado, ruta_reparto_id, created_at')
      .order('created_at', { ascending: false })
      .limit(5)

    // Verificar ubicaciones_repartidores
    const { data: ubicaciones, error: errorUbicaciones } = await supabase
      .from('ubicaciones_repartidores')
      .select('id, vehiculo_id, repartidor_id, lat, lng, created_at')
      .order('created_at', { ascending: false })
      .limit(5)

    // Verificar vehiculos
    const { data: vehiculos, error: errorVehiculos } = await supabase
      .from('vehiculos')
      .select('id, patente, marca, modelo')
      .limit(10)

    return NextResponse.json({
      success: true,
      data: {
        rutas_reparto: {
          count: rutasReparto?.length || 0,
          data: rutasReparto,
          error: errorRutas?.message
        },
        rutas_planificadas: {
          count: rutasPlanificadas?.length || 0,
          data: rutasPlanificadas,
          error: errorPlanificadas?.message
        },
        ubicaciones_repartidores: {
          count: ubicaciones?.length || 0,
          data: ubicaciones,
          error: errorUbicaciones?.message
        },
        vehiculos: {
          count: vehiculos?.length || 0,
          data: vehiculos,
          error: errorVehiculos?.message
        }
      },
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Error en verificar-rutas:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

























