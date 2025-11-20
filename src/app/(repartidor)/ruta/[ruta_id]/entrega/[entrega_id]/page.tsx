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

  const { data: entrega, error } = await supabase
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

  if (error || !entrega || entrega.ruta_id !== ruta_id || entrega.ruta?.repartidor_id !== user.id) {
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


