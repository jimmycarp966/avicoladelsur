import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import RutaMapaClient from '@/components/reparto/RutaMapaClient'

export const dynamic = 'force-dynamic'

async function RutaMapaContent({ rutaId }: { rutaId: string }) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <Card className="p-6 text-center">
        <CardContent>No autorizado</CardContent>
      </Card>
    )
  }

  // Obtener ruta básica primero
  const { data: rutaBasica, error: rutaError } = await supabase
    .from('rutas_reparto')
    .select(
      `
        *,
        repartidor:usuarios!rutas_reparto_repartidor_id_fkey(id, nombre, apellido),
        vehiculo:vehiculos(patente, marca, modelo, capacidad_kg),
        zona:zonas(nombre)
      `,
    )
    .eq('id', rutaId)
    .single()

  if (rutaError || !rutaBasica) {
    return (
      <Card className="p-6 text-center">
        <CardContent>Error al cargar la ruta</CardContent>
      </Card>
    )
  }

  if (rutaBasica.repartidor_id !== user.id) {
    return (
      <Card className="p-6 text-center">
        <CardContent>Esta ruta no está asignada a tu usuario</CardContent>
      </Card>
    )
  }

  // Obtener detalles de ruta básicos
  const { data: detallesRutaRaw, error: detallesError } = await supabase
    .from('detalles_ruta')
    .select(`
      id,
      orden_entrega,
      estado_entrega,
      coordenadas_entrega,
      pedido_id,
      pedido:pedidos(
        id,
        numero_pedido,
        cliente_id
      )
    `)
    .eq('ruta_id', rutaId)
    .order('orden_entrega', { ascending: true })

  if (detallesError) {
    console.error('Error obteniendo detalles de ruta:', detallesError)
  }

  // Para cada detalle, obtener el cliente (desde pedido o desde entregas) y convertir coordenadas
  const detallesConCliente = await Promise.all(
    (detallesRutaRaw || []).map(async (detalle: any) => {
      let clienteData = null
      let coordenadasCliente = null

      // Si el pedido tiene cliente_id, obtener cliente directamente
      if (detalle.pedido?.cliente_id) {
        const { data: cliente, error: clienteError } = await supabase
          .from('clientes')
          .select('id, nombre, direccion, coordenadas')
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
      } else {
        // Si el pedido no tiene cliente_id, buscar en entregas (pedido agrupado)
        const { data: entregas, error: entregasError } = await supabase
          .from('entregas')
          .select('cliente_id, coordenadas')
          .eq('pedido_id', detalle.pedido_id)
          .limit(1)
          .single()

        if (!entregasError && entregas?.cliente_id) {
          // Obtener cliente con select simple
          const { data: cliente, error: clienteError } = await supabase
            .from('clientes')
            .select('id, nombre, direccion, coordenadas')
            .eq('id', entregas.cliente_id)
            .single()

          if (!clienteError && cliente) {
            clienteData = cliente
            // Convertir coordenadas desde entregas o desde cliente
            const coords = (entregas as any).coordenadas || (cliente as any).coordenadas
            if (coords) {
              if (coords && typeof coords === 'object' && 'type' in coords && coords.type === 'Point' && Array.isArray(coords.coordinates)) {
                const [lng, lat] = coords.coordinates
                coordenadasCliente = { lat, lng }
              } else if (coords && typeof coords === 'object' && 'lat' in coords && 'lng' in coords) {
                coordenadasCliente = coords
              }
            }
          }
        }
      }

      return {
        ...detalle,
        pedido: {
          ...detalle.pedido,
          cliente: clienteData ? {
            ...clienteData,
            coordenadas: coordenadasCliente,
          } : null,
        },
      }
    })
  )

  const ruta = {
    ...rutaBasica,
    detalles_ruta: detallesConCliente,
  }

  const puedeTrackear = ruta.estado === 'en_curso'
  const fechaLegible = new Date(ruta.fecha_ruta).toLocaleDateString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Ruta #{ruta.numero_ruta}</p>
          <h1 className="text-2xl font-semibold">{fechaLegible}</h1>
        </div>
        <Badge
          variant={ruta.estado === 'en_curso' ? 'default' : 'secondary'}
          className="text-sm"
        >
          {ruta.estado === 'en_curso'
            ? 'En curso'
            : ruta.estado === 'completada'
              ? 'Completada'
              : 'Planificada'}
        </Badge>
      </div>

      <RutaMapaClient
        ruta={{
          id: ruta.id,
          numero_ruta: ruta.numero_ruta,
          fecha_ruta: ruta.fecha_ruta,
          turno: ruta.turno,
          estado: ruta.estado,
          repartidor_id: ruta.repartidor_id,
          vehiculo_id: ruta.vehiculo_id,
          zona: ruta.zona,
          vehiculo: ruta.vehiculo,
          detalles_ruta: ruta.detalles_ruta,
        }}
        puedeTrackear={puedeTrackear}
      />
    </div>
  )
}

export default async function RutaMapaPage({
  params,
}: {
  params: Promise<{ ruta_id: string }>
}) {
  const { ruta_id } = await params

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="text-muted-foreground hover:text-foreground"
        >
          <Link href={`/ruta/${ruta_id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a la lista
          </Link>
        </Button>
      </div>

      <Suspense fallback={<div>Cargando mapa...</div>}>
        <RutaMapaContent rutaId={ruta_id} />
      </Suspense>
    </div>
  )
}


