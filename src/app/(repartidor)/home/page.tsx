import { getCurrentUser } from '@/actions/auth.actions'
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

  // Datos de ejemplo (en producción vendrían de la base de datos)
  const rutaActiva = {
    numero: 'RUT-001',
    estado: 'en_curso',
    entregasTotal: 8,
    entregasCompletadas: 3,
    entregasPendientes: 5,
    distanciaEstimada: 45.2,
    tiempoEstimado: '2h 30min',
  }

  const entregasHoy = [
    {
      id: 'PED-001',
      cliente: 'Supermercado Central',
      direccion: 'Av. Principal 123',
      estado: 'pendiente',
      productos: ['Pollo Entero', 'Huevos'],
      prioridad: 'alta',
    },
    {
      id: 'PED-002',
      cliente: 'Tienda Familiar',
      direccion: 'Calle Secundaria 456',
      estado: 'completada',
      productos: ['Pechuga de Pollo'],
      prioridad: 'normal',
    },
  ]

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          ¡Hola, {user?.nombre}!
        </h1>
        <p className="text-gray-600 mt-1">
          Bienvenido a tu panel de repartidor
        </p>
      </div>

      {/* Ruta activa */}
      {rutaActiva && (
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Ruta Activa</CardTitle>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {rutaActiva.estado === 'en_curso' ? 'En Curso' : 'Planificada'}
              </Badge>
            </div>
            <CardDescription>
              Ruta #{rutaActiva.numero}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {rutaActiva.entregasCompletadas}
                </div>
                <div className="text-sm text-gray-500">Completadas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {rutaActiva.entregasPendientes}
                </div>
                <div className="text-sm text-gray-500">Pendientes</div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button asChild className="flex-1">
                <Link href="/repartidor/ruta-diaria">
                  <Navigation className="mr-2 h-4 w-4" />
                  Ver Ruta
                </Link>
              </Button>
              <Button variant="outline" asChild className="flex-1">
                <Link href="/repartidor/checkin">
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Check-in
                </Link>
              </Button>
            </div>
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
        <CardHeader>
          <CardTitle className="text-lg">Próximas Entregas</CardTitle>
          <CardDescription>
            {rutaActiva?.entregasPendientes} entregas pendientes
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
                  <span className="text-sm text-gray-500">15 min</span>
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

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-blue-600">
              {rutaActiva?.distanciaEstimada}km
            </div>
            <div className="text-xs text-gray-500">Distancia</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-green-600">
              {rutaActiva?.tiempoEstimado}
            </div>
            <div className="text-xs text-gray-500">Tiempo</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-orange-600">
              85%
            </div>
            <div className="text-xs text-gray-500">Eficiencia</div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos de rendimiento */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">Mi Rendimiento</h2>

        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          <EntregasDiariasRepartidorChart />
          <EficienciaRutasChart />
        </div>

        {/* Estadísticas adicionales */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Puntuación General</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">9.2/10</div>
              <p className="text-xs text-muted-foreground">
                Basado en entregas y eficiencia
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tiempo Promedio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">24 min</div>
              <p className="text-xs text-muted-foreground">
                Por entrega completada
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Combustible Ahorrado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">12%</div>
              <p className="text-xs text-muted-foreground">
                Vs rutas no optimizadas
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
