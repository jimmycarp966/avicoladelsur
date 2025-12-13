import { getCurrentUser } from '@/actions/auth.actions'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Truck, MapPin, Clock, Package, CheckCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function RutaDiariaPage() {
  const user = await getCurrentUser()
  const supabase = await createClient()

  if (!user) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Debes iniciar sesión para ver tus rutas.
          </CardContent>
        </Card>
      </div>
    )
  }

  // Obtener todas las rutas asignadas al repartidor directamente por repartidor_id
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

  // Obtener detalles de entregas para cada ruta
  const rutasConDetalles = await Promise.all(
    (rutas || []).map(async (ruta: any) => {
      const { data: detalles } = await supabase
        .from('detalles_ruta')
        .select(`
          id,
          estado_entrega,
          pedido:pedidos(
            numero_pedido,
            cliente:clientes(nombre)
          )
        `)
        .eq('ruta_id', ruta.id)

      const totalEntregas = detalles?.length || 0
      const entregasCompletadas = detalles?.filter((d: any) => d.estado_entrega === 'entregado').length || 0
      const entregasPendientes = totalEntregas - entregasCompletadas

      return {
        ...ruta,
        totalEntregas,
        entregasCompletadas,
        entregasPendientes,
      }
    })
  )

  return (
    <div className="space-y-6 p-4 pb-20">
      <div className="bg-white rounded-lg border border-border p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Rutas
        </h1>
        <p className="text-muted-foreground mt-2">
          Todas las rutas asignadas
        </p>
      </div>

      {rutasConDetalles.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Truck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No hay rutas asignadas</h3>
            <p className="text-muted-foreground">
              No tienes rutas asignadas. Esperando asignación por el administrador.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rutasConDetalles.map((ruta: any) => {
            const estadoBadgeMap: Record<string, { variant: 'secondary' | 'default' | 'outline', label: string, icon: typeof Clock }> = {
              planificada: { variant: 'secondary' as const, label: 'Planificada', icon: Clock },
              en_curso: { variant: 'default' as const, label: 'En Curso', icon: MapPin },
              completada: { variant: 'outline' as const, label: 'Completada', icon: CheckCircle },
            }
            const estadoBadge = estadoBadgeMap[ruta.estado as string] || { variant: 'secondary' as const, label: ruta.estado, icon: AlertCircle }

            const EstadoIcon = estadoBadge.icon

            return (
              <Card key={ruta.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{ruta.numero_ruta}</CardTitle>
                      <CardDescription>
                        {ruta.vehiculo?.patente} • {ruta.turno === 'mañana' ? '🌅 Mañana' : '🌆 Tarde'}
                        {ruta.zona?.nombre && ` • ${ruta.zona.nombre}`}
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
                    {/* Estadísticas */}
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

                    {/* Información adicional */}
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

                    {/* Acciones */}
                    <div className="flex gap-2 pt-2">
                      <Button asChild className="flex-1">
                        <Link href={`/ruta/${ruta.id}`}>
                          <MapPin className="mr-2 h-4 w-4" />
                          Ver Ruta
                        </Link>
                      </Button>
                      {ruta.estado === 'planificada' && !ruta.checklist_inicio_id && (
                        <Button variant="outline" asChild className="flex-1">
                          <Link href="/checkin">
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Check-in
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




