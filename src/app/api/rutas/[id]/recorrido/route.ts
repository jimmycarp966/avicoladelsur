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
    
    // Obtener ruta planificada con polyline
    const { data: rutaPlanificada, error: rutaError } = await supabase
      .from('rutas_planificadas')
      .select('polyline, orden_visita, ruta_reparto_id')
      .eq('ruta_reparto_id', rutaId)
      .single()
    
    if (rutaError || !rutaPlanificada) {
      return NextResponse.json(
        { success: false, error: 'Ruta planificada no encontrada' },
        { status: 404 }
      )
    }
    
    // Obtener ruta reparto para fecha, vehículo, número y repartidor
    const { data: rutaReparto, error: rutaRepartoError } = await supabase
      .from('rutas_reparto')
      .select(`
        fecha_ruta,
        vehiculo_id,
        numero_ruta,
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
    detallesRuta?.forEach((detalle: any) => {
      detallesMap.set(detalle.orden_entrega, detalle)
    })

    // Enriquecer orden_visita
    const ordenVisitaEnriquecido = (rutaPlanificada.orden_visita || []).map((cliente: any) => {
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
        ordenVisita: ordenVisitaEnriquecido,
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

