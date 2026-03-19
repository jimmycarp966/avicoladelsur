import Link from 'next/link'
import { AlertCircle, CheckCircle, Clock, MapPin, Package, Truck } from 'lucide-react'

import { getCurrentUser } from '@/actions/auth.actions'
import { createClient } from '@/lib/supabase/server'
import { obtenerEntregasExpandidasPorRutaIds, resumirEntregasRuta } from '@/lib/reparto/entregas-normalizadas'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export default async function RutaDiariaPage() {
  const user = await getCurrentUser()
  const supabase = await createClient()

  if (!user) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Debes iniciar sesion para ver tus rutas.
          </CardContent>
        </Card>
      </div>
    )
  }

  const { data: rutas, error: rutasError } = await supabase
    .from('rutas_reparto')
    .select(`
      *,
      vehiculo:vehiculos(patente, marca, modelo),
      zona:zonas(nombre)
    `)
    .eq('repartidor_id', user.id)
    .order('fecha_ruta', { ascending: false })
    .limit(20)

  if (rutasError) {
    console.error('Error obteniendo rutas:', rutasError)
  }

  const rutaIds = (rutas || []).map((ruta: any) => ruta.id)
  const entregasPorRutaId = rutaIds.length > 0
    ? await obtenerEntregasExpandidasPorRutaIds(supabase, rutaIds)
    : {}

  const rutasConResumen = (rutas || []).map((ruta: any) => {
    const resumen = resumirEntregasRuta(entregasPorRutaId[ruta.id] || [])
    return {
      ...ruta,
      totalEntregas: resumen.total,
      entregasCompletadas: resumen.completadas,
      entregasPendientes: resumen.pendientes,
    }
  })

  return (
    <div className="space-y-6 p-4 pb-20">
      <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Rutas del día</h1>
        <p className="mt-2 text-muted-foreground">Todas las rutas asignadas para hoy</p>
      </div>

      {rutasConResumen.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Truck className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-medium">No hay rutas asignadas</h3>
            <p className="text-muted-foreground">No tienes rutas asignadas. Esperando asignacion por el administrador.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rutasConResumen.map((ruta: any) => {
            const estadoBadgeMap: Record<string, { variant: 'secondary' | 'default' | 'outline'; label: string; icon: typeof Clock }> = {
              planificada: { variant: 'secondary', label: 'Planificada', icon: Clock },
              en_curso: { variant: 'default', label: 'En curso', icon: MapPin },
              completada: { variant: 'outline', label: 'Completada', icon: CheckCircle },
            }

            const estadoBadge = estadoBadgeMap[ruta.estado as string] || {
              variant: 'secondary' as const,
              label: ruta.estado,
              icon: AlertCircle,
            }
            const EstadoIcon = estadoBadge.icon

            return (
              <Card key={ruta.id} className="transition-shadow hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{ruta.numero_ruta}</CardTitle>
                      <CardDescription>
                        {ruta.vehiculo?.patente || 'Sin vehiculo'} - {ruta.turno === 'mañana' ? 'Manana' : 'Tarde'}
                        {ruta.zona?.nombre && ` - ${ruta.zona.nombre}`}
                      </CardDescription>
                    </div>
                    <Badge variant={estadoBadge.variant} className="flex items-center gap-1">
                      <EstadoIcon className="h-3 w-3" />
                      {estadoBadge.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{ruta.totalEntregas}</div>
                        <p className="text-xs text-muted-foreground">Total</p>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{ruta.entregasCompletadas}</div>
                        <p className="text-xs text-muted-foreground">Completadas</p>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">{ruta.entregasPendientes}</div>
                        <p className="text-xs text-muted-foreground">Pendientes</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Package className="h-4 w-4" />
                        <span>{ruta.totalEntregas} entregas</span>
                      </div>
                      {ruta.distancia_estimada_km && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          <span>{ruta.distancia_estimada_km} km</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button asChild className="flex-1">
                        <Link href={`/ruta/${ruta.id}`}>
                          <MapPin className="mr-2 h-4 w-4" />
                          Abrir ruta
                        </Link>
                      </Button>
                      {ruta.estado === 'planificada' && !ruta.checklist_inicio_id && (
                        <Button variant="outline" asChild className="flex-1">
                          <Link href="/checkin">
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Completar check-in
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
