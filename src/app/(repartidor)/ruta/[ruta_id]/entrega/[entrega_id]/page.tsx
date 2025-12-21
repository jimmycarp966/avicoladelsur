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
      error: errInd?.message || null
    })

    if (entregaIndividual) {
      // Validar relación con ruta a través del pedido
      // Un pedido agrupado tiene UN detalle_ruta en esta ruta
      const { data: detalleRutaPadre, error: errPadre } = await supabase
        .from('detalles_ruta')
        .select(`
                id, ruta_id,
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
        // Construir objeto híbrido compatible con la UI
        // Usamos el ID de la entrega individual como ID principal para que las acciones funcionen sobre ella
        entrega = {
          ...detalleRutaPadre, // Heredar props del padre
          id: entregaIndividual.id, // SOBRESCRIBIR ID con el de la entrega individual
          detalle_ruta_id_padre: detalleRutaPadre.id, // Guardar ref al padre por si acaso
          estado_entrega: entregaIndividual.estado_entrega, // Estado especifico
          fecha_hora_entrega: entregaIndividual.fecha_hora_entrega,
          // Cliente especifico de esta entrega
          pedido: {
            ...(detalleRutaPadre.pedido as any),
            cliente: entregaIndividual.cliente,
            // Si la entrega tiene un total especifico (no esta en modelo actual pero podria), usarlo.
            // Por ahora heredamos total del pedido general, lo cual es incorrecto para cobros parciales.
            // TODO: Si 'entregas' tuviera campo 'monto_a_cobrar', usarlo aqui.
          }
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
      repartidorIdNoMatch: entrega?.ruta?.repartidor_id !== user.id
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


