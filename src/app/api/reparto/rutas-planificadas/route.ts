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
      .in('estado', ['en_curso', 'planificada', 'optimizada'])

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
      const detallesConCliente = (await Promise.all(
        (detallesRutaRaw || []).map(async (detalleRaw: any) => {
          let entregasAProcesar = []

          // Si el pedido tiene cliente_id, es simple
          if (detalleRaw.pedido?.cliente_id) {
            entregasAProcesar.push({
              ...detalleRaw,
              virtual_id: detalleRaw.id,
              cliente_final_id: detalleRaw.pedido.cliente_id
            })
          } else if (detalleRaw.pedido_id) {
            // Pedido agrupado: buscar todas las entregas
            const { data: entregas, error: entregasError } = await supabase
              .from('entregas')
              .select(`
                  id,
                  cliente_id,
                  estado_entrega,
                  estado_pago,
                  monto_cobrado,
                  orden_entrega,
                  cliente:clientes(id, nombre, direccion, telefono, coordenadas),
                  coordenadas
                `)
              .eq('pedido_id', detalleRaw.pedido_id)
              .order('orden_entrega', { ascending: true })

            if (!entregasError && entregas && entregas.length > 0) {
              entregas.forEach((entrega: any) => {
                entregasAProcesar.push({
                  ...detalleRaw,
                  virtual_id: entrega.id,
                  cliente_final_id: entrega.cliente_id,
                  estado_entrega: entrega.estado_entrega,
                  pago_registrado: entrega.estado_pago === 'pagado',
                  monto_cobrado_registrado: entrega.monto_cobrado,
                  cliente_data_preloaded: entrega.cliente,
                  coordenadas_entrega: entrega.coordenadas
                })
              })
            } else {
              entregasAProcesar.push({
                ...detalleRaw,
                virtual_id: detalleRaw.id
              })
            }
          }

          // Procesar cada entrega y obtener datos finales de cliente
          return await Promise.all(entregasAProcesar.map(async (detalle: any) => {
            const pedido = detalle.pedido
            let clienteData = detalle.cliente_data_preloaded || null
            let clienteId = detalle.cliente_final_id

            if (!clienteData && clienteId) {
              const { data: cliente, error: clienteError } = await supabase
                .from('clientes')
                .select('id, nombre, telefono, direccion, ST_AsGeoJSON(coordenadas)::jsonb as coordenadas')
                .eq('id', clienteId)
                .single()

              if (!clienteError && cliente) clienteData = cliente
            }

            return {
              ...detalle,
              pedido: {
                ...detalle.pedido,
                cliente: clienteData
              }
            }
          }))
        })
      )).flat()

      // Crear mapa de detalles_ruta por orden_entrega para acceso rápido
      // Como un orden puede tener multiples entregas (pedido agrupado expandido), el valor es Array
      const detallesMap = new Map<number, any[]>()
      detallesConCliente?.forEach((detalle: any) => {
        const list = detallesMap.get(detalle.orden_entrega) || []
        list.push(detalle)
        detallesMap.set(detalle.orden_entrega, list)
      })

      // Enriquecer orden_visita
      // Si el orden_visita ya tiene cliente_id y cliente_nombre (viene de optimización), usarlo directamente
      const ordenVisitaEnriquecido = (ruta.orden_visita || []).map((cliente: any) => {
        // Si ya tiene los datos principales, solo agregar productos y estado de pago
        if (cliente.cliente_id && cliente.cliente_nombre && cliente.lat && cliente.lng) {
          // Buscar detalle para obtener productos y estado de pago
          const detallesFlat = Array.from(detallesMap.values()).flat()
          const detalleMatch = detallesFlat.find((d: any) =>
            d.id === cliente.id ||
            d.virtual_id === cliente.id ||
            d.detalle_ruta_id === cliente.detalle_ruta_id ||
            d.pedido_id === cliente.pedido_id ||
            d.cliente_final_id === cliente.cliente_id ||
            d.pedido?.cliente?.id === cliente.cliente_id
          )

          const pedido = detalleMatch?.pedido
          const clienteData = Array.isArray(pedido?.cliente) ? pedido.cliente[0] : pedido?.cliente
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
            ...cliente,
            id: cliente.id || detalleMatch?.virtual_id || detalleMatch?.id || cliente.cliente_id,
            telefono: cliente.telefono || clienteData?.telefono || null,
            direccion: cliente.direccion || clienteData?.direccion || null,
            estado_entrega: detalleMatch?.estado_entrega || cliente.estado || 'pendiente',
            pago_registrado: detalleMatch?.pago_registrado || false,
            monto_cobrado_registrado: detalleMatch?.monto_cobrado_registrado || 0,
            productos: productos,
          }
        }

        // Fallback: lógica anterior de enriquecimiento completo
        const detalles = detallesMap.get(cliente.orden) || []

        // Si no hay detalles asociados a este orden, devolvemos el original
        if (detalles.length === 0) {
          return {
            ...cliente,
            productos: [],
            pago_registrado: false,
            monto_cobrado_registrado: 0,
            telefono: cliente.telefono || null,
            direccion: cliente.direccion || null,
          }
        }

        // Si hay detalles, usar el primero (evitar expansión/duplicados)
        const detalle = detalles[0]
        const pedido = detalle.pedido
        const clienteData = Array.isArray(pedido?.cliente) ? pedido.cliente[0] : pedido?.cliente

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

        // Coordenadas
        let lat = cliente.lat
        let lng = cliente.lng

        if (detalle.coordenadas_entrega) {
          const c = detalle.coordenadas_entrega
          if (c.lat && c.lng) { lat = c.lat; lng = c.lng }
          else if (c.coordinates) { lng = c.coordinates[0]; lat = c.coordinates[1] }
        } else if (clienteData?.coordenadas) {
          const c = clienteData.coordenadas
          if (c.lat && c.lng) { lat = c.lat; lng = c.lng }
          else if (c.coordinates) { lng = c.coordinates[0]; lat = c.coordinates[1] }
          else if (typeof c.type === 'string' && Array.isArray(c.coordinates)) {
            lng = c.coordinates[0]; lat = c.coordinates[1]
          }
        }

        return {
          ...cliente,
          id: detalle.virtual_id || detalle.id || cliente.id,
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

      // Deduplicar por cliente_id para evitar clientes repetidos
      const clientesVistos = new Set<string>()
      const ordenVisitaSinDuplicados = ordenVisitaEnriquecido.filter((item: any) => {
        if (!item.cliente_id) return true // Mantener items sin cliente_id
        if (clientesVistos.has(item.cliente_id)) return false // Filtrar duplicado
        clientesVistos.add(item.cliente_id)
        return true
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
        orden_visita: ordenVisitaSinDuplicados.map((item: any, index: number) => ({ ...item, orden: index + 1 })),
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
          // Obtener detalles_ruta - SIN ST_AsGeoJSON en consulta anidada (Supabase no lo soporta)
          // Las coordenadas las obtendremos por separado para cada cliente
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

          console.log('[DEBUG] detallesRutaRaw para ruta', ruta.id, ':', {
            count: detallesRutaRaw?.length,
            error: detallesError,
            data: detallesRutaRaw
          })

          if (detallesError || !detallesRutaRaw || detallesRutaRaw.length === 0) {
            console.log('[DEBUG] No hay detalles_ruta para ruta', ruta.id, '- retornando null')
            return null
          }

          // Generar orden_visita desde detalles_ruta
          // Para cada detalle, obtener cliente por separado (evitando consultas anidadas con ST_AsGeoJSON)
          // Generar orden_visita desde detalles_ruta
          // Expandir pedidos agrupados si es necesario
          const ordenVisita = (await Promise.all(detallesRutaRaw.map(async (detalleRaw: any) => {
            // Si tiene cliente_id es simple, si no, buscar entregas
            let entregasAProcesar = []

            if (detalleRaw.pedido?.cliente_id) {
              // Pedido simple: convertimos el detalle en un "item de entrega" único
              entregasAProcesar.push({
                ...detalleRaw,
                virtual_id: detalleRaw.id,
                cliente_final_id: detalleRaw.pedido.cliente_id
              })
            } else if (detalleRaw.pedido_id) {
              // Pedido agrupado: buscar todas las entregas
              const { data: entregas, error: entregasError } = await supabase
                .from('entregas')
                .select(`
                  id,
                  cliente_id,
                  estado_entrega,
                  estado_pago,
                  monto_cobrado,
                  orden_entrega,
                  cliente:clientes(id, nombre, direccion, telefono, coordenadas),
                  coordenadas
                `)
                .eq('pedido_id', detalleRaw.pedido_id)
                .order('orden_entrega', { ascending: true })

              if (!entregasError && entregas && entregas.length > 0) {
                entregas.forEach((entrega: any) => {
                  entregasAProcesar.push({
                    ...detalleRaw,
                    virtual_id: entrega.id, // ID Único de la entrega
                    cliente_final_id: entrega.cliente_id,
                    estado_entrega: entrega.estado_entrega, // Sobrescribir estado
                    pago_registrado: entrega.estado_pago === 'pagado',
                    monto_cobrado_registrado: entrega.monto_cobrado,
                    cliente_data_preloaded: entrega.cliente, // Pasamos cliente ya cargado
                    coordenadas_entrega: entrega.coordenadas
                  })
                })
              } else {
                // Fallback si no hay entregas (no debería pasar)
                entregasAProcesar.push({
                  ...detalleRaw,
                  virtual_id: detalleRaw.id
                })
              }
            }

            // Procesar cada entrega individualmente
            return await Promise.all(entregasAProcesar.map(async (detalle: any) => {
              const pedido = detalle.pedido
              let clienteData: any = detalle.cliente_data_preloaded || null
              let clienteId: string | null = detalle.cliente_final_id
              let lat: number | null = null
              let lng: number | null = null

              // Si no vino pre-cargado pero tenemos ID, buscarlo
              if (!clienteData && clienteId) {
                const { data: clienteRpc, error: clienteError } = await supabase
                  .rpc('fn_get_cliente_con_coordenadas', { p_cliente_id: clienteId })
                  .single()

                if (!clienteError && clienteRpc) {
                  clienteData = clienteRpc as any
                  lat = (clienteRpc as any).lat
                  lng = (clienteRpc as any).lng
                }
              } else if (clienteData) {
                // Si ya vino pre-cargado, extraer coords
                // Intentar sacar lat/lng de coordenadas o del objeto cliente
                if (detalle.coordenadas_entrega) {
                  // Prioridad a coord de la entrega
                  // Asumimos formato simple punto {lat, lng} o GeoJSON
                  // Por simplicidad, si viene de 'entregas', suele ser Point
                  // ... procesamiento coords
                }

                // Si no, intentar del cliente (que puede venir como array o objeto)
                const clienteObj = Array.isArray(clienteData) ? clienteData[0] : clienteData
                if (clienteObj) {
                  // Procesar coordenadas del cliente pre-cargado
                  // Aquí asumimos que el select incluyó coordenadas
                  if (clienteObj.coordenadas) {
                    const c = clienteObj.coordenadas
                    if (c.lat && c.lng) { lat = c.lat; lng = c.lng }
                    else if (c.coordinates && Array.isArray(c.coordinates)) {
                      lng = c.coordinates[0]; lat = c.coordinates[1]
                    }
                  }
                }
                // Si no obtuvimos lat/lng aun y usamos fn_get_cliente antes, replicar logica si hiciera falta. 
                // Pero en el bloque anterior (Agrupado) hicimos select ordenado.
                // Para simplificar, si ya tengo clienteData del select inner join, uso eso.
                if (lat === null && clienteData) {
                  // Parsear coordenadas standard PostGIS object -> lat/lng
                  const c = clienteData.coordenadas
                  if (c) {
                    if (typeof c === 'object') {
                      if ('lat' in c) { lat = c.lat; lng = c.lng }
                      else if ('coordinates' in c) { lng = c.coordinates[0]; lat = c.coordinates[1] }
                    }
                  }
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
                id: detalle.virtual_id,
                detalle_ruta_id: detalle.id, // ID original del detalle_ruta (padre)
                pedido_id: pedido?.id,
                cliente_id: clienteData?.id || clienteId,
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
          }))).flat()

          // Filtrar puntos sin coordenadas
          const ordenVisitaFiltrado = ordenVisita.filter((punto: any) => punto.lat !== null && punto.lng !== null)

          // Deduplicar por cliente_id
          const clientesVistos = new Set<string>()
          const ordenVisitaSinDuplicados = ordenVisitaFiltrado.filter((item: any) => {
            if (!item.cliente_id) return true
            if (clientesVistos.has(item.cliente_id)) return false
            clientesVistos.add(item.cliente_id)
            return true
          })

          if (ordenVisitaSinDuplicados.length === 0) {
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
            orden_visita: ordenVisitaSinDuplicados.map((item: any, index: number) => ({ ...item, orden: index + 1 })),
            distancia_total_km: null,
            duracion_total_min: null,
            created_at: new Date().toISOString()
          }
        }))

        // Agregar rutas generadas a las formateadas
        rutasFormateadas.push(...(rutasGeneradas.filter((r: any) => r !== null) as any))
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
