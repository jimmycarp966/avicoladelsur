import { getCurrentUser } from '@/actions/auth.actions'
import { obtenerMetricasDashboardAction, obtenerActividadRecienteAction, obtenerMetricasRendimientoAction } from '@/actions/dashboard.actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/ui/stat-card'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyStateNoData } from '@/components/ui/empty-state'
import {
  VentasMensualesChart,
  ProductosPorCategoriaChart,
  EntregasPorDiaChart,
} from '@/components/charts'
import {
  Package,
  ShoppingCart,
  Truck,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Route,
  Fuel,
  LayoutDashboard
} from 'lucide-react'
import Link from 'next/link'
import { obtenerMetricasEficienciaRutasAction } from '@/actions/dashboard.actions'
import { IAWidgetsContainer } from '@/components/dashboard/IAWidgetsContainer'

export const revalidate = 30 // Revalida cada 30 segundos

export default async function AdminDashboard() {
  const user = await getCurrentUser()

  // Obtener métricas reales de la base de datos
  const [metricasResult, actividadResult, rendimientoResult, eficienciaRutasResult] = await Promise.all([
    obtenerMetricasDashboardAction(),
    obtenerActividadRecienteAction(),
    obtenerMetricasRendimientoAction(),
    obtenerMetricasEficienciaRutasAction(),
  ])

  const metrics = metricasResult.success ? metricasResult.data! : {
    totalProductos: 0,
    pedidosPendientes: 0,
    entregasHoy: { completadas: 0, pendientes: 0, total: 0 },
    clientesActivos: 0,
    crecimientoProductos: 0,
    crecimientoClientes: 0,
  }

  const recentActivity = actividadResult.success ? actividadResult.data! : []

  const rendimiento = rendimientoResult.success ? rendimientoResult.data! : {
    crecimientoVentas: 0,
    tiempoPromedioEntrega: 0,
    tasaSatisfaccion: 0,
    productosStockBajo: 0,
  }

  const eficienciaRutas = eficienciaRutasResult.success ? eficienciaRutasResult.data! : {
    distanciaAhorradaKm: 0,
    tiempoAhorradoMin: 0,
    combustibleAhorrado: 0,
    totalRutas: 0,
  }

  return (
    <div className="space-y-8">
      {/* Header con nuevo componente PageHeader */}
      <PageHeader
        title="Dashboard"
        description={`Bienvenido, ${user?.nombre}. Resumen de tu negocio.`}
        icon={LayoutDashboard}
      />

      {/* Métricas principales con StatCard */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Productos"
          value={metrics.totalProductos}
          subtitle="Total registrados"
          icon={Package}
          variant="primary"
          trend={{
            value: Number(metrics.crecimientoProductos.toFixed(1)),
            label: "desde el mes pasado"
          }}
        />

        <StatCard
          title="Pedidos Pendientes"
          value={metrics.pedidosPendientes}
          subtitle="Requieren atención"
          icon={Clock}
          variant={metrics.pedidosPendientes > 5 ? "warning" : "default"}
        />

        <StatCard
          title="Entregas Hoy"
          value={metrics.entregasHoy.total}
          subtitle={`${metrics.entregasHoy.completadas} completadas, ${metrics.entregasHoy.pendientes} pendientes`}
          icon={Truck}
          variant="info"
        />

        <StatCard
          title="Clientes Activos"
          value={metrics.clientesActivos}
          subtitle="Con pedidos recientes"
          icon={Users}
          variant="success"
          trend={{
            value: Number(metrics.crecimientoClientes.toFixed(1)),
            label: "desde el mes pasado"
          }}
        />
      </div>

      {/* Nueva tarjeta: Eficiencia de Rutas */}
      <Card className="border-t-[4px] border-t-primary hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base font-semibold text-foreground">Eficiencia de Rutas</CardTitle>
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Route className="h-6 w-6 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Ahorro esta semana:</span>
              <span className="text-lg font-bold text-green-600">
                ${eficienciaRutas.combustibleAhorrado.toFixed(0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Distancia ahorrada:</span>
              <span className="text-sm font-semibold">
                {eficienciaRutas.distanciaAhorradaKm.toFixed(0)} km
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tiempo ahorrado:</span>
              <span className="text-sm font-semibold">
                {Math.round(eficienciaRutas.tiempoAhorradoMin / 60)} horas
              </span>
            </div>
            <div className="pt-2 border-t">
              <Link href="/reparto/rutas">
                <Button variant="outline" size="sm" className="w-full">
                  Ver Detalles
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Widgets de IA - Clientes en Riesgo y Predicción de Stock */}
      <IAWidgetsContainer />

      {/* Gráficos - Responsivos */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <VentasMensualesChart />
        </div>
        <div className="lg:col-span-3">
          <ProductosPorCategoriaChart />
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <div>
          <EntregasPorDiaChart />
        </div>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-bold">Métricas de Rendimiento</CardTitle>
            <CardDescription className="text-base mt-1">
              Indicadores clave de rendimiento del mes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-success" />
                <span className="text-sm font-medium">Crecimiento de Ventas</span>
              </div>
              <Badge variant={rendimiento.crecimientoVentas >= 0 ? 'success' : 'destructive'}>
                {rendimiento.crecimientoVentas >= 0 ? '+' : ''}{rendimiento.crecimientoVentas.toFixed(1)}%
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-info" />
                <span className="text-sm font-medium">Tiempo Promedio de Entrega</span>
              </div>
              <Badge variant="info">
                {rendimiento.tiempoPromedioEntrega.toFixed(1)} horas
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Tasa de Satisfacción</span>
              </div>
              <Badge variant="default">
                {rendimiento.tasaSatisfaccion.toFixed(1)}%
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <span className="text-sm font-medium">Productos con Stock Bajo</span>
              </div>
              <Badge variant={rendimiento.productosStockBajo > 10 ? 'destructive' : 'warning'}>
                {rendimiento.productosStockBajo} producto{rendimiento.productosStockBajo !== 1 ? 's' : ''}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
        {/* Actividad reciente */}
        <Card className="lg:col-span-4">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-bold">Actividad Reciente</CardTitle>
            <CardDescription className="text-base mt-1">
              Las últimas acciones en el sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <EmptyStateNoData
                title="No hay actividad reciente"
                description="Las acciones realizadas en el sistema aparecerán aquí"
                size="sm"
              />
            ) : (
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {activity.type === 'pedido' && (
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-info/10">
                          <ShoppingCart className="h-5 w-5 text-info" />
                        </div>
                      )}
                      {activity.type === 'entrega' && (
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10">
                          <CheckCircle className="h-5 w-5 text-success" />
                        </div>
                      )}
                      {activity.type === 'stock' && (
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10">
                          <AlertTriangle className="h-5 w-5 text-warning" />
                        </div>
                      )}
                      {activity.type === 'cliente' && (
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/10">
                          <Users className="h-5 w-5 text-secondary" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {activity.message}
                      </p>
                      <p className="text-sm text-gray-500">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Estado del sistema */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-bold">Estado del Sistema</CardTitle>
            <CardDescription className="text-base mt-1">
              Componentes del ERP
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Base de Datos</span>
              </div>
              <Badge variant="success" size="sm">
                Operativo
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">API de Ventas</span>
              </div>
              <Badge variant="success" size="sm">
                Operativo
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-warning rounded-full"></div>
                <span className="text-sm font-medium">Bot WhatsApp</span>
              </div>
              <Badge variant="warning" size="sm">
                Configuración pendiente
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Sistema de Reportes</span>
              </div>
              <Badge variant="success" size="sm">
                Operativo
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
