/**
 * GET /api/reparto/test-rutas
 *
 * Endpoint para probar la carga de rutas planificadas
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

    const fecha = new Date().toISOString().split('T')[0]
    const fechaDesde = new Date(fecha)
    fechaDesde.setDate(fechaDesde.getDate() - 1)

    console.log('🧪 [TEST] Buscando rutas desde:', fechaDesde.toISOString().split('T')[0], 'hasta:', fecha)

    // Cargar rutas planificadas
    let query = supabase
      .from('rutas_planificadas')
      .select(`
        id,
        fecha,
        zona_id,
        vehiculo_id,
        ruta_reparto_id,
        estado,
        orden_visita,
        polyline,
        distancia_total_km,
        duracion_total_min,
        created_at,
        rutas_reparto!inner(
          id,
          numero_ruta,
          estado,
          vehiculo_id,
          repartidor_id,
          usuarios!rutas_reparto_repartidor_id_fkey(
            nombre,
            apellido
          ),
          vehiculos!rutas_reparto_vehiculo_id_fkey(
            patente,
            marca,
            modelo
          )
        )
      `)
      .gte('fecha', fechaDesde.toISOString().split('T')[0])
      .lte('fecha', fecha)
      .eq('estado', 'en_curso')

    const { data: rutasPlanificadas, error } = await query
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error obteniendo rutas planificadas:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    console.log('🧪 [TEST] Rutas encontradas:', rutasPlanificadas?.length || 0)

    // Formatear como el endpoint real
    const rutasFormateadas = rutasPlanificadas?.map(ruta => {
      const rutasReparto = Array.isArray(ruta.rutas_reparto) ? ruta.rutas_reparto[0] : ruta.rutas_reparto
      return {
        id: ruta.ruta_reparto_id,
        numero_ruta: rutasReparto?.numero_ruta || 'S/N',
        estado: ruta.estado,
        vehiculo: Array.isArray(rutasReparto?.vehiculos) ? rutasReparto.vehiculos[0] : rutasReparto?.vehiculos || null,
        repartidor: rutasReparto?.usuarios ? (() => {
          const usuario = Array.isArray(rutasReparto.usuarios) ? rutasReparto.usuarios[0] : rutasReparto.usuarios
          return usuario ? {
            nombre: usuario.nombre,
            apellido: usuario.apellido
          } : null
        })() : null,
        zona_id: ruta.zona_id,
        polyline: ruta.polyline,
        orden_visita: ruta.orden_visita || [],
        distancia_total_km: ruta.distancia_total_km,
        duracion_total_min: ruta.duracion_total_min,
        created_at: ruta.created_at
      }
    }) || []

    console.log('🧪 [TEST] Rutas formateadas:', rutasFormateadas.map(r => ({
      id: r.id,
      numero: r.numero_ruta,
      polylineLength: r.polyline?.length,
      ordenVisitaLength: r.orden_visita?.length
    })))

    return NextResponse.json({
      success: true,
      data: rutasFormateadas,
      debug: {
        fechaDesde: fechaDesde.toISOString().split('T')[0],
        fechaHasta: fecha,
        rutasRaw: rutasPlanificadas?.length || 0,
        rutasFormateadas: rutasFormateadas.length
      }
    })
  } catch (error: any) {
    console.error('Error en test-rutas:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}


