import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { RutaHojaContent } from './ruta-hoja-content'
import { Card, CardContent } from '@/components/ui/card'
import { Truck } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function RutaHojaPage({ params }: { params: Promise<{ ruta_id: string }> }) {
  const supabase = await createClient()
  const { ruta_id } = await params

  // Obtener usuario actual
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div>No autorizado</div>

  // Obtener ruta con toda la información
  const { data: ruta, error: rutaError } = await supabase
    .from('rutas_reparto')
    .select(`
      *,
      repartidor:usuarios(id, nombre, apellido),
      vehiculo:vehiculos(patente, marca, modelo, capacidad_kg),
      zona:zonas(nombre),
      detalles_ruta (
        id,
        orden_entrega,
        estado_entrega,
        fecha_hora_entrega,
        coordenadas_entrega,
        pedido:pedidos(
          id,
          numero_pedido,
          total,
          turno,
          cliente:clientes(
            id,
            nombre,
            telefono,
            direccion,
            coordenadas,
            zona_entrega
          ),
          pago_estado,
          metodos_pago,
          instrucciones_repartidor,
          detalle_pedido (
            id,
            cantidad,
            producto:productos(
              id,
              nombre,
              codigo,
              unidad_medida
            )
          )
        )
      )
    `)
    .eq('id', ruta_id)
    .single()

  if (rutaError || !ruta) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <Truck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Ruta no encontrada</h3>
            <p className="text-muted-foreground">
              La ruta solicitada no existe o no tienes acceso
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Verificar que el repartidor sea el dueño de la ruta
  if (ruta.repartidor_id !== user.id) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <Truck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Acceso denegado</h3>
            <p className="text-muted-foreground">
              Esta ruta no está asignada a tu usuario
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <RutaHojaContent ruta={ruta} />
}

export default async function RutaHojaPageWrapper({
  params,
}: {
  params: Promise<{ ruta_id: string }>
}) {
  return <RutaHojaPage params={params} />
}

