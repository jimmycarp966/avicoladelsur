/**
 * GET /api/rutas/:id/recorrido
 * 
 * Devuelve polyline y puntos históricos del día para una ruta
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()

    // Obtener parámetros
    const resolvedParams = await params
    const { id } = resolvedParams

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    const rutaId = id

    // Obtener ruta reparto primero para verificar que existe
    const { data: rutaReparto, error: rutaRepartoError } = await supabase
      .from('rutas_reparto')
      .select(`
        fecha_ruta,
        vehiculo_id,
        numero_ruta,
        estado,
        repartidor:usuarios!rutas_reparto_repartidor_id_fkey(
          nombre,
          apellido
        )
      `)
      .eq('id', rutaId)
      .single()

    if (rutaRepartoError || !rutaReparto) {
      return NextResponse.json(
        { success: false, error: 'Ruta no encontrada' },
        { status: 404 }
      )
    }

    // Obtener ruta planificada con polyline (puede no existir si la ruta no tiene pedidos o no se optimizó)
    const { data: rutaPlanificada, error: rutaError } = await supabase
      .from('rutas_planificadas')
      .select('polyline, orden_visita, ruta_reparto_id')
      .eq('ruta_reparto_id', rutaId)
      .maybeSingle()

    // Verificar si la ruta tiene pedidos asignados
    const { data: detallesRutaCheck, error: detallesCheckError } = await supabase
      .from('detalles_ruta')
      .select('id')
      .eq('ruta_id', rutaId)
      .limit(1)

    const tienePedidos = detallesRutaCheck && detallesRutaCheck.length > 0
    const tieneOptimizacion = rutaPlanificada && !rutaError

    // Si no tiene pedidos, devolver respuesta exitosa con datos vacíos
    if (!tienePedidos) {
      const repartidorData = Array.isArray(rutaReparto.repartidor)
        ? rutaReparto.repartidor[0]
        : rutaReparto.repartidor

      return NextResponse.json({
        success: true,
        data: {
          numero_ruta: rutaReparto.numero_ruta || 'S/N',
          repartidor_nombre: repartidorData
            ? `${repartidorData.nombre} ${repartidorData.apellido || ''}`.trim()
            : 'Sin asignar',
          polyline: '',
          ordenVisita: [],
          historial: [],
          mensaje: 'Esta ruta no tiene pedidos asignados aún'
        }
      })
    }

    // Obtener todas las entregas asociadas a los pedidos de esta ruta para procesar sub-entregas
    // Primero necesitamos los IDs de los pedidos
    const { data: rutaPedidos } = await supabase
      .from('detalles_ruta')
      .select('pedido_id')
      .eq('ruta_id', rutaId)

    const pedidoIds = rutaPedidos?.map((r: any) => r.pedido_id).filter(Boolean) || []

    // Cargar mapa de entregas por pedido_id
    let entregasPorPedido: Record<string, any[]> = {}
    if (pedidoIds.length > 0) {
      const { data: todasEntregas } = await supabase
        .from('entregas')
        .select(`
            id,
            pedido_id,
            cliente_id,
            orden_entrega,
            estado_entrega,
            pago_registrado,
            monto_cobrado,
            coordenadas,
            cliente:clientes(
                id, nombre, telefono, direccion, ST_AsGeoJSON(coordenadas)::jsonb as coordenadas
            )
        `)
        .in('pedido_id', pedidoIds)
        .order('orden_entrega')

      if (todasEntregas) {
        todasEntregas.forEach((e: any) => {
          if (!entregasPorPedido[e.pedido_id]) entregasPorPedido[e.pedido_id] = []
          entregasPorPedido[e.pedido_id].push(e)
        })
      }
    }

    // Si tiene pedidos pero no optimización, generar orden_visita desde detalles_ruta
    if (!tieneOptimizacion) {
      // Obtener detalles_ruta con coordenadas de clientes
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
        .eq('ruta_id', rutaId)
        .order('orden_entrega', { ascending: true })

      if (detallesError) {
        console.error('Error obteniendo detalles_ruta:', detallesError)
      }

      // Generar orden_visita desde detalles_ruta
      const ordenVisitaGenerado = (detallesRutaRaw || []).flatMap((detalle: any) => {
        const pedido = detalle.pedido
        const clienteData = Array.isArray(pedido?.cliente) ? pedido.cliente[0] : pedido?.cliente

        // Si no tiene cliente directo, verificar si es pedido agrupado con entregas
        if (!clienteData && pedido?.id && entregasPorPedido[pedido.id] && entregasPorPedido[pedido.id].length > 0) {
          const subEntregas = entregasPorPedido[pedido.id]

          return subEntregas.map((entregaInd: any) => {
            const clienteInd = Array.isArray(entregaInd.cliente) ? entregaInd.cliente[0] : entregaInd.cliente

            // Coordenadas
            let lat: number | null = null
            let lng: number | null = null

            // Logica coordenadas (prioridad entrega > cliente)
            const coordsRaw = entregaInd.coordenadas || clienteInd?.coordenadas
            if (coordsRaw) {
              if (typeof coordsRaw === 'object' && 'type' in coordsRaw && coordsRaw.type === 'Point' && Array.isArray(coordsRaw.coordinates)) {
                const [lngC, latC] = coordsRaw.coordinates; lat = latC; lng = lngC;
              } else if (typeof coordsRaw === 'object' && 'lat' in coordsRaw && 'lng' in coordsRaw) {
                lat = coordsRaw.lat; lng = coordsRaw.lng;
              }
            }

            // Productos (todos los del pedido por ahora, ya que no se divide per se en modelo actual)
            const detallesPedido = Array.isArray(pedido?.detalle_pedido) ? pedido.detalle_pedido : (pedido?.detalle_pedido ? [pedido.detalle_pedido] : [])
            const productos = detallesPedido.map((dp: any) => {
              const producto = Array.isArray(dp.producto) ? dp.producto[0] : dp.producto
              return { nombre: producto?.nombre || 'Producto', cantidad: dp.cantidad || 0 }
            })

            return {
              id: entregaInd.id, // ID de la entrega individual
              detalle_ruta_id: detalle.id,
              virtual_id: `${detalle.id}-${entregaInd.id}`,
              pedido_id: pedido?.id,
              cliente_id: clienteInd?.id,
              cliente_nombre: clienteInd?.nombre || 'Cliente Agrupado',
              telefono: clienteInd?.telefono || null,
              direccion: clienteInd?.direccion || null,
              lat, lng,
              orden: entregaInd.orden_entrega || detalle.orden_entrega,
              estado: entregaInd.estado_entrega || 'pendiente',
              pago_registrado: entregaInd.estado_pago === 'pagado',
              monto_cobrado_registrado: entregaInd.monto_cobrado,
              productos
            }
          })
        }

        // ... Lógica normal para pedidos simples ...
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

        return [{
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
        }]
      }).filter((punto: any) => punto.lat !== null && punto.lng !== null) // Solo incluir puntos con coordenadas válidas

      const repartidorData = Array.isArray(rutaReparto.repartidor)
        ? rutaReparto.repartidor[0]
        : rutaReparto.repartidor

      return NextResponse.json({
        success: true,
        data: {
          numero_ruta: rutaReparto.numero_ruta || 'S/N',
          repartidor_nombre: repartidorData
            ? `${repartidorData.nombre} ${repartidorData.apellido || ''}`.trim()
            : 'Sin asignar',
          polyline: '', // No hay polyline si no está optimizada
          ordenVisita: ordenVisitaGenerado.map((item: any, index: number) => ({ ...item, orden: index + 1 })),
          historial: [],
          mensaje: ordenVisitaGenerado.length === 0
            ? 'Esta ruta tiene pedidos asignados pero los clientes no tienen coordenadas. Agrega coordenadas a los clientes para verlos en el mapa.'
            : `Ruta con ${ordenVisitaGenerado.length} entrega(s). Optimiza la ruta para obtener la ruta más eficiente.`
        }
      })
    }

    // Obtener ubicaciones históricas del día para el vehículo
    const fecha = rutaReparto.fecha_ruta
    const { data: ubicaciones, error: ubicacionesError } = await supabase
      .from('ubicaciones_repartidores')
      .select('lat, lng, created_at')
      .eq('vehiculo_id', rutaReparto.vehiculo_id)
      .gte('created_at', `${fecha}T00:00:00`)
      .lt('created_at', `${fecha}T23:59:59`)
      .order('created_at', { ascending: true })

    if (ubicacionesError) throw ubicacionesError

    // Enriquecer orden_visita con información de productos y estado de pago
    const { data: detallesRutaCompleta, error: detallesError } = await supabase
      .from('detalles_ruta')
      .select(`
        id,
        orden_entrega,
        estado_entrega,
        pago_registrado,
        monto_cobrado_registrado,
        pedido:pedidos(
          id,
          numero_pedido,
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
      .eq('ruta_id', rutaId)
      .order('orden_entrega', { ascending: true })

    // Crear mapa de detalles_ruta por orden_entrega
    const detallesMap = new Map()
    detallesRutaCompleta?.forEach((detalle: any) => {
      detallesMap.set(detalle.orden_entrega, detalle)
    })

    // Enriquecer orden_visita
    const ordenVisitaEnriquecido = (rutaPlanificada.orden_visita || []).flatMap((cliente: any) => {
      const detalle = detallesMap.get(cliente.orden)

      // Si el detalle corresponde a un pedido sin cliente_id (agrupado), expandir usando entregas
      if (detalle && detalle.pedido && !detalle.pedido.cliente_id && entregasPorPedido[detalle.pedido.id]) {
        const subEntregas = entregasPorPedido[detalle.pedido.id]
        const detallesPedido = Array.isArray(detalle.pedido.detalle_pedido)
          ? detalle.pedido.detalle_pedido
          : (detalle.pedido.detalle_pedido ? [detalle.pedido.detalle_pedido] : [])

        const productos = detallesPedido.map((dp: any) => {
          const producto = Array.isArray(dp.producto) ? dp.producto[0] : dp.producto
          return { nombre: producto?.nombre || 'Producto', cantidad: dp.cantidad || 0 }
        })

        return subEntregas.map((entregaInd: any) => {
          const clienteInd = Array.isArray(entregaInd.cliente) ? entregaInd.cliente[0] : entregaInd.cliente
          return {
            ...cliente, // Heredar props basicas del punto original (polyline index, etc) OJO: coordinates del punto original podrian ser del grupo.
            // Sobrescribir con info especifica
            id: entregaInd.id,
            virtual_id: `${detalle.id}-${entregaInd.id}`,
            cliente_nombre: clienteInd?.nombre || cliente.cliente_nombre,
            telefono: clienteInd?.telefono || cliente.telefono,
            direccion: clienteInd?.direccion || cliente.direccion,
            // Si tenemos coordenadas reales de la entrega, usarlas en vez de la del grupo
            // (Nota: si el punto original era parte del path, esto solo afecta el marcador visual)
            // TODO: Si el monitor usa lat/lng para marcador, esto lo mueve.

            estado_entrega: entregaInd.estado_entrega || 'pendiente',
            pago_registrado: entregaInd.estado_pago === 'pagado',
            monto_cobrado_registrado: entregaInd.monto_cobrado,
            productos
          }
        })
      }

      if (!detalle || !detalle.pedido) {
        return [{
          ...cliente,
          productos: [],
          pago_registrado: false,
          monto_cobrado_registrado: 0,
          telefono: cliente.telefono || null,
          direccion: cliente.direccion || null,
        }]
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

      return [{
        ...cliente,
        id: detalle.id || cliente.id,
        cliente_nombre: clienteData?.nombre || cliente.cliente_nombre,
        telefono: clienteData?.telefono || cliente.telefono || null,
        direccion: clienteData?.direccion || cliente.direccion || null,
        estado_entrega: detalle.estado_entrega || cliente.estado || 'pendiente',
        pago_registrado: detalle.pago_registrado || false,
        monto_cobrado_registrado: detalle.monto_cobrado_registrado || 0,
        productos: productos,
      }]
    })

    const repartidorData = Array.isArray(rutaReparto.repartidor)
      ? rutaReparto.repartidor[0]
      : rutaReparto.repartidor

    return NextResponse.json({
      success: true,
      data: {
        numero_ruta: rutaReparto.numero_ruta || 'S/N',
        repartidor_nombre: repartidorData
          ? `${repartidorData.nombre} ${repartidorData.apellido || ''}`.trim()
          : 'Sin asignar',
        polyline: rutaPlanificada.polyline,
        ordenVisita: ordenVisitaEnriquecido.map((item: any, index: number) => ({ ...item, orden: index + 1 })),
        historial: ubicaciones || []
      }
    })
  } catch (error: any) {
    console.error('Error al obtener recorrido:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al obtener recorrido' },
      { status: 500 }
    )
  }
}

