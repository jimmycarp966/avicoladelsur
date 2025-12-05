/**
 * GET /api/reparto/rutas-planificadas
 *
 * Devuelve rutas planificadas con datos completos para visualización en mapa
 * Query params: fecha?, zona_id?
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

    // Obtener query params
    const searchParams = request.nextUrl.searchParams
    const fecha = searchParams.get('fecha') || new Date().toISOString().split('T')[0]
    const zonaId = searchParams.get('zona_id') || null

    // Buscar rutas de las últimas 24 horas para incluir rutas mock creadas recientemente
    const fechaDesde = new Date(fecha)
    fechaDesde.setDate(fechaDesde.getDate() - 1) // Un día atrás

    console.log('🔍 [DEBUG] Buscando rutas planificadas desde:', fechaDesde.toISOString().split('T')[0], 'hasta:', fecha, 'zona:', zonaId)

    // También buscar sin filtro de fechas para debug
    const { data: todasRutasDebug, error: errorTodasDebug } = await supabase
      .from('rutas_planificadas')
      .select('id, fecha, estado, polyline, created_at')
      .order('created_at', { ascending: false })
      .limit(5)

    console.log('🔍 [DEBUG] Últimas 5 rutas planificadas en BD:', todasRutasDebug?.map(r => ({
      id: r.id,
      fecha: r.fecha,
      estado: r.estado,
      polylineLength: r.polyline?.length,
      polylinePreview: r.polyline?.substring(0, 20)
    })))

    // Obtener rutas planificadas
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
      .gte('fecha', fechaDesde.toISOString().split('T')[0]) // Desde ayer
      .lte('fecha', fecha) // Hasta la fecha solicitada
      .eq('estado', 'en_curso')

    if (zonaId) {
      query = query.eq('zona_id', zonaId)
    }

    // Primero verificar qué rutas existen sin filtros para debug
    const { data: todasRutas, error: errorTodas } = await supabase
      .from('rutas_planificadas')
      .select('id, fecha, estado, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    console.log('🔍 [DEBUG] Todas las rutas planificadas en BD:', todasRutas?.length || 0, todasRutas)

    const { data: rutasPlanificadas, error } = await query
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error obteniendo rutas planificadas:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    console.log('✅ [DEBUG] Rutas planificadas filtradas encontradas:', rutasPlanificadas?.length || 0, rutasPlanificadas)

    // Enriquecer orden_visita con información de productos y estado de pago
    const rutasFormateadas = await Promise.all((rutasPlanificadas || []).map(async (ruta) => {
      console.log('🔧 [DEBUG] Formateando ruta:', {
        id: ruta.ruta_reparto_id,
        polylineLength: ruta.polyline?.length,
        ordenVisitaCount: ruta.orden_visita?.length,
        estado: ruta.estado,
      })

      const rutasReparto = Array.isArray(ruta.rutas_reparto) ? ruta.rutas_reparto[0] : ruta.rutas_reparto
      
      // Obtener detalles_ruta con información completa
      const { data: detallesRuta, error: detallesError } = await supabase
        .from('detalles_ruta')
        .select(`
          id,
          orden_entrega,
          estado_entrega,
          pago_registrado,
          monto_cobrado_registrado,
          pedido:pedidos(
            id,
            cliente_id,
            cliente:clientes(
              id,
              nombre,
              telefono,
              direccion
            ),
            detalle_pedido:detalles_pedido(
              id,
              cantidad,
              producto:productos(
                id,
                nombre,
                codigo
              )
            )
          )
        `)
        .eq('ruta_id', ruta.ruta_reparto_id)
        .order('orden_entrega', { ascending: true })

      if (detallesError) {
        console.error('Error obteniendo detalles_ruta:', detallesError)
      }

      // Crear mapa de detalles_ruta por orden_entrega para acceso rápido
      const detallesMap = new Map()
      detallesRuta?.forEach((detalle: any) => {
        detallesMap.set(detalle.orden_entrega, detalle)
      })

      // Enriquecer orden_visita
      const ordenVisitaEnriquecido = (ruta.orden_visita || []).map((cliente: any) => {
        const detalle = detallesMap.get(cliente.orden)
        
        if (!detalle || !detalle.pedido) {
          return {
            ...cliente,
            productos: [],
            pago_registrado: false,
            monto_cobrado_registrado: 0,
            telefono: cliente.telefono || null,
            direccion: cliente.direccion || null,
          }
        }

        const pedido = detalle.pedido
        const clienteData = Array.isArray(pedido.cliente) ? pedido.cliente[0] : pedido.cliente
        
        // Obtener productos
        const detallesPedido = Array.isArray(pedido.detalle_pedido) 
          ? pedido.detalle_pedido 
          : (pedido.detalle_pedido ? [pedido.detalle_pedido] : [])
        
        const productos = detallesPedido.map((dp: any) => {
          const producto = Array.isArray(dp.producto) ? dp.producto[0] : dp.producto
          return {
            nombre: producto?.nombre || 'Producto',
            cantidad: dp.cantidad || 0,
          }
        })

        return {
          ...cliente,
          id: detalle.id || cliente.id,
          cliente_nombre: clienteData?.nombre || cliente.cliente_nombre,
          telefono: clienteData?.telefono || cliente.telefono || null,
          direccion: clienteData?.direccion || cliente.direccion || null,
          estado_entrega: detalle.estado_entrega || cliente.estado || 'pendiente',
          pago_registrado: detalle.pago_registrado || false,
          monto_cobrado_registrado: detalle.monto_cobrado_registrado || 0,
          productos: productos,
        }
      })

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
        orden_visita: ordenVisitaEnriquecido,
        distancia_total_km: ruta.distancia_total_km,
        duracion_total_min: ruta.duracion_total_min,
        created_at: ruta.created_at
      }
    }))

    console.log('✅ [DEBUG] Rutas formateadas para envío:', rutasFormateadas.length)

    return NextResponse.json({
      success: true,
      data: rutasFormateadas,
      count: rutasFormateadas.length
    })
  } catch (error: any) {
    console.error('Error en rutas-planificadas:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener rutas planificadas' },
      { status: 500 }
    )
  }
}
