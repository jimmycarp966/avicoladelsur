import Link from 'next/link'
import {
  CheckCircle2,
  CheckSquare,
  Clock,
  Package,
  Navigation,
} from 'lucide-react'

import { getCurrentUser } from '@/actions/auth.actions'
import { obtenerRutaActivaAction } from '@/actions/reparto.actions'
import { obtenerMetricasRepartidorAction } from '@/actions/dashboard.actions'
import { createClient } from '@/lib/supabase/server'
import { obtenerEntregasExpandidasRuta, resumirEntregasRuta } from '@/lib/reparto/entregas-normalizadas'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EficienciaRutasChart, EntregasDiariasRepartidorChart } from '@/components/charts'

export const dynamic = 'force-dynamic'

export default async function RepartidorDashboard() {
  const user = await getCurrentUser()

  if (!user) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Debes iniciar sesion para ver tu panel de rutas.
          </CardContent>
        </Card>
      </div>
    )
  }

  try {
    const supabase = await createClient()

    const [rutaActivaResponse, metricasResult] = await Promise.all([
      obtenerRutaActivaAction(user.id),
      obtenerMetricasRepartidorAction(user.id),
    ])

    const rutaActiva = rutaActivaResponse.success && rutaActivaResponse.data ? rutaActivaResponse.data : null
    const metricas = metricasResult.success && metricasResult.data
      ? metricasResult.data
      : {
        eficiencia: 0,
        puntuacionGeneral: 0,
        tiempoPromedioEntrega: 0,
        combustibleAhorrado: 0,
      }

    let entregasHoy: Array<{
      id: string
      cliente: string
      direccion: string
      estado: string
      prioridad: string
      numeroPedido: string
    }> = []

    let resumenRuta = {
      completadas: 0,
      pendientes: 0,
      total: 0,
    }

    if (rutaActiva?.ruta_id) {
      const entregasExpandidas = await obtenerEntregasExpandidasRuta(supabase, rutaActiva.ruta_id)
      const resumen = resumirEntregasRuta(entregasExpandidas)

      resumenRuta = {
        completadas: resumen.completadas,
        pendientes: resumen.pendientes,
        total: resumen.total,
      }

      entregasHoy = entregasExpandidas.map((entrega: any) => ({
        id: entrega.id,
        cliente: entrega.nombre_cliente || entrega.cliente_nombre || entrega.numero_pedido || 'Cliente',
        direccion: entrega.direccion || 'Sin direccion registrada',
        estado: entrega.estado_entrega || 'pendiente',
        prioridad: entrega.estado_entrega === 'pendiente' ? 'alta' : 'normal',
        numeroPedido: entrega.numero_pedido || 'Sin numero',
      }))
    }

    return (
      <div className="space-y-6 p-4">
        <div className="rounded-lg border border-border bg-white p-6 text-center shadow-sm">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Hola, {user.nombre}</h1>
          <p className="mt-2 text-base text-muted-foreground">Bienvenido a tu panel de repartidor</p>
        </div>

        {rutaActiva ? (
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Ruta activa</CardTitle>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {rutaActiva.estado === 'en_curso' ? 'En curso' : 'Planificada'}
                </Badge>
              </div>
              <CardDescription>Ruta #{rutaActiva.numero_ruta}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="mb-2 text-4xl font-bold text-success">{resumenRuta.completadas}</div>
                  <div className="text-sm font-medium text-muted-foreground">Completadas</div>
                </div>
                <div className="text-center">
                  <div className="mb-2 text-4xl font-bold text-warning">{resumenRuta.pendientes}</div>
                  <div className="text-sm font-medium text-muted-foreground">Pendientes</div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button asChild className="flex-1">
                  <Link href={`/ruta/${rutaActiva.ruta_id}`}>
                    <Navigation className="mr-2 h-4 w-4" />
                    Abrir ruta
                  </Link>
                </Button>
                {rutaActiva.estado === 'planificada' && !rutaActiva.checklist_inicio_id ? (
                  <Button variant="outline" asChild className="flex-1">
                    <Link href="/checkin">
                      <CheckSquare className="mr-2 h-4 w-4" />
                      Completar check-in
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" asChild className="flex-1">
                    <Link href="/entregas">
                      <Package className="mr-2 h-4 w-4" />
                      Ver entregas
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-l-4 border-l-orange-400 bg-orange-50">
            <CardContent className="p-6 text-center text-orange-800">No tienes rutas asignadas para hoy.</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-bold">Proximas entregas</CardTitle>
            <CardDescription className="mt-1 text-base">{resumenRuta.pendientes} entregas pendientes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {entregasHoy
              .filter((entrega) => entrega.estado === 'pendiente')
              .slice(0, 3)
              .map((entrega) => (
                <div key={entrega.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-medium text-gray-900">{entrega.cliente}</span>
                      <Badge variant={entrega.prioridad === 'alta' ? 'destructive' : 'secondary'} className="text-xs">
                        {entrega.prioridad}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{entrega.direccion}</p>
                    <p className="text-xs text-gray-500">Pedido {entrega.numeroPedido}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-500">Proximo</span>
                  </div>
                </div>
              ))}

            {entregasHoy.filter((entrega) => entrega.estado === 'pendiente').length === 0 && (
              <div className="py-6 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-12 w-12 text-green-500" />
                <p className="text-gray-500">Todas las entregas estan completadas.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-4">
          <Card className="border-t-[4px] border-t-info">
            <CardContent className="p-4 text-center">
              <div className="mb-1 text-2xl font-bold text-info">
                {rutaActiva ? `${rutaActiva.distancia_estimada_km || '--'} km` : '--'}
              </div>
              <div className="text-[10px] font-medium uppercase text-muted-foreground">Distancia</div>
            </CardContent>
          </Card>

          <Card className="border-t-[4px] border-t-success">
            <CardContent className="p-4 text-center">
              <div className="mb-1 text-base font-bold leading-tight text-success">
                {rutaActiva?.estado === 'en_curso' ? 'En curso' : rutaActiva ? 'Lista' : '--'}
              </div>
              <div className="text-[10px] font-medium uppercase text-muted-foreground">Estado</div>
            </CardContent>
          </Card>

          <Card className="border-t-[4px] border-t-warning">
            <CardContent className="p-4 text-center">
              <div className="mb-1 text-2xl font-bold text-warning">{metricas.eficiencia}%</div>
              <div className="text-[10px] font-medium uppercase text-muted-foreground">Eficiencia</div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-bold text-foreground">Mi rendimiento</h2>
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            <EntregasDiariasRepartidorChart />
            <EficienciaRutasChart />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-t-[4px] border-t-success">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base font-semibold text-foreground">Puntuacion general</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-2 text-4xl font-bold text-success">{metricas.puntuacionGeneral.toFixed(1)}/10</div>
                <p className="text-sm font-medium text-muted-foreground">Basado en entregas y eficiencia</p>
              </CardContent>
            </Card>

            <Card className="border-t-[4px] border-t-info">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base font-semibold text-foreground">Tiempo promedio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-2 text-4xl font-bold text-info">{metricas.tiempoPromedioEntrega || 0} min</div>
                <p className="text-sm font-medium text-muted-foreground">Por entrega completada</p>
              </CardContent>
            </Card>

            <Card className="border-t-[4px] border-t-success">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base font-semibold text-foreground">Combustible ahorrado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-2 text-4xl font-bold text-success">{metricas.combustibleAhorrado || 0}%</div>
                <p className="text-sm font-medium text-muted-foreground">Vs rutas no optimizadas</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  } catch (error) {
    console.error('[DASHBOARD ERROR]:', error)
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">Error en el sistema</CardTitle>
            <CardDescription>No se pudo cargar el panel de repartidor</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-red-700">
              Ocurrio un error inesperado al procesar los datos de tu ruta.
            </p>
            <Button asChild variant="destructive">
              <Link href="/home">Volver a intentar</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
}
