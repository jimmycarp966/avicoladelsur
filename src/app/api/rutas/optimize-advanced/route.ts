/**
 * POST /api/rutas/optimize-advanced
 * 
 * Endpoint para optimización avanzada de rutas usando Google Cloud APIs
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateRutaOptimizadaAvanzada, type AdvancedOptimizationOptions } from '@/lib/services/ruta-optimizer'

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { rutaId, options } = body as {
      rutaId: string
      options?: AdvancedOptimizationOptions
    }

    if (!rutaId) {
      return NextResponse.json(
        { success: false, error: 'rutaId es requerido' },
        { status: 400 }
      )
    }

    // Verificar permisos (solo admin puede optimizar rutas)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || usuario.rol !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para optimizar rutas' },
        { status: 403 }
      )
    }

    // Generar optimización avanzada
    const result = await generateRutaOptimizadaAvanzada({
      supabase,
      rutaId,
      options
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Error al optimizar ruta' },
        { status: 500 }
      )
    }

    // Registrar optimización en base de datos
    const { data: ruta } = await supabase
      .from('rutas_reparto')
      .select('distancia_estimada_km, tiempo_estimado_min')
      .eq('id', rutaId)
      .single()

    const distanciaOriginal = ruta?.distancia_estimada_km || result.metricas?.distanciaOriginal || 0
    const tiempoOriginal = ruta?.tiempo_estimado_min || result.metricas?.tiempoOriginal || 0

    // Obtener orden original
    const { data: detallesOriginales } = await supabase
      .from('detalles_ruta')
      .select('id, orden_entrega, pedido_id, pedidos(cliente_id, clientes(nombre))')
      .eq('ruta_id', rutaId)
      .order('orden_entrega', { ascending: true })

    const ordenOriginal = detallesOriginales?.map((det, index) => ({
      detalle_ruta_id: det.id,
      pedido_id: det.pedido_id,
      orden: index + 1
    })) || []

    // Registrar en tabla de optimizaciones
    const { error: optError } = await supabase.rpc('fn_registrar_optimizacion_ruta', {
      p_ruta_reparto_id: rutaId,
      p_tipo_optimizacion: result.optimizadaPor,
      p_objetivos: options?.objetivos ? {
        minimizarDistancia: options.objetivos.minimizarDistancia ?? true,
        minimizarTiempo: options.objetivos.minimizarTiempo ?? true,
        minimizarCombustible: options.objetivos.minimizarCombustible ?? false,
        respetarHorarios: options.objetivos.respetarHorarios ?? false
      } : null,
      p_restricciones: options?.restricciones ? {
        capacidadVehiculo: options.restricciones.capacidadVehiculo,
        horarioRepartidor: options.restricciones.horarioRepartidor,
        clientesUrgentes: options.restricciones.clientesUrgentes || []
      } : null,
      p_orden_visita_original: ordenOriginal,
      p_orden_visita_optimizado: result.ordenVisita,
      p_distancia_original_km: distanciaOriginal,
      p_distancia_optimizada_km: result.distanciaTotalKm,
      p_tiempo_original_min: tiempoOriginal,
      p_tiempo_optimizado_min: result.duracionTotalMin,
      p_polyline: result.polyline
    })

    if (optError) {
      console.error('Error al registrar optimización:', optError)
      // No fallar la request, solo loguear el error
    }

    return NextResponse.json({
      success: true,
      data: {
        ordenVisita: result.ordenVisita,
        polyline: result.polyline,
        distanciaTotalKm: result.distanciaTotalKm,
        duracionTotalMin: result.duracionTotalMin,
        optimizadaPor: result.optimizadaPor,
        metricas: result.metricas
      }
    })
  } catch (error: any) {
    console.error('Error al optimizar ruta avanzada:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al optimizar ruta' },
      { status: 500 }
    )
  }
}

