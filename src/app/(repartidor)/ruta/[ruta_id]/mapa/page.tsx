import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowLeft, MapPinned } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import RutaMap from '@/components/reparto/RutaMap'
import GpsTracker from '@/components/reparto/GpsTracker'

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

  const { data: ruta, error } = await supabase
    .from('rutas_reparto')
    .select(
      `
        *,
        repartidor:usuarios(id, nombre, apellido),
        vehiculo:vehiculos(patente, marca, modelo, capacidad_kg),
        zona:zonas(nombre),
        detalles_ruta (
          id,
          orden_entrega,
          estado_entrega,
          coordenadas_entrega,
          pedido:pedidos(
            id,
            numero_pedido,
            cliente:clientes(
              id,
              nombre,
              direccion,
              coordenadas
            )
          )
        )
      `,
    )
    .eq('id', rutaId)
    .single()

  if (error || !ruta) {
    return (
      <Card className="p-6 text-center">
        <CardContent>Error al cargar la ruta</CardContent>
      </Card>
    )
  }

  if (ruta.repartidor_id !== user.id) {
    return (
      <Card className="p-6 text-center">
        <CardContent>Esta ruta no está asignada a tu usuario</CardContent>
      </Card>
    )
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

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPinned className="h-4 w-4" />
            Ruta optimizada
          </CardTitle>
          <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground md:grid-cols-4">
            <div>
              <span className="text-xs uppercase tracking-wide block">Vehículo</span>
              <p className="font-semibold text-foreground">
                {ruta.vehiculo?.patente} • {ruta.vehiculo?.marca} {ruta.vehiculo?.modelo}
              </p>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wide block">Turno</span>
              <p className="font-semibold text-foreground">
                {ruta.turno === 'mañana' ? 'Mañana' : 'Tarde'}
              </p>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wide block">Zona</span>
              <p className="font-semibold text-foreground">
                {ruta.zona?.nombre || 'Sin zona'}
              </p>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wide block">Entregas</span>
              <p className="font-semibold text-foreground">
                {ruta.detalles_ruta?.length || 0}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <RutaMap
            rutaId={ruta.id}
            entregas={ruta.detalles_ruta || []}
            showGpsTracking={puedeTrackear}
            repartidorId={ruta.repartidor_id}
            vehiculoId={ruta.vehiculo_id}
          />
        </CardContent>
      </Card>

      {puedeTrackear && (
        <GpsTracker
          repartidorId={ruta.repartidor_id}
          vehiculoId={ruta.vehiculo_id}
          rutaId={ruta.id}
        />
      )}
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
          <Link href={`/repartidor/ruta/${ruta_id}`}>
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


