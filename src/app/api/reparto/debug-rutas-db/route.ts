/**
 * GET /api/reparto/debug-rutas-db
 *
 * Endpoint para verificar directamente qué hay en las tablas de rutas
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

    console.log('🔍 [DEBUG] Verificando tablas de rutas directamente')

    // Verificar rutas_reparto
    const { data: rutasReparto, error: errorRutas } = await supabase
      .from('rutas_reparto')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3)

    // Verificar rutas_planificadas
    const { data: rutasPlanificadas, error: errorPlanificadas } = await supabase
      .from('rutas_planificadas')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3)

    return NextResponse.json({
      success: true,
      rutas_reparto: rutasReparto?.map(r => ({
        id: r.id,
        numero_ruta: r.numero_ruta,
        polyline: r.polyline?.substring(0, 50),
        polyline_length: r.polyline?.length,
        estado: r.estado
      })),
      rutas_planificadas: rutasPlanificadas?.map(r => ({
        id: r.id,
        ruta_reparto_id: r.ruta_reparto_id,
        polyline: r.polyline?.substring(0, 50),
        polyline_length: r.polyline?.length,
        estado: r.estado,
        orden_visita_length: r.orden_visita?.length
      }))
    })
  } catch (error: any) {
    console.error('Error en debug-rutas-db:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}






































