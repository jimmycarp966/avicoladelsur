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
      {/* Header con fondo colorido */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/5 rounded-full blur-3xl -z-10"></div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Bienvenido de vuelta, {user?.nombre}. Aquí tienes un resumen de tu negocio.
        </p>
      </div>

      {/* Métricas principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-t-[3px] border-t-primary bg-primary/5 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productos</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
              <Package className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalProductos}</div>
            <p className="text-xs text-muted-foreground">
              +2.5% desde el mes pasado
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-warning bg-warning/5 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos Pendientes</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 transition-colors group-hover:bg-warning/20">
              <Clock className="h-5 w-5 text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.pedidosPendientes}</div>
            <p className="text-xs text-muted-foreground">
              Requieren atención
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-info bg-info/5 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entregas Hoy</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10 transition-colors group-hover:bg-info/20">
              <Truck className="h-5 w-5 text-info" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.entregasHoy}</div>
            <p className="text-xs text-muted-foreground">
              6 completadas, 2 pendientes
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-secondary bg-secondary/5 hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Activos</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10 transition-colors group-hover:bg-secondary/20">
              <Users className="h-5 w-5 text-secondary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.clientesActivos}</div>
            <p className="text-xs text-muted-foreground">
              +12% desde el mes pasado
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4">
          <VentasMensualesChart />
        </div>
        <div className="col-span-3">
          <ProductosPorCategoriaChart />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <EntregasPorDiaChart />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Métricas de Rendimiento</CardTitle>
            <CardDescription>
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
          <CardHeader>
            <CardTitle>Actividad Reciente</CardTitle>
            <CardDescription>
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
          <CardHeader>
            <CardTitle>Estado del Sistema</CardTitle>
            <CardDescription>
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
