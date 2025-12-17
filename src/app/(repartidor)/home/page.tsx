import { getCurrentUser } from '@/actions/auth.actions'
import { obtenerRutaActivaAction } from '@/actions/reparto.actions'
import { obtenerMetricasRepartidorAction } from '@/actions/dashboard.actions'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EntregasDiariasRepartidorChart, EficienciaRutasChart } from '@/components/charts'
import Link from 'next/link'
import {
  MapPin,
  Truck,
  CheckSquare,
  Clock,
  Navigation,
  Package,
  AlertCircle,
  CheckCircle2
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function RepartidorDashboard() {
  const user = await getCurrentUser()

  if (!user) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Debes iniciar sesión para ver tu panel de rutas.
          </CardContent>
        </Card>
      </div>
    )
  }

  try {
    const supabase = await createClient()

    // Cargar datos en paralelo para un mejor rendimiento y menor riesgo de timeout
    const [rutaActivaResponse, metricasResult] = await Promise.all([
      obtenerRutaActivaAction(user.id),
      obtenerMetricasRepartidorAction(user.id)
    ])

    const rutaActiva = rutaActivaResponse.success && rutaActivaResponse.data ? rutaActivaResponse.data : null

    // Métricas con fallback seguro
    const metricas = metricasResult.success && metricasResult.data ? metricasResult.data : {
      eficiencia: 0,
      puntuacionGeneral: 0,
      tiempoPromedioEntrega: 0,
      combustibleAhorrado: 0,
    }

    let entregasHoy: Array<{
      id: string
      virtual_id?: string
      cliente: string
      direccion: string
      estado: string
      productos: string[]
      prioridad: string
    }> = []
    let entregasPendientes = 0
    let entregasCompletadas = 0
    let totalEntregas = 0

    if (rutaActiva?.ruta_id) {
      // Obtener detalles de la ruta con información de pedidos y clientes
      const { data: detalles, error: detallesError } = await supabase
        .from('detalles_ruta')
        .select(`
          id,
          pedido_id,
          orden_entrega,
          estado_entrega,
          pedido:pedidos(
            id,
            numero_pedido,
            total,
            cliente:clientes(id, nombre, direccion)
          )
        `)
        .eq('ruta_id', rutaActiva.ruta_id)
        .order('orden_entrega', { ascending: true })

      if (detallesError) {
        console.error('❌ [DASHBOARD ERROR] Error al obtener detalles:', detallesError)
      }

      if (detalles && detalles.length > 0) {
        try {
          // Expandir detalles para pedidos agrupados de forma robusta
          const detallesExpandidos = await Promise.all(
            detalles.map(async (det: any) => {
              try {
                // El join puede devolver un objeto o un array de un solo elemento
                const pedido = Array.isArray(det.pedido) ? det.pedido[0] : det.pedido
                const cliente = Array.isArray(pedido?.cliente) ? pedido?.cliente[0] : pedido?.cliente

                // Si no hay cliente directo, es un pedido agrupado (entregas múltiples)
                if (!cliente && (det.pedido_id || pedido?.id)) {
                  const pedidoId = det.pedido_id || pedido?.id

                  const { data: entregas, error: entregasError } = await supabase
                    .from('entregas')
                    .select(`
                      id,
                      estado_entrega,
                      cliente:clientes(id, nombre, direccion)
                    `)
                    .eq('pedido_id', pedidoId)
                    .order('orden_entrega', { ascending: true })

                  if (!entregasError && entregas && entregas.length > 0) {
                    return entregas.map((entrega: any) => {
                      const clienteInd = Array.isArray(entrega.cliente) ? entrega.cliente[0] : entrega.cliente
                      return {
                        ...det,
                        id: det.id,
                        virtual_id: entrega.id,
                        estado_entrega: entrega.estado_entrega || det.estado_entrega,
                        pedido: {
                          ...(pedido || {}),
                          cliente: clienteInd
                        }
                      }
                    })
                  }
                }

                // Caso normal: un solo cliente
                return [{
                  ...det,
                  pedido: {
                    ...(pedido || {}),
                    cliente: cliente
                  }
                }]
              } catch (e) {
                console.error('❌ [DASHBOARD ERROR] Error expandiendo detalle:', det.id, e)
                return [det]
              }
            })
          )

          const flatDetalles = detallesExpandidos.flat().filter(Boolean)

          totalEntregas = flatDetalles.length
          entregasCompletadas = flatDetalles.filter(det => det && det.estado_entrega === 'entregado').length
          entregasPendientes = totalEntregas - entregasCompletadas

          // Mapear al formato de la UI con total seguridad
          entregasHoy = flatDetalles.map(det => {
            if (!det) return null
            const pedido = det.pedido
            const cliente = pedido?.cliente

            return {
              id: det.virtual_id || det.id,
              cliente: cliente?.nombre || pedido?.numero_pedido || `Pedido #${(det.pedido_id || '').substring(0, 8) || '?'}`,
              direccion: cliente?.direccion || 'Sin dirección registrada',
              estado: det.estado_entrega || 'pendiente',
              productos: pedido?.numero_pedido ? [`Pedido ${pedido.numero_pedido}`] : [],
              prioridad: det.estado_entrega === 'pendiente' ? 'alta' : 'normal',
            }
          }).filter((e): e is NonNullable<typeof e> => e !== null)
        } catch (expansionError) {
          console.error('❌ [DASHBOARD ERROR] Error crítico en expansión:', expansionError)
        }
      }
    }

    return (
      <div className="space-y-6 p-4">
        {/* Header */}
        <div className="bg-white rounded-lg border border-border p-6 shadow-sm text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            ¡Hola, {user?.nombre}!
          </h1>
          <p className="text-muted-foreground mt-2 text-base">
            Bienvenido a tu panel de repartidor
          </p>
        </div>

        {/* Ruta activa */}
        {rutaActiva ? (
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Ruta Activa</CardTitle>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {rutaActiva.estado === 'en_curso' ? 'En Curso' : 'Planificada'}
                </Badge>
              </div>
              <CardDescription>
                Ruta #{rutaActiva.numero_ruta}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-4xl font-bold text-success mb-2">{entregasCompletadas}</div>
                  <div className="text-sm text-muted-foreground font-medium">Completadas</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-warning mb-2">{entregasPendientes}</div>
                  <div className="text-sm text-muted-foreground font-medium">Pendientes</div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button asChild className="flex-1">
                  <Link href={`/ruta/${rutaActiva.ruta_id}`}>
                    <Navigation className="mr-2 h-4 w-4" />
                    Ver Ruta
                  </Link>
                </Button>
                <Button variant="outline" asChild className="flex-1">
                  <Link href={`/ruta/${rutaActiva.ruta_id}`}>
                    <CheckSquare className="mr-2 h-4 w-4" />
                    Check-in
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-l-4 border-l-orange-400 bg-orange-50">
            <CardContent className="p-6 text-center text-orange-800">
              No tienes rutas asignadas para hoy.
            </CardContent>
          </Card>
        )}

        {/* Acciones rápidas */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4 text-center">
              <MapPin className="h-8 w-8 text-blue-500 mx-auto mb-2" />
              <h3 className="font-medium text-gray-900">Navegación GPS</h3>
              <p className="text-sm text-gray-500">Ir a siguiente entrega</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4 text-center">
              <Package className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <h3 className="font-medium text-gray-900">Entregas</h3>
              <p className="text-sm text-gray-500">Gestionar entregas</p>
            </CardContent>
          </Card>
        </div>

        {/* Próximas entregas */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-bold">Próximas Entregas</CardTitle>
            <CardDescription className="text-base mt-1">
              {entregasPendientes} entregas pendientes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {entregasHoy
              .filter(entrega => entrega.estado === 'pendiente')
              .slice(0, 3)
              .map((entrega) => (
                <div key={entrega.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">
                        {entrega.cliente}
                      </span>
                      <Badge
                        variant={entrega.prioridad === 'alta' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {entrega.prioridad}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{entrega.direccion}</p>
                    <p className="text-xs text-gray-500">
                      {entrega.productos.join(', ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-500">Próximo</span>
                  </div>
                </div>
              ))}

            {entregasHoy.filter(e => e.estado === 'pendiente').length === 0 && (
              <div className="text-center py-6">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
                <p className="text-gray-500">¡Todas las entregas completadas!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Estadísticas rápidas - Fila inferior */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-t-[4px] border-t-info">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-info mb-1">
                {rutaActiva ? `${rutaActiva?.distancia_estimada_km || '--'} km` : '--'}
              </div>
              <div className="text-[10px] text-muted-foreground font-medium uppercase">Distancia</div>
            </CardContent>
          </Card>

          <Card className="border-t-[4px] border-t-success">
            <CardContent className="p-4 text-center">
              <div className="text-base font-bold text-success mb-1 leading-tight">
                {rutaActiva?.estado === 'en_curso' ? 'En curso' : (rutaActiva ? 'Lista' : '--')}
              </div>
              <div className="text-[10px] text-muted-foreground font-medium uppercase">Estado</div>
            </CardContent>
          </Card>

          <Card className="border-t-[4px] border-t-warning">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-warning mb-1">
                {metricas.eficiencia}%
              </div>
              <div className="text-[10px] text-muted-foreground font-medium uppercase">Eficiencia</div>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos de rendimiento */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-foreground">Mi Rendimiento</h2>

          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            <EntregasDiariasRepartidorChart />
            <EficienciaRutasChart />
          </div>

          {/* Tarjetas de métricas detalladas */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-t-[4px] border-t-success">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base font-semibold text-foreground">Puntuación General</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-success mb-2">{(metricas.puntuacionGeneral || 0).toFixed(1)}/10</div>
                <p className="text-sm text-muted-foreground font-medium">
                  Basado en entregas y eficiencia
                </p>
              </CardContent>
            </Card>

            <Card className="border-t-[4px] border-t-info">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base font-semibold text-foreground">Tiempo Promedio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-info mb-2">{metricas.tiempoPromedioEntrega || 0} min</div>
                <p className="text-sm text-muted-foreground font-medium">
                  Por entrega completada
                </p>
              </CardContent>
            </Card>

            <Card className="border-t-[4px] border-t-success">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base font-semibold text-foreground">Combustible Ahorrado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-success mb-2">{metricas.combustibleAhorrado || 0}%</div>
                <p className="text-sm text-muted-foreground font-medium">
                  Vs rutas no optimizadas
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  } catch (error) {
    console.error('❌ [DASHBOARD CRITICAL ERROR]:', error)
    return (
      <div className="p-6">
        <Card className="bg-red-50 border-red-200">
          <CardHeader>
            <CardTitle className="text-red-800">Error en el sistema</CardTitle>
            <CardDescription>No se pudo cargar el panel de repartidor</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-red-700">
              Ocurrió un error inesperado al procesar los datos de tu ruta. Por favor, intenta recargar la página.
            </p>
            <Button onClick={() => window.location.reload()} variant="destructive">
              Recargar página
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }
}
