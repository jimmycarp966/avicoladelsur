import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Megaphone, Bell, Calendar, User, AlertTriangle, Truck, Package, Building2 } from 'lucide-react'
import { getSucursalUsuarioConAdmin } from '@/lib/utils'
import Link from 'next/link'

async function getNovedadesSucursal() {
  const supabase = await createClient()

  // Obtener usuario actual
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Usuario no autenticado')
  }

  // Obtener sucursal del usuario con soporte para admin
  const { sucursalId, esAdmin } = await getSucursalUsuarioConAdmin(supabase, user.id, user.email || '')

  if (!sucursalId && !esAdmin) {
    throw new Error('Usuario no tiene sucursal asignada')
  }

  if (!sucursalId) {
    // Admin sin sucursales activas
    return {
      novedades: [],
      estadisticas: {
        total: 0,
        importantes: 0,
        automaticas: 0,
        estaSemana: 0,
        alertasActivas: 0,
        transferenciasPendientes: 0,
        ventasRecientes: 0
      },
      sinSucursal: true,
      esAdmin: true
    }
  }

  // Obtener datos para generar notificaciones inteligentes
  const [alertasResult, transferenciasResult, ventasResult] = await Promise.all([
    // Alertas activas
    supabase
      .from('alertas_stock')
      .select('id, estado, created_at')
      .eq('sucursal_id', sucursalId)
      .eq('estado', 'pendiente'),

    // Transferencias pendientes
    supabase
      .from('transferencias_stock')
      .select('id, estado, fecha_solicitud')
      .or(`sucursal_origen_id.eq.${sucursalId},sucursal_destino_id.eq.${sucursalId}`)
      .in('estado', ['pendiente', 'en_transito']),

    // Ventas recientes (últimas 24 horas)
    supabase
      .from('pedidos')
      .select('id, created_at')
      .eq('sucursal_id', sucursalId)
      .eq('estado', 'completado')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
  ])

  const alertasActivas = alertasResult.data || []
  const transferenciasActivas = transferenciasResult.data || []
  const ventasRecientes = ventasResult.data || []

  // Generar notificaciones basadas en datos reales
  const notificacionesAutomaticas = []

  // Notificación de alertas de stock
  if (alertasActivas.length > 0) {
    notificacionesAutomaticas.push({
      id: 'alertas-stock',
      titulo: `${alertasActivas.length} productos con stock bajo`,
      descripcion: `Tienes ${alertasActivas.length} alerta(s) de stock que requieren atención inmediata. Revisa el inventario.`,
      tipo: 'advertencia',
      importante: true,
      fecha: new Date().toISOString(),
      automatica: true,
      icono: AlertTriangle
    })
  }

  // Notificación de transferencias
  if (transferenciasActivas.length > 0) {
    const pendientes = transferenciasActivas.filter(t => t.estado === 'pendiente').length
    const enTransito = transferenciasActivas.filter(t => t.estado === 'en_transito').length

    if (pendientes > 0 || enTransito > 0) {
      notificacionesAutomaticas.push({
        id: 'transferencias-activas',
        titulo: `${transferenciasActivas.length} transferencia(s) activa(s)`,
        descripcion: `${pendientes} pendiente(s) de aprobación, ${enTransito} en tránsito. Gestiona tus transferencias.`,
        tipo: 'informacion',
        importante: pendientes > 0,
        fecha: new Date().toISOString(),
        automatica: true,
        icono: Truck
      })
    }
  }

  // Notificación de ventas recientes
  if (ventasRecientes.length > 0) {
    notificacionesAutomaticas.push({
      id: 'ventas-recientes',
      titulo: `${ventasRecientes.length} venta(s) completada(s) hoy`,
      descripcion: `Has registrado ${ventasRecientes.length} venta(s) exitosa(s) en las últimas 24 horas. ¡Buen trabajo!`,
      tipo: 'exito',
      importante: false,
      fecha: new Date().toISOString(),
      automatica: true,
      icono: Package
    })
  }

  // Notificaciones manuales de ejemplo (pueden venir de una tabla de notificaciones en el futuro)
  const notificacionesManuales = [
    {
      id: 'mantenimiento-sistema',
      titulo: 'Mantenimiento programado del sistema',
      descripcion: 'El sistema estará en mantenimiento este sábado de 2:00 AM a 4:00 AM. Se recomienda no realizar operaciones críticas durante ese período.',
      tipo: 'advertencia',
      importante: true,
      fecha: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Hace 1 día
      automatica: false,
      icono: Megaphone
    },
    {
      id: 'nuevo-horario',
      titulo: 'Actualización de horario de atención',
      descripcion: 'A partir del lunes, el horario de atención se extiende hasta las 8:00 PM para mejor atender a nuestros clientes.',
      tipo: 'informacion',
      importante: false,
      fecha: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // Hace 2 días
      automatica: false,
      icono: Bell
    },
    {
      id: 'nuevos-productos',
      titulo: 'Nuevos productos en catálogo',
      descripcion: 'Se agregaron 5 nuevos productos al catálogo principal. Los productos estarán disponibles para venta inmediata.',
      tipo: 'exito',
      importante: false,
      fecha: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // Hace 3 días
      automatica: false,
      icono: Package
    }
  ]

  // Combinar todas las notificaciones
  const todasLasNovedades = [...notificacionesAutomaticas, ...notificacionesManuales]
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

  // Calcular estadísticas
  const estadisticas = {
    total: todasLasNovedades.length,
    importantes: todasLasNovedades.filter(n => n.importante).length,
    automaticas: notificacionesAutomaticas.length,
    estaSemana: todasLasNovedades.filter(n => {
      const fecha = new Date(n.fecha)
      const semanaAtras = new Date()
      semanaAtras.setDate(semanaAtras.getDate() - 7)
      return fecha >= semanaAtras
    }).length,
    alertasActivas: alertasActivas.length,
    transferenciasPendientes: transferenciasActivas.length,
    ventasRecientes: ventasRecientes.length
  }

  return {
    novedades: todasLasNovedades,
    estadisticas,
    sinSucursal: false,
    esAdmin
  }
}

