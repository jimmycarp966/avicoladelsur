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
    const fecha = searchParams.get('fecha') || null
    const zonaId = searchParams.get('zona_id') || null

    // Si se proporciona fecha, buscar rutas de las últimas 24 horas
    let fechaDesde: Date | null = null
    if (fecha) {
      fechaDesde = new Date(fecha)
      fechaDesde.setDate(fechaDesde.getDate() - 1) // Un día atrás
      console.log('🔍 [DEBUG] Buscando rutas planificadas desde:', fechaDesde.toISOString().split('T')[0], 'hasta:', fecha, 'zona:', zonaId)
    } else {
      console.log('🔍 [DEBUG] Buscando todas las rutas planificadas (sin filtro de fecha), zona:', zonaId)
    }

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
      .in('estado', ['en_curso', 'planificada'])

    // Filtrar por fecha solo si se proporciona
    if (fecha && fechaDesde) {
      query = query
        .gte('fecha', fechaDesde.toISOString().split('T')[0]) // Desde ayer
        .lte('fecha', fecha) // Hasta la fecha solicitada
    }

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

      // Obtener detalles_ruta básicos primero
      const { data: detallesRutaRaw, error: detallesError } = await supabase
        .from('detalles_ruta')
        .select(`
          id,
          orden_entrega,
          estado_entrega,
          pago_registrado,
          monto_cobrado_registrado,
          pedido_id,
          pedido:pedidos(
            id,
            cliente_id,
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

      // Para cada detalle, obtener el cliente (desde pedido o desde entregas)
      const detallesConCliente = await Promise.all(
        (detallesRutaRaw || []).map(async (detalle: any) => {
          let clienteData = null

          // Si el pedido tiene cliente_id, obtener cliente directamente con coordenadas
          if (detalle.pedido?.cliente_id) {
            const { data: cliente, error: clienteError } = await supabase
              .from('clientes')
              .select('id, nombre, telefono, direccion, ST_AsGeoJSON(coordenadas)::jsonb as coordenadas')
              .eq('id', detalle.pedido.cliente_id)
              .single()

            if (!clienteError && cliente) {
              clienteData = cliente
            }
          } else {
            // Si el pedido no tiene cliente_id, buscar en entregas
            const { data: entregas, error: entregasError } = await supabase
              .from('entregas')
              .select(`
                cliente_id,
                cliente:clientes(
                  id,
                  nombre,
                  telefono,
                  direccion,
                  ST_AsGeoJSON(coordenadas)::jsonb as coordenadas
                )
              `)
              .eq('pedido_id', detalle.pedido_id)
              .limit(1)
              .single()

            if (!entregasError && entregas?.cliente) {
              clienteData = Array.isArray(entregas.cliente) ? entregas.cliente[0] : entregas.cliente
            }
          }

          return {
            ...detalle,
            pedido: {
              ...detalle.pedido,
              cliente: clienteData,
            },
          }
        })
      )

      // Crear mapa de detalles_ruta por orden_entrega para acceso rápido
      const detallesMap = new Map()
      detallesConCliente?.forEach((detalle: any) => {
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

        // Convertir coordenadas PostGIS a lat/lng si están disponibles
        let lat = cliente.lat
        let lng = cliente.lng

        // Si no hay coordenadas en orden_visita, intentar obtenerlas del cliente
        if ((!lat || !lng) && clienteData?.coordenadas) {
          const coords = clienteData.coordenadas
          if (coords && typeof coords === 'object' && 'type' in coords && coords.type === 'Point' && Array.isArray(coords.coordinates)) {
            // PostGIS GeoJSON: [lng, lat]
            const [lngCoord, latCoord] = coords.coordinates
            lat = latCoord
            lng = lngCoord
          } else if (coords && typeof coords === 'object' && 'lat' in coords && 'lng' in coords) {
            // Formato directo
            lat = coords.lat
            lng = coords.lng
          }
        }

        return {
          ...cliente,
          id: detalle.id || cliente.id,
          cliente_nombre: clienteData?.nombre || cliente.cliente_nombre,
          telefono: clienteData?.telefono || cliente.telefono || null,
          direccion: clienteData?.direccion || cliente.direccion || null,
          lat: lat,
          lng: lng,
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

    // Si no hay rutas planificadas pero hay rutas activas, generar desde detalles_ruta
    if (rutasFormateadas.length === 0) {
      console.log('🔍 [DEBUG] No hay rutas planificadas, buscando rutas activas para generar puntos')

      // Obtener IDs de rutas que ya tienen planificación
      const { data: rutasConPlanificacion } = await supabase
        .from('rutas_planificadas')
        .select('ruta_reparto_id')

      const rutasConPlanificacionIds = new Set(
        (rutasConPlanificacion || []).map((r: any) => r.ruta_reparto_id).filter(Boolean)
      )

      // Buscar rutas activas (planificada o en_curso) que no tengan ruta_planificada
      let rutasActivasQuery = supabase
        .from('rutas_reparto')
        .select(`
          id,
          numero_ruta,
          estado,
          fecha_ruta,
          vehiculo_id,
          repartidor_id,
          zona_id,
          usuarios!rutas_reparto_repartidor_id_fkey(nombre, apellido),
          vehiculos!rutas_reparto_vehiculo_id_fkey(patente, marca, modelo)
        `)
        .in('estado', ['planificada', 'en_curso'])

      // Filtrar por fecha si se proporciona
      if (fecha) {
        rutasActivasQuery = rutasActivasQuery.eq('fecha_ruta', fecha)
      }

      // Filtrar por zona si se proporciona
      if (zonaId) {
        rutasActivasQuery = rutasActivasQuery.eq('zona_id', zonaId)
      }

      const { data: rutasActivasRaw, error: rutasActivasError } = await rutasActivasQuery

      // Filtrar rutas que no tengan ruta_planificada
      const rutasActivas = (rutasActivasRaw || []).filter((ruta: any) =>
        !rutasConPlanificacionIds.has(ruta.id)
      )

      if (!rutasActivasError && rutasActivas && rutasActivas.length > 0) {
        console.log(`🔍 [DEBUG] Encontradas ${rutasActivas.length} rutas activas sin planificación, generando puntos desde detalles_ruta`)

        // Generar puntos para cada ruta activa
        const rutasGeneradas = await Promise.all(rutasActivas.map(async (ruta: any) => {
          // Obtener detalles_ruta con coordenadas
          const { data: detallesRutaRaw, error: detallesError } = await supabase
            .from('detalles_ruta')
            .select(`
              id,
              orden_entrega,
              estado_entrega,
              pago_registrado,
              monto_cobrado_registrado,
              pedido_id,
              pedido:pedidos(
                id,
                numero_pedido,
                cliente_id,
                cliente:clientes(
                  id,
                  nombre,
                  telefono,
                  direccion,
                  ST_AsGeoJSON(coordenadas)::jsonb as coordenadas
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
            .eq('ruta_id', ruta.id)
            .order('orden_entrega', { ascending: true })

          if (detallesError || !detallesRutaRaw || detallesRutaRaw.length === 0) {
            return null
          }

          // Generar orden_visita desde detalles_ruta
          // Para cada detalle, obtener cliente (del pedido o de entregas para pedidos agrupados)
          const ordenVisita = await Promise.all(detallesRutaRaw.map(async (detalle: any) => {
            const pedido = detalle.pedido
            let clienteData = Array.isArray(pedido?.cliente) ? pedido.cliente[0] : pedido?.cliente

            // Si el pedido no tiene cliente (pedido agrupado), buscar en entregas
            if (!clienteData && detalle.pedido_id) {
              const { data: entregaData } = await supabase
                .from('entregas')
                .select(`
                  cliente_id,
                  direccion,
                  cliente:clientes(
                    id,
                    nombre,
                    telefono,
                    direccion,
                    ST_AsGeoJSON(coordenadas)::jsonb as coordenadas
                  )
                `)
                .eq('pedido_id', detalle.pedido_id)
                .limit(1)
                .single()

              if (entregaData?.cliente) {
                clienteData = Array.isArray(entregaData.cliente) ? entregaData.cliente[0] : entregaData.cliente
              }
            }

            // Convertir coordenadas PostGIS a lat/lng
            let lat: number | null = null
            let lng: number | null = null

            if (clienteData?.coordenadas) {
              const coords = clienteData.coordenadas
              if (coords && typeof coords === 'object' && 'type' in coords && coords.type === 'Point' && Array.isArray(coords.coordinates)) {
                const [lngCoord, latCoord] = coords.coordinates
                lat = latCoord
                lng = lngCoord
              } else if (coords && typeof coords === 'object' && 'lat' in coords && 'lng' in coords) {
                lat = coords.lat
                lng = coords.lng
              }
            }

            // Obtener productos
            const detallesPedido = Array.isArray(pedido?.detalle_pedido)
              ? pedido.detalle_pedido
              : (pedido?.detalle_pedido ? [pedido.detalle_pedido] : [])

            const productos = detallesPedido.map((dp: any) => {
              const producto = Array.isArray(dp.producto) ? dp.producto[0] : dp.producto
              return {
                nombre: producto?.nombre || 'Producto',
                cantidad: dp.cantidad || 0,
              }
            })

            return {
              id: detalle.id,
              detalle_ruta_id: detalle.id,
              pedido_id: pedido?.id,
              cliente_id: clienteData?.id,
              cliente_nombre: clienteData?.nombre || 'Cliente',
              telefono: clienteData?.telefono || null,
              direccion: clienteData?.direccion || null,
              lat: lat,
              lng: lng,
              orden: detalle.orden_entrega,
              estado: detalle.estado_entrega || 'pendiente',
              pago_registrado: detalle.pago_registrado || false,
              monto_cobrado_registrado: detalle.monto_cobrado_registrado || 0,
              productos: productos,
            }
          }))

          // Filtrar puntos sin coordenadas
          const ordenVisitaFiltrado = ordenVisita.filter((punto: any) => punto.lat !== null && punto.lng !== null)

          if (ordenVisitaFiltrado.length === 0) {
            return null
          }


          const repartidorData = Array.isArray(ruta.usuarios) ? ruta.usuarios[0] : ruta.usuarios
          const vehiculoData = Array.isArray(ruta.vehiculos) ? ruta.vehiculos[0] : ruta.vehiculos

          return {
            id: ruta.id,
            numero_ruta: ruta.numero_ruta || 'S/N',
            estado: ruta.estado,
            vehiculo: vehiculoData || null,
            repartidor: repartidorData ? {
              nombre: repartidorData.nombre,
              apellido: repartidorData.apellido
            } : null,
            zona_id: ruta.zona_id,
            polyline: '', // No hay polyline si no está optimizada
            orden_visita: ordenVisitaFiltrado,
            distancia_total_km: null,
            duracion_total_min: null,
            created_at: new Date().toISOString()
          }
        }))

        // Agregar rutas generadas a las formateadas
        rutasFormateadas.push(...rutasGeneradas.filter((r: any) => r !== null))
        console.log(`✅ [DEBUG] Agregadas ${rutasGeneradas.filter((r: any) => r !== null).length} rutas generadas desde detalles_ruta`)
      }
    }

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
