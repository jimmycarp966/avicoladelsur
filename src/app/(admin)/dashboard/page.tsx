import { getCurrentUser } from '@/actions/auth.actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  Clock
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const user = await getCurrentUser()

  // Métricas de ejemplo (en producción vendrían de la base de datos)
  const metrics = {
    totalProductos: 245,
    pedidosPendientes: 12,
    entregasHoy: 8,
    clientesActivos: 89,
  }

  const recentActivity = [
    { id: 1, type: 'pedido', message: 'Nuevo pedido #PED-001', time: '5 min ago' },
    { id: 2, type: 'entrega', message: 'Entrega completada #PED-045', time: '12 min ago' },
    { id: 3, type: 'stock', message: 'Producto "Pollo Entero" bajo en stock', time: '1 hour ago' },
    { id: 4, type: 'cliente', message: 'Nuevo cliente registrado', time: '2 hours ago' },
  ]

  return (
    <div className="space-y-8">
      {/* Header de bienvenida - Estilo profesional */}
      <div className="bg-white rounded-lg border border-border p-6 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          Bienvenido de vuelta, <span className="font-semibold text-primary">{user?.nombre}</span>. Aquí tienes un resumen de tu negocio.
        </p>
      </div>

      {/* Métricas principales */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-t-[4px] border-t-primary hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Productos</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Package className="h-6 w-6 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary mb-2">{metrics.totalProductos}</div>
            <p className="text-sm text-muted-foreground font-medium">
              +2.5% desde el mes pasado
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[4px] border-t-warning hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Pedidos Pendientes</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10">
              <Clock className="h-6 w-6 text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-warning mb-2">{metrics.pedidosPendientes}</div>
            <p className="text-sm text-muted-foreground font-medium">
              Requieren atención
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[4px] border-t-info hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Entregas Hoy</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-info/10">
              <Truck className="h-6 w-6 text-info" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-info mb-2">{metrics.entregasHoy}</div>
            <p className="text-sm text-muted-foreground font-medium">
              6 completadas, 2 pendientes
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[4px] border-t-secondary hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Clientes Activos</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/10">
              <Users className="h-6 w-6 text-secondary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-secondary mb-2">{metrics.clientesActivos}</div>
            <p className="text-sm text-muted-foreground font-medium">
              +12% desde el mes pasado
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
        <div className="col-span-4">
          <VentasMensualesChart />
        </div>
        <div className="col-span-3">
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
              <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
                +15.3%
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-info" />
                <span className="text-sm font-medium">Tiempo Promedio de Entrega</span>
              </div>
              <Badge variant="secondary" className="bg-info/10 text-info border-info/20">
                2.3 horas
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Tasa de Satisfacción</span>
              </div>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                94.2%
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <span className="text-sm font-medium">Productos con Stock Bajo</span>
              </div>
              <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">
                5 productos
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Actividad reciente */}
        <Card className="col-span-4">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-bold">Actividad Reciente</CardTitle>
            <CardDescription className="text-base mt-1">
              Las últimas acciones en el sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* Estado del sistema */}
        <Card className="col-span-3">
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
              <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
                Operativo
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">API de Ventas</span>
              </div>
              <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
                Operativo
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-warning rounded-full"></div>
                <span className="text-sm font-medium">Bot WhatsApp</span>
              </div>
              <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">
                Configuración pendiente
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Sistema de Reportes</span>
              </div>
              <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
                Operativo
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
