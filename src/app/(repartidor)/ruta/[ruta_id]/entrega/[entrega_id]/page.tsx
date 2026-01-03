import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Package } from 'lucide-react'
import { EntregaDetalleContent } from './entrega-detalle-content'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ ruta_id: string; entrega_id: string }>
}

export default async function EntregaDetallePage({ params }: PageProps) {
  const supabase = await createClient()
  const { ruta_id, entrega_id } = await params

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    notFound()
  }

  let entrega: any = null

  // 1. Intentar buscar en detalles_ruta (pedidos normales)
  const { data: entregaRaw, error } = await supabase
    .from('detalles_ruta')
    .select(`
      *,
      pedido:pedidos(
        id,
        numero_pedido,
        total,
        pago_estado,
        metodos_pago,
        instruccion_repartidor,
        cliente_id,
        cliente:clientes(
          id,
          nombre,
          telefono,
          direccion,
          zona_entrega,
          coordenadas
        ),
        detalle_pedido:detalles_pedido(
          id,
          cantidad,
          producto_id,
          producto:productos(
            id,
            nombre,
            codigo,
            unidad_medida
          )
        )
      ),
      ruta:rutas_reparto(
        id,
        numero_ruta,
        fecha_ruta,
        estado,
        repartidor_id,
        vehiculo:vehiculos(patente, marca, modelo)
      )
    `)
    .eq('id', entrega_id)
    .single()

  console.log('[EntregaDetallePage] Búsqueda en detalles_ruta:', {
    entrega_id,
    found: !!entregaRaw,
    error: error?.message || null
  })

  if (entregaRaw) {
    entrega = entregaRaw

    // Ajuste para cliente si viene vacio (caso agrupado cargado como detalle normal por error, o legacy)
    const pedidoCliente = Array.isArray(entrega.pedido?.cliente)
      ? entrega.pedido.cliente[0]
      : entrega.pedido?.cliente

    if (!pedidoCliente && entrega.pedido_id) {
      // Logica existente para buscar cliente en entregas si es detalle agrupado
      const { data: entregaData } = await supabase
        .from('entregas')
        .select(`
            cliente_id,
            total,
            direccion,
            instruccion_repartidor,
            cliente:clientes(*)
          `)
        .eq('pedido_id', entrega.pedido_id)
        .limit(1)
        .single()

      if (entregaData?.cliente) {
        if (!entrega.pedido) entrega.pedido = {}
        entrega.pedido.cliente = entregaData.cliente
        if (entregaData.total) entrega.pedido.total = entregaData.total
      }
    }
  } else {
    // 2. Si no es un detalle_ruta, buscar en tabla entregas (entrega individual de agrupado)
    const { data: entregaIndividual, error: errInd } = await supabase
      .from('entregas')
      .select(`
            id,
            pedido_id,
            presupuesto_id,
            estado_entrega,
            fecha_hora_entrega,
            coordenadas,
            estado_pago,
            metodo_pago,
            monto_cobrado,
            orden_entrega,
            cliente:clientes(
              id, nombre, telefono, direccion, zona_entrega, coordenadas
            )
        `)
      .eq('id', entrega_id)
      .single()

    console.log('[EntregaDetallePage] Búsqueda en entregas:', {
      entrega_id,
      found: !!entregaIndividual,
      pedido_id: entregaIndividual?.pedido_id,
      presupuesto_id: entregaIndividual?.presupuesto_id,
      error: errInd?.message || null
    })

    // Obtener datos del presupuesto por separado si existe
    let presupuestoData: any = null
    let productosPresupuesto: any[] = []

    if (entregaIndividual?.presupuesto_id) {
      // Consulta 1: Obtener presupuesto básico
      const { data: pres, error: presError } = await supabase
        .from('presupuestos')
        .select('id, numero_presupuesto, total_final')
        .eq('id', entregaIndividual.presupuesto_id)
        .single()

      console.log('[EntregaDetallePage] Presupuesto query:', {
        presupuesto_id: entregaIndividual.presupuesto_id,
        found: !!pres,
        total_final: pres?.total_final,
        error: presError?.message
      })

      if (pres) {
        presupuestoData = pres

        // Consulta 2: Obtener items del presupuesto
        const { data: items, error: itemsError } = await supabase
          .from('presupuesto_items')
          .select(`
            id, cantidad_solicitada, peso_final, producto_id, precio_unit_final,
            producto:productos(id, nombre, codigo, unidad_medida)
          `)
          .eq('presupuesto_id', entregaIndividual.presupuesto_id)

        console.log('[EntregaDetallePage] Presupuesto items:', {
          count: items?.length,
          error: itemsError?.message
        })

        productosPresupuesto = items || []
      }
    }

    if (entregaIndividual) {
      // Validar relación con ruta a través del pedido
      // Un pedido agrupado tiene UN detalle_ruta en esta ruta
      const { data: detalleRutaPadre, error: errPadre } = await supabase
        .from('detalles_ruta')
        .select(`
                id, ruta_id, orden_entrega, pago_registrado, monto_cobrado_registrado, metodo_pago_registrado,
                pedido:pedidos(
                    id, numero_pedido, total, pago_estado, metodos_pago, instruccion_repartidor,
                    detalle_pedido:detalles_pedido(
                      id, cantidad, producto_id,
                      producto:productos(id, nombre, codigo, unidad_medida)
                    )
                ),
                ruta:rutas_reparto(
                    id, numero_ruta, fecha_ruta, estado, repartidor_id,
                    vehiculo:vehiculos(patente, marca, modelo)
                )
             `)
        .eq('pedido_id', entregaIndividual.pedido_id)
        .eq('ruta_id', ruta_id)
        .single()

      console.log('[EntregaDetallePage] Búsqueda detalleRutaPadre:', {
        pedido_id: entregaIndividual.pedido_id,
        ruta_id,
        found: !!detalleRutaPadre,
        error: errPadre?.message || null
      })

      if (detalleRutaPadre) {
        console.log('[EntregaDetallePage] detalleRutaPadre.pedido:', {
          total: (detalleRutaPadre.pedido as any)?.total,
          hasDetallePedido: !!(detalleRutaPadre.pedido as any)?.detalle_pedido,
          detalleCount: (detalleRutaPadre.pedido as any)?.detalle_pedido?.length
        })
        console.log('[EntregaDetallePage] detalleRutaPadre.ruta:', {
          rutaId: (detalleRutaPadre.ruta as any)?.id,
          repartidorId: (detalleRutaPadre.ruta as any)?.repartidor_id,
          hasRuta: !!detalleRutaPadre.ruta
        })

        // Consultar factura si existe para esta entrega
        let facturaData = null
        const { data: factura } = await supabase
          .from('facturas')
          .select('id, numero_factura, total, estado, fecha_emision')
          .eq('entrega_id', entregaIndividual.id)
          .single()

        if (factura) {
          facturaData = factura
          console.log('[EntregaDetallePage] Factura encontrada:', factura.numero_factura)
        }

        // Construir objeto híbrido compatible con la UI
        // Usamos el ID de la entrega individual como ID principal para que las acciones funcionen sobre ella

        // Usar productos del PRESUPUESTO original (obtenido en consulta separada)
        const totalDelPresupuesto = presupuestoData?.total_final || 0

        // Convertir presupuesto_items al formato detalle_pedido que espera la UI
        const detallePedidoConvertido = productosPresupuesto.map((dp: any) => ({
          id: dp.id,
          // Usar peso_final si está disponible (productos pesables), sino cantidad_solicitada
          cantidad: dp.peso_final || dp.cantidad_solicitada,
          producto_id: dp.producto_id,
          producto: dp.producto
        }))

        entrega = {
          ...detalleRutaPadre, // Heredar props del padre (incluye orden_entrega del detalle_ruta)
          id: entregaIndividual.id, // SOBRESCRIBIR ID con el de la entrega individual
          detalle_ruta_id_padre: detalleRutaPadre.id, // Guardar ref al padre por si acaso
          estado_entrega: entregaIndividual.estado_entrega, // Estado especifico
          fecha_hora_entrega: entregaIndividual.fecha_hora_entrega,
          // Usar orden_entrega de la entrega individual si existe, sino del padre
          orden_entrega: entregaIndividual.orden_entrega || (detalleRutaPadre as any).orden_entrega,
          // Estado de pago: para entregas individuales (pedidos agrupados), 
          // cada entrega tiene su propio estado de pago en la tabla entregas
          // Considerar pagado si: pagó total, pagó parcial + cuenta corriente, o todo a cuenta corriente
          pago_registrado: ['pagado', 'cuenta_corriente', 'parcial'].includes(entregaIndividual.estado_pago),
          monto_cobrado_registrado: entregaIndividual.monto_cobrado || 0,
          metodo_pago_registrado: entregaIndividual.metodo_pago,
          // Cliente especifico de esta entrega
          pedido: {
            ...(detalleRutaPadre.pedido as any),
            // IMPORTANTE: Usar el pedido_id de la entrega individual
            id: entregaIndividual.pedido_id,
            cliente: entregaIndividual.cliente,
            // Usar productos del PRESUPUESTO original
            detalle_pedido: detallePedidoConvertido,
            // Usar total del PRESUPUESTO original
            total: totalDelPresupuesto,
          },
          // Factura asociada a esta entrega
          factura: facturaData
        }
      }
    }
  }

  // DEBUG: Mostrar qué se encontró
  console.log('[EntregaDetallePage] DEBUG:', {
    entrega_id,
    ruta_id,
    user_id: user.id,
    entregaEncontrada: !!entrega,
    entregaRutaId: entrega?.ruta?.id,
    entregaRepartidorId: entrega?.ruta?.repartidor_id,
    rutaIdMatch: entrega?.ruta?.id === ruta_id,
    repartidorIdMatch: entrega?.ruta?.repartidor_id === user.id
  })

  // Validaciones finales de seguridad
  if (!entrega || entrega.ruta?.id !== ruta_id || entrega.ruta?.repartidor_id !== user.id) {
    console.error('[EntregaDetallePage] Validación fallida:', {
      entregaNull: !entrega,
      rutaIdNoMatch: entrega?.ruta?.id !== ruta_id,
      repartidorIdNoMatch: entrega?.ruta?.repartidor_id !== user.id,
      entregaRutaId: entrega?.ruta?.id,
      expectedRutaId: ruta_id,
      entregaRepartidorId: entrega?.ruta?.repartidor_id,
      expectedUserId: user.id,
      entregaRuta: entrega?.ruta
    })
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Entrega no disponible</h3>
            <p className="text-muted-foreground">
              La entrega solicitada no existe o no tienes acceso
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <EntregaDetalleContent entrega={entrega} />
}


