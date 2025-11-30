/**
 * POST /api/reparto/crear-rpc
 *
 * Crear la función RPC faltante para ubicaciones
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
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

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || usuario.rol !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Solo admins pueden crear funciones RPC' },
        { status: 403 }
      )
    }

    console.log('🔧 [RPC] Creando función fn_obtener_ultima_ubicacion_por_vehiculo...')

    // Crear la función RPC usando SQL directo
    const sql = `
      CREATE OR REPLACE FUNCTION fn_obtener_ultima_ubicacion_por_vehiculo(
          p_fecha DATE DEFAULT CURRENT_DATE,
          p_zona_id UUID DEFAULT NULL
      )
      RETURNS TABLE (
          vehiculo_id UUID,
          repartidor_id UUID,
          repartidor_nombre TEXT,
          lat DOUBLE PRECISION,
          lng DOUBLE PRECISION,
          created_at TIMESTAMPTZ,
          ruta_activa_id UUID,
          ruta_numero TEXT
      ) AS $$
      BEGIN
          RETURN QUERY
          WITH ultimas_ubicaciones AS (
              SELECT DISTINCT ON (u.vehiculo_id)
                  u.vehiculo_id,
                  u.repartidor_id,
                  u.lat,
                  u.lng,
                  u.created_at
              FROM ubicaciones_repartidores u
              WHERE DATE(u.created_at) = p_fecha
              ORDER BY u.vehiculo_id, u.created_at DESC
          )
          SELECT
              uu.vehiculo_id,
              uu.repartidor_id,
              CONCAT(us.nombre, ' ', COALESCE(us.apellido, '')) AS repartidor_nombre,
              uu.lat,
              uu.lng,
              uu.created_at,
              r.id AS ruta_activa_id,
              r.numero_ruta AS ruta_numero
          FROM ultimas_ubicaciones uu
          LEFT JOIN usuarios us ON us.id = uu.repartidor_id
          LEFT JOIN rutas_reparto r ON r.vehiculo_id = uu.vehiculo_id
              AND r.estado IN ('planificada', 'en_curso')
              AND r.fecha_ruta = p_fecha
          ORDER BY uu.created_at DESC;
      END;
      $$ LANGUAGE plpgsql;
    `

    // Ejecutar el SQL
    const { error: sqlError } = await supabase.rpc('exec_sql', { sql })

    if (sqlError) {
      console.error('Error creando función RPC:', sqlError)
      return NextResponse.json(
        { success: false, error: sqlError.message },
        { status: 500 }
      )
    }

    console.log('✅ [RPC] Función fn_obtener_ultima_ubicacion_por_vehiculo creada exitosamente')

    return NextResponse.json({
      success: true,
      message: 'Función RPC creada exitosamente'
    })
  } catch (error: any) {
    console.error('Error creando RPC:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
