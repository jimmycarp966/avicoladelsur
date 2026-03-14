import { Suspense } from 'react'
import Link from 'next/link'
import { CheckCircle, Clock, DollarSign, FileText, MapPin, Truck } from 'lucide-react'

import { getCurrentUser } from '@/actions/auth.actions'
import { createClient } from '@/lib/supabase/server'
import { obtenerEntregasExpandidasPorRutaIds, resumirEntregasRuta } from '@/lib/reparto/entregas-normalizadas'
import {
  esEntregaTerminal,
  getEstadoPagoBadgeVariant,
  getEstadoPagoLabel,
  sumarMontoPorCobrar,
} from '@/lib/utils/estado-pago'
import { RepartoSkeleton } from './reparto-skeleton'
import { FiltrosClient } from './filtros-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RemitoEntregaButton } from '@/components/repartidor/RemitoEntregaButton'

export const dynamic = 'force-dynamic'

async function RepartoContent({ searchParams }: { searchParams: { fecha?: string; turno?: string } }) {
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) return <div>No autorizado</div>

  const fechaFiltro = searchParams.fecha || undefined
  const turnoFiltro = searchParams.turno || undefined

  let query = supabase
    .from('rutas_reparto')
    .select(`
      *,
      vehiculo:vehiculos(patente, marca, modelo),
      zona:zonas(nombre)
    `)
    .eq('repartidor_id', user.id)
    .order('fecha_ruta', { ascending: false })
    .limit(20)

  if (fechaFiltro) {
    query = query.eq('fecha_ruta', fechaFiltro)
  }

  const { data: rutas, error: rutasError } = await query

  if (rutasError) {
    console.error('Error obteniendo rutas:', rutasError)
  }

  const rutasFiltradas = turnoFiltro
    ? (rutas || []).filter((ruta: any) => ruta.turno === turnoFiltro)
    : (rutas || [])

  const rutasActivas = rutasFiltradas.filter((ruta: any) =>
    ['planificada', 'en_curso', 'completada'].includes(ruta.estado),
  )

  const rutasPorId = Object.fromEntries(rutasActivas.map((ruta: any) => [ruta.id, ruta]))
  const rutaIds = rutasActivas.map((ruta: any) => ruta.id)

  const entregasPorRutaId = rutaIds.length > 0
    ? await obtenerEntregasExpandidasPorRutaIds(supabase, rutaIds)
    : {}

  const entregas = Object.entries(entregasPorRutaId).flatMap(([rutaId, lista]) =>
    (lista || []).map((entrega: any) => ({
      ...entrega,
      ruta_id: entrega.ruta_id || rutaId,
      ruta: rutasPorId[rutaId],
    })),
  )

  const totalEntregas = entregas.length
  const entregasCompletadas = entregas.filter((entrega) => esEntregaTerminal(entrega)).length
  const totalCobrar = sumarMontoPorCobrar(entregas)

  return (
    <div className="space-y-6 pb-20">
      <div className="border-b bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Reparto del dia</h1>
            <p className="text-muted-foreground">
              {fechaFiltro
                ? new Date(fechaFiltro).toLocaleDateString('es-AR', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
                : 'Todas las fechas'}
            </p>
          </div>
          {rutasActivas.length > 0 && (
            <Badge variant="outline" className="bg-blue-50">
              <Truck className="mr-1 h-3 w-3" />
              {rutasActivas.length} {rutasActivas.length === 1 ? 'Ruta activa' : 'Rutas activas'}
            </Badge>
          )}
        </div>
      </div>

      <div className="px-4">
        <FiltrosClient />
      </div>

      <div className="grid grid-cols-3 gap-4 px-4">
        <Card className="text-center">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{totalEntregas}</div>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{entregasCompletadas}</div>
            <p className="text-xs text-muted-foreground">Completadas</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">${totalCobrar.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Por cobrar</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6 px-4">
        {rutasActivas.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Truck className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="text-lg font-medium">No hay rutas activas</h3>
              <p className="text-muted-foreground">No hay entregas para los filtros aplicados.</p>
            </CardContent>
          </Card>
        ) : (
          rutasActivas.map((ruta: any) => {
            const entregasRuta = entregasPorRutaId[ruta.id] || []
            const resumen = resumirEntregasRuta(entregasRuta)

            return (
              <div key={ruta.id} className="space-y-3">
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{ruta.numero_ruta}</CardTitle>
                        <CardDescription>
                          {ruta.vehiculo?.patente || 'Sin vehiculo'} - {ruta.turno === 'mañana' ? 'Manana' : 'Tarde'}
                        </CardDescription>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/ruta/${ruta.id}`}>
                          <MapPin className="mr-2 h-4 w-4" />
                          Ver hoja de ruta
                        </Link>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm">
                      <span>
                        {resumen.completadas} / {resumen.total} entregas
                      </span>
                      <Badge variant={ruta.estado === 'en_curso' ? 'default' : 'secondary'}>
                        {ruta.estado === 'en_curso' ? 'En curso' : 'Planificada'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {entregasRuta.map((entrega: any) => (
                  <Card key={entrega.id} className="transition-shadow hover:shadow-md">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">#{entrega.orden_entrega || '-'}</Badge>
                          <span className="font-semibold">{entrega.numero_pedido || 'Pedido'}</span>
                          <Badge variant={getEstadoPagoBadgeVariant(entrega)} className="text-xs">
                            {getEstadoPagoLabel(entrega)}
                          </Badge>
                        </div>
                        <Badge variant={esEntregaTerminal(entrega) ? 'default' : 'secondary'} className="text-xs">
                          {esEntregaTerminal(entrega) ? 'Resuelta' : 'Pendiente'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-medium">{entrega.nombre_cliente || 'Cliente'}</h4>
                          <p className="text-sm text-muted-foreground">{entrega.direccion || 'Direccion no disponible'}</p>
                          {entrega.telefono && <p className="text-sm text-muted-foreground">{entrega.telefono}</p>}
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4" />${Number(entrega.total || 0).toFixed(2)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              Orden {entrega.orden_entrega || '-'}
                            </span>
                          </div>
                        </div>

                        {entrega.instrucciones_repartidor && (
                          <div className="rounded-md bg-yellow-50 p-3">
                            <p className="text-sm">
                              <FileText className="mr-1 inline h-4 w-4" />
                              {entrega.instrucciones_repartidor}
                            </p>
                          </div>
                        )}

                        <div className="flex gap-2 pt-2">
                          <Button variant="outline" size="sm" className="flex-1" asChild>
                            <Link href={`/ruta/${ruta.id}/entrega/${entrega.id}`}>
                              <MapPin className="mr-2 h-4 w-4" />
                              Gestionar
                            </Link>
                          </Button>
                          {!esEntregaTerminal(entrega) ? (
                            <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" asChild>
                              <Link href={`/ruta/${ruta.id}`}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Ir a ruta
                              </Link>
                            </Button>
                          ) : (
                            <div className="flex-1">
                              <RemitoEntregaButton entregaId={entrega.id} />
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default async function RepartoPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; turno?: string }>
}) {
  const resolvedParams = await searchParams

  return (
    <Suspense fallback={<RepartoSkeleton />}>
      <RepartoContent searchParams={resolvedParams} />
    </Suspense>
  )
}
