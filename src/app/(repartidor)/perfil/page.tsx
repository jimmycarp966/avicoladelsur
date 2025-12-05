import { getCurrentUser } from '@/actions/auth.actions'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  User, 
  Mail, 
  Phone, 
  Truck, 
  Package, 
  CheckCircle, 
  Clock, 
  MapPin,
  TrendingUp,
  Award
} from 'lucide-react'
import { EntregasDiariasRepartidorChart, EficienciaRutasChart } from '@/components/charts'
import { getTodayArgentina } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function PerfilPage() {
  const user = await getCurrentUser()
  const supabase = await createClient()

  if (!user) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Debes iniciar sesión para ver tu perfil.
          </CardContent>
        </Card>
      </div>
    )
  }

  // Obtener información completa del usuario
  const { data: usuario, error: usuarioError } = await supabase
    .from('usuarios')
    .select(`
      *,
      vehiculo:vehiculos(id, patente, marca, modelo, capacidad_kg)
    `)
    .eq('id', user.id)
    .single()

  if (usuarioError || !usuario) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              Error al cargar información del usuario
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Calcular estadísticas del repartidor
  const fechaHoy = getTodayArgentina()
  const fechaHace30Dias = new Date(fechaHoy)
  fechaHace30Dias.setDate(fechaHace30Dias.getDate() - 30)

  // Obtener rutas completadas en los últimos 30 días
  const { data: rutas, error: rutasError } = await supabase
    .from('rutas_reparto')
    .select(`
      id,
      estado,
      fecha_ruta,
      tiempo_real_min,
      distancia_real_km,
      detalles_ruta(
        id,
        estado_entrega
      )
    `)
    .eq('repartidor_id', user.id)
    .gte('fecha_ruta', fechaHace30Dias.toISOString().split('T')[0])
    .order('fecha_ruta', { ascending: false })

  // Calcular estadísticas
  const rutasCompletadas = rutas?.filter(r => r.estado === 'completada').length || 0
  const rutasEnCurso = rutas?.filter(r => r.estado === 'en_curso').length || 0
  const totalEntregas = rutas?.reduce((sum, r) => {
    const entregas = Array.isArray(r.detalles_ruta) ? r.detalles_ruta : []
    return sum + entregas.length
  }, 0) || 0
  const entregasCompletadas = rutas?.reduce((sum, r) => {
    const entregas = Array.isArray(r.detalles_ruta) ? r.detalles_ruta : []
    return sum + entregas.filter((d: any) => d.estado_entrega === 'entregado').length
  }, 0) || 0
  const kmTotales = rutas?.reduce((sum, r) => sum + Number(r.distancia_real_km || 0), 0) || 0
  const tiempoTotalMin = rutas?.reduce((sum, r) => sum + (r.tiempo_real_min || 0), 0) || 0
  const tiempoPromedioEntrega = totalEntregas > 0 ? tiempoTotalMin / totalEntregas : 0
  const eficiencia = totalEntregas > 0 ? (entregasCompletadas / totalEntregas) * 100 : 0

  // Obtener rutas de la última semana para el gráfico
  const fechaHace7Dias = new Date(fechaHoy)
  fechaHace7Dias.setDate(fechaHace7Dias.getDate() - 7)

  const { data: rutasSemana } = await supabase
    .from('rutas_reparto')
    .select(`
      fecha_ruta,
      detalles_ruta(estado_entrega),
      tiempo_real_min
    `)
    .eq('repartidor_id', user.id)
    .gte('fecha_ruta', fechaHace7Dias.toISOString().split('T')[0])
    .order('fecha_ruta', { ascending: true })

  return (
    <div className="space-y-6 p-4 pb-20">
      {/* Header */}
      <div className="bg-white rounded-lg border border-border p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Mi Perfil
        </h1>
        <p className="text-muted-foreground mt-2">
          Información personal y estadísticas de rendimiento
        </p>
      </div>

      {/* Datos Personales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Datos Personales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Nombre completo</span>
              </div>
              <p className="text-base font-medium">
                {usuario.nombre} {usuario.apellido}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>Email</span>
              </div>
              <p className="text-base font-medium">{usuario.email || user.email}</p>
            </div>

            {usuario.telefono && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>Teléfono</span>
                </div>
                <p className="text-base font-medium">{usuario.telefono}</p>
              </div>
            )}

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Truck className="h-4 w-4" />
                <span>Vehículo asignado</span>
              </div>
              {usuario.vehiculo ? (
                <div>
                  <p className="text-base font-medium">
                    {usuario.vehiculo.patente} - {usuario.vehiculo.marca} {usuario.vehiculo.modelo}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Capacidad: {usuario.vehiculo.capacidad_kg} kg
                  </p>
                </div>
              ) : (
                <p className="text-base font-medium text-muted-foreground">
                  Sin vehículo asignado
                </p>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Estado</span>
              </div>
              <Badge variant={usuario.activo ? 'default' : 'secondary'}>
                {usuario.activo ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
          </div>

          <Separator />

          <div>
            <Button variant="outline" size="sm" disabled>
              Cambiar Contraseña
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Contacta al administrador para cambiar tu contraseña
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Estadísticas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Estadísticas (Últimos 30 días)
          </CardTitle>
          <CardDescription>
            Rendimiento y métricas de tus entregas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-t-[4px] border-t-blue-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Rutas Completadas</CardTitle>
                <CheckCircle className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{rutasCompletadas}</div>
                <p className="text-xs text-muted-foreground">
                  {rutasEnCurso > 0 && `${rutasEnCurso} en curso`}
                </p>
              </CardContent>
            </Card>

            <Card className="border-t-[4px] border-t-green-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Entregas Completadas</CardTitle>
                <Package className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{entregasCompletadas}</div>
                <p className="text-xs text-muted-foreground">
                  de {totalEntregas} totales
                </p>
              </CardContent>
            </Card>

            <Card className="border-t-[4px] border-t-orange-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tiempo Promedio</CardTitle>
                <Clock className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {tiempoPromedioEntrega > 0 ? Math.round(tiempoPromedioEntrega) : 0}
                </div>
                <p className="text-xs text-muted-foreground">minutos por entrega</p>
              </CardContent>
            </Card>

            <Card className="border-t-[4px] border-t-purple-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Eficiencia</CardTitle>
                <Award className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{eficiencia.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">
                  Tasa de éxito
                </p>
              </CardContent>
            </Card>
          </div>

          <Separator className="my-6" />

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Kilómetros Recorridos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold flex items-center gap-2">
                  <MapPin className="h-6 w-6 text-blue-500" />
                  {kmTotales.toFixed(1)} km
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  En los últimos 30 días
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Tiempo Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold flex items-center gap-2">
                  <Clock className="h-6 w-6 text-orange-500" />
                  {Math.round(tiempoTotalMin / 60)}h {tiempoTotalMin % 60}m
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Tiempo total en rutas
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Gráficos de Rendimiento */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-foreground">Mi Rendimiento</h2>
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          <EntregasDiariasRepartidorChart />
          <EficienciaRutasChart />
        </div>
      </div>
    </div>
  )
}



