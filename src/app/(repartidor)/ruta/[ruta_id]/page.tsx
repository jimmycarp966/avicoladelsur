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

  // Obtener ruta básica primero
  const { data: rutaBasica, error: rutaError } = await supabase
    .from('rutas_reparto')
    .select(`
      *,
      repartidor:usuarios!rutas_reparto_repartidor_id_fkey(id, nombre, apellido),
      vehiculo:vehiculos(patente, marca, modelo, capacidad_kg),
      zona:zonas(nombre)
    `)
    .eq('id', ruta_id)
    .single()

  if (rutaError || !rutaBasica) {
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
  if (rutaBasica.repartidor_id !== user.id) {
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

  // Obtener detalles de ruta básicos
  const { data: detallesRutaRaw, error: detallesError } = await supabase
    .from('detalles_ruta')
    .select(`
      id,
      orden_entrega,
      estado_entrega,
      fecha_hora_entrega,
      coordenadas_entrega,
      pedido_id,
      pedido:pedidos(
        id,
        numero_pedido,
        total,
        turno,
        cliente_id,
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
    `)
    .eq('ruta_id', ruta_id)
    .order('orden_entrega', { ascending: true })

  if (detallesError) {
    console.error('Error obteniendo detalles de ruta:', detallesError)
  }

  // Para cada detalle, obtener el cliente (desde pedido o desde entregas) y convertir coordenadas
  // Usamos flat() para aplanar la lista expandida
  const detallesConClienteMatrix = await Promise.all(
    (detallesRutaRaw || []).map(async (detalle: any) => {
      let clienteData = null
      let coordenadasCliente = null

      // Si el pedido tiene cliente_id, es simple
      if (detalle.pedido?.cliente_id) {
        const { data: cliente, error: clienteError } = await supabase
          .from('clientes')
          .select('id, nombre, telefono, direccion, zona_entrega, ST_AsGeoJSON(coordenadas)::jsonb as coordenadas')
          .eq('id', detalle.pedido.cliente_id)
          .single()

        if (!clienteError && cliente) {
          clienteData = cliente
          // Convertir coordenadas PostGIS si existen
          const coords = (cliente as any).coordenadas
          if (coords) {
            if (coords && typeof coords === 'object' && 'type' in coords && coords.type === 'Point' && Array.isArray(coords.coordinates)) {
              const [lng, lat] = coords.coordinates
              coordenadasCliente = { lat, lng }
            } else if (coords && typeof coords === 'object' && 'lat' in coords && 'lng' in coords) {
              coordenadasCliente = coords
            }
          }
        }

        return [{
          ...detalle,
          pedido: {
            ...detalle.pedido,
            cliente: clienteData ? {
              ...clienteData,
              coordenadas: coordenadasCliente,
            } : null,
          }
        }]
      } else {
        // Si el pedido no tiene cliente_id, buscar TODAS las entregas (pedido agrupado)
        const { data: entregas, error: entregasError } = await supabase
          .from('entregas')
          .select('id, cliente_id, coordenadas, estado_entrega, estado_pago, monto_cobrado, orden_entrega')
          .eq('pedido_id', detalle.pedido_id)
          .order('orden_entrega', { ascending: true })

        if (!entregasError && entregas && entregas.length > 0) {
          // Mapear cada entrega individual a un objeto detalle
          return await Promise.all(entregas.map(async (entregaInd: any) => {
            // Necesitamos datos del cliente
            let clienteDataInd = null
            let coordenadasInd = null

            if (entregaInd.cliente_id) {
              const { data: cliente, error: clienteError } = await supabase
                .from('clientes')
                .select('id, nombre, telefono, direccion, zona_entrega, ST_AsGeoJSON(coordenadas)::jsonb as coordenadas')
                .eq('id', entregaInd.cliente_id)
                .single()

              if (!clienteError && cliente) {
                clienteDataInd = cliente
                const coords = (entregas as any).coordenadas || (cliente as any).coordenadas
                // Prioridad a coords de entregaInd si existen (override local), si no del cliente
                // Pero aqui coords viene de entregaInd (select)
                const coordsEfectivas = entregaInd.coordenadas || (cliente as any).coordenadas

                if (coordsEfectivas) {
                  if (typeof coordsEfectivas === 'object' && 'type' in coordsEfectivas && coordsEfectivas.type === 'Point' && Array.isArray(coordsEfectivas.coordinates)) {
                    const [lng, lat] = coordsEfectivas.coordinates
                    coordenadasInd = { lat, lng }
                  } else if (typeof coordsEfectivas === 'object' && 'lat' in coordsEfectivas && 'lng' in coordsEfectivas) {
                    coordenadasInd = coordsEfectivas
                  }
                }
              }
            }

            return {
              ...detalle,
              id: entregaInd.id, // SOBRESCRIBIR ID con el de la entrega individual
              virtual_id: `${detalle.id}-${entregaInd.id}`, // Por si acaso
              detalle_ruta_id_padre: detalle.id,
              estado_entrega: entregaInd.estado_entrega,
              orden_entrega: entregaInd.orden_entrega || detalle.orden_entrega, // Usar orden especifico si hay
              pago_registrado: entregaInd.estado_pago === 'pagado',
              monto_cobrado_registrado: entregaInd.monto_cobrado,
              pedido: {
                ...detalle.pedido,
                cliente: clienteDataInd ? {
                  ...clienteDataInd,
                  coordenadas: coordenadasInd
                } : null
              }
            }
          }))
        }

        // Fallback si no hay entregas (devolver detalle original vacio)
        return [{ ...detalle }]
      }
    })
  )

  const detallesConCliente = detallesConClienteMatrix.flat()

  const ruta = {
    ...rutaBasica,
    detalles_ruta: detallesConCliente,
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