export default async function SucursalNovedadesPage() {
  try {
    const data = await getNovedadesSucursal()

    // Si es admin sin sucursal, mostrar mensaje informativo
    if (data.sinSucursal && data.esAdmin) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="w-full max-w-md border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertTriangle className="w-12 h-12 text-amber-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-amber-900">
                  No hay sucursales activas
                </h3>
                <p className="text-amber-800 mb-4">
                  Como administrador, necesitas crear una sucursal antes de poder ver las novedades.
                </p>
                <Button asChild>
                  <Link href="/sucursales/nueva">
                    <Building2 className="w-4 h-4 mr-2" />
                    Crear Primera Sucursal
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Megaphone className="w-8 h-8" />
              Novedades de Sucursal
            </h1>
            <p className="text-muted-foreground">
              Comunicaciones importantes, alertas automáticas y actualizaciones del sistema
            </p>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Novedades</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.estadisticas.total}</div>
              <p className="text-xs text-muted-foreground">
                Todas las notificaciones
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Importantes</CardTitle>
              <Megaphone className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{data.estadisticas.importantes}</div>
              <p className="text-xs text-muted-foreground">
                Requieren atención
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Automáticas</CardTitle>
              <AlertTriangle className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{data.estadisticas.automaticas}</div>
              <p className="text-xs text-muted-foreground">
                Basadas en tu actividad
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Esta Semana</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.estadisticas.estaSemana}</div>
              <p className="text-xs text-muted-foreground">
                Novedades recientes
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Novedades */}
        <Card>
          <CardHeader>
            <CardTitle>Novedades y Notificaciones</CardTitle>
            <CardDescription>
              Mantente informado con alertas automáticas y comunicaciones importantes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg animate-pulse">
                    <div className="w-10 h-10 bg-muted rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-1/3"></div>
                      <div className="h-3 bg-muted rounded w-1/4"></div>
                    </div>
                  </div>
                ))}
              </div>
            }>
              <div className="space-y-4">
                {data.novedades.map((novedad) => {
                  const Icono = novedad.icono || Bell

                  return (
                    <Card
                      key={novedad.id}
                      className={`hover:shadow-md transition-shadow ${
                        novedad.importante ? 'border-red-200 bg-red-50/50' : ''
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            novedad.tipo === 'advertencia' ? 'bg-yellow-100' :
                            novedad.tipo === 'informacion' ? 'bg-blue-100' :
                            novedad.tipo === 'exito' ? 'bg-green-100' : 'bg-gray-100'
                          }`}>
                            <Icono className={`w-5 h-5 ${
                              novedad.tipo === 'advertencia' ? 'text-yellow-600' :
                              novedad.tipo === 'informacion' ? 'text-blue-600' :
                              novedad.tipo === 'exito' ? 'text-green-600' : 'text-gray-600'
                            }`} />
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold">{novedad.titulo}</h4>
                              {novedad.importante && (
                                <Badge variant="destructive" className="text-xs">
                                  Importante
                                </Badge>
                              )}
                              {novedad.automatica && (
                                <Badge variant="outline" className="text-xs">
                                  Automática
                                </Badge>
                              )}
                            </div>

                            <p className="text-muted-foreground mb-2">
                              {novedad.descripcion}
                            </p>

                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(novedad.fecha).toLocaleDateString('es-ES', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>

                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {novedad.automatica ? 'Sistema' : 'Administración'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </Suspense>
          </CardContent>
        </Card>

        {/* Información adicional */}
        <Card>
          <CardHeader>
            <CardTitle>Tipos de Notificaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span>Información</span>
                </h4>
                <p className="text-sm text-muted-foreground">
                  Comunicaciones generales, cambios de horario, políticas
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span>Advertencia</span>
                </h4>
                <p className="text-sm text-muted-foreground">
                  Mantenimientos, alertas de stock, cambios importantes
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>Éxito</span>
                </h4>
                <p className="text-sm text-muted-foreground">
                  Nuevas funcionalidades, logros, productos disponibles
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  } catch (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Megaphone className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error al cargar novedades</h3>
              <p className="text-muted-foreground">
                {error instanceof Error ? error.message : 'Error desconocido'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
}
