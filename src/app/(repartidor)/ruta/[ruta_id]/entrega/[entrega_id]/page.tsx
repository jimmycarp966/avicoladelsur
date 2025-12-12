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
        instrucciones_repartidor,
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

  if (error || !entregaRaw || entregaRaw.ruta_id !== ruta_id || entregaRaw.ruta?.repartidor_id !== user.id) {
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

  // Si el pedido no tiene cliente (pedido agrupado), buscar desde entregas
  let entrega = entregaRaw as any
  const pedidoCliente = Array.isArray(entrega.pedido?.cliente)
    ? entrega.pedido.cliente[0]
    : entrega.pedido?.cliente

  if (!pedidoCliente && entrega.pedido_id) {
    const { data: entregaData } = await supabase
      .from('entregas')
      .select(`
        cliente_id,
        total,
        direccion,
        instruccion_repartidor,
        cliente:clientes(
          id,
          nombre,
          telefono,
          direccion,
          zona_entrega,
          coordenadas
        )
      `)
      .eq('pedido_id', entrega.pedido_id)
      .limit(1)
      .single()

    if (entregaData?.cliente) {
      const clienteFromEntrega = Array.isArray(entregaData.cliente)
        ? entregaData.cliente[0]
        : entregaData.cliente

      entrega = {
        ...entrega,
        pedido: {
          ...entrega.pedido,
          cliente: clienteFromEntrega,
          total: entregaData.total || entrega.pedido?.total,
          instrucciones_repartidor: entregaData.instruccion_repartidor || entrega.pedido?.instrucciones_repartidor,
        }
      }
    }
  }

  return <EntregaDetalleContent entrega={entrega} />
}


