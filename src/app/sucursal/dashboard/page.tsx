import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Package,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Truck,
  Calendar,
  Clock,
  Building2,
  MapPin,
  Phone,
  ExternalLink
} from 'lucide-react'
import Link from 'next/link'
import { getSucursalUsuario } from '@/lib/utils'

interface PageProps {
  searchParams: Promise<{
    sid?: string
  }>
}

async function getSucursalData(searchParams?: { sid?: string }) {
  const supabase = await createClient()

  // Obtener usuario actual
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Usuario no autenticado')
  }

  // Obtener rol del usuario
  const { data: usuarioData, error: usuarioError } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('email', user.email)
    .single()

  // Si hay error al obtener el usuario, verificar también por auth.users
  let esAdmin = false
  if (usuarioData?.rol === 'admin') {
    esAdmin = true
  } else if (usuarioError) {
    // Si no existe en usuarios, verificar si es admin en auth.users metadata
    const { data: { user: authUser } } = await supabase.auth.getUser()
    esAdmin = authUser?.user_metadata?.rol === 'admin' || authUser?.user_metadata?.role === 'admin'
  }

  // Obtener sucursal del usuario
  const sucursalId = await getSucursalUsuario(supabase, user.id)

  // Si es admin y hay un parámetro sid en la URL, usar ese (permite cambiar de sucursal)
  let sucursalIdFinal = sucursalId
  if (esAdmin && searchParams?.sid) {
    // Validar que la sucursal existe y está activa
    const { data: sucursalParam } = await supabase
      .from('sucursales')
      .select('id, active')
      .eq('id', searchParams.sid)
      .single()
    
    if (sucursalParam && sucursalParam.active) {
      sucursalIdFinal = searchParams.sid
    }
  }

  if (!sucursalIdFinal && !esAdmin) {
    // Usuario no tiene sucursal asignada y no es admin - redirigir a página de configuración
    redirect('/sucursal/configuracion?mensaje=sucursal-requerida')
  }

  // Si es admin y no tiene sucursal asignada, obtener la primera sucursal activa
  if (!sucursalIdFinal && esAdmin) {
    const { data: sucursalesActivas } = await supabase
      .from('sucursales')
      .select('id')
      .eq('active', true)
      .order('nombre')
      .limit(1)
    
    if (sucursalesActivas && sucursalesActivas.length > 0) {
      sucursalIdFinal = sucursalesActivas[0].id
    } else {
      // Si es admin y no hay sucursales, permitir acceso pero mostrar mensaje
      // No lanzar error, permitir que el admin vea el dashboard vacío
      // Esto permite que el admin pueda crear sucursales desde el sistema
      console.warn('Admin sin sucursal asignada y sin sucursales activas en el sistema')
    }
  }

  // Obtener información de la sucursal
  let sucursal = null
  if (sucursalIdFinal) {
    const { data: sucursalData, error: sucursalError } = await supabase
      .from('sucursales')
      .select('*')
      .eq('id', sucursalIdFinal)
      .single()

    if (sucursalError) {
      throw new Error('Error al obtener datos de sucursal')
    }
    sucursal = sucursalData
  }

  // Si es admin y no hay sucursal, crear un objeto dummy para evitar errores
  if (!sucursal && esAdmin) {
    sucursal = {
      id: null,
      nombre: 'Sin sucursal asignada',
      direccion: null,
      telefono: null,
      active: false
    }
  }

  if (!sucursal) {
    throw new Error('No se pudo obtener información de la sucursal')
  }

  // Si es admin, obtener lista de todas las sucursales para el selector
  let todasLasSucursales: Array<{ id: string; nombre: string }> = []
  if (esAdmin) {
    const { data: sucursales } = await supabase
      .from('sucursales')
      .select('id, nombre')
      .eq('active', true)
      .order('nombre')
    
    todasLasSucursales = sucursales || []
  }

  // Obtener datos solo si hay una sucursal válida
  let ventasDia: any[] = []
  let alertas: any[] = []
  let caja: any = null
  let transferencias: any[] = []

  if (sucursalIdFinal) {
    // Obtener ventas del día
    const hoy = new Date().toISOString().split('T')[0]
    const { data: ventasDiaData } = await supabase
      .from('pedidos')
      .select('total, estado')
      .eq('sucursal_id', sucursalIdFinal)
      .eq('estado', 'completado')
      .gte('created_at', `${hoy}T00:00:00.000Z`)
      .lte('created_at', `${hoy}T23:59:59.999Z`)
    ventasDia = ventasDiaData || []

    // Obtener alertas activas
    const { data: alertasData } = await supabase
      .from('alertas_stock')
      .select('id, producto_id, cantidad_actual, umbral')
      .eq('sucursal_id', sucursalIdFinal)
      .eq('estado', 'pendiente')
    alertas = alertasData || []

    // Obtener saldo de caja
    const { data: cajaData } = await supabase
      .from('tesoreria_cajas')
      .select('saldo_actual')
      .eq('sucursal_id', sucursalIdFinal)
      .eq('active', true)
      .maybeSingle()
    caja = cajaData

    // Obtener transferencias pendientes
    const { data: transferenciasData } = await supabase
      .from('transferencias_stock')
      .select('id, estado')
      .or(`sucursal_origen_id.eq.${sucursalIdFinal},sucursal_destino_id.eq.${sucursalIdFinal}`)
      .in('estado', ['pendiente', 'en_transito'])
    transferencias = transferenciasData || []
  }

  return {
    sucursal,
    ventasDia: ventasDia || [],
    alertas: alertas || [],
    caja,
    transferencias: transferencias || [],
    esAdmin,
    todasLasSucursales,
    sucursalId: sucursalIdFinal
  }
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 bg-muted rounded w-64 animate-pulse"></div>
          <div className="h-4 bg-muted rounded w-96 animate-pulse"></div>
        </div>
      </div>

      {/* Cards Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-24"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-16 mb-2"></div>
              <div className="h-3 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default async function SucursalDashboardPage(props: PageProps) {
  try {
    const searchParams = await props.searchParams
    const data = await getSucursalData(searchParams)

    const totalVentasDia = data.ventasDia.reduce((sum, venta) => sum + (venta.total || 0), 0)
    const transferenciasPendientes = data.transferencias.filter(t => t.estado === 'pendiente').length
    const sinSucursal = data.esAdmin && !data.sucursalId

    return (
      <div className="space-y-6">
        {/* Banner de Identificación de Sucursal */}
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Sucursal Actual</p>
                  <p className="text-xl font-bold">{data.sucursal.nombre}</p>
                </div>
              </div>
              {data.esAdmin && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/sucursales">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Ver Todas las Sucursales
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Mensaje para admin sin sucursal asignada */}
        {sinSucursal && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900 mb-2">
                    No hay sucursales activas en el sistema
                  </h3>
                  <p className="text-amber-800 mb-4">
                    Como administrador, puedes crear nuevas sucursales desde la sección de gestión.
                  </p>
                  <Button asChild>
                    <Link href="/sucursales/nueva">
                      <Building2 className="w-4 h-4 mr-2" />
                      Crear Primera Sucursal
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Building2 className="w-8 h-8" />
                {data.sucursal.nombre}
              </h1>
              <Badge variant={data.sucursal.active ? "default" : "secondary"} className="text-sm">
                {data.sucursal.active ? 'Activa' : 'Inactiva'}
              </Badge>
              {data.esAdmin && (
                <Badge variant="outline" className="text-xs">
                  Vista Admin
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {data.sucursal.direccion && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span>{data.sucursal.direccion}</span>
                </div>
              )}
              {data.sucursal.telefono && (
                <div className="flex items-center gap-1">
                  <Phone className="w-4 h-4" />
                  <span>{data.sucursal.telefono}</span>
                </div>
              )}
            </div>
            {data.esAdmin && data.todasLasSucursales.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1">
                  {data.todasLasSucursales.length > 1 ? 'Cambiar sucursal:' : 'Sucursales disponibles:'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.todasLasSucursales.map((s) => (
                    <Button
                      key={s.id}
                      variant={s.id === data.sucursal.id ? "default" : "outline"}
                      size="sm"
                      asChild
                    >
                      <Link href={`/sucursal/dashboard?sid=${s.id}`}>
                        {s.nombre}
                      </Link>
                    </Button>
                  ))}
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/sucursales">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Ver Todas
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {data.esAdmin && (
              <Button variant="outline" asChild>
                <Link href="/sucursales">
                  <Building2 className="w-4 h-4 mr-2" />
                  Gestión Sucursales
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href="/sucursal/alerts">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Ver Alertas ({data.alertas.length})
              </Link>
            </Button>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Ventas del Día */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ventas del Día</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalVentasDia.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                {data.ventasDia.length} pedidos completados
              </p>
            </CardContent>
          </Card>

          {/* Alertas Activas */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alertas de Stock</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{data.alertas.length}</div>
              <p className="text-xs text-muted-foreground">
                Productos con stock bajo
              </p>
            </CardContent>
          </Card>

          {/* Estado de Caja */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo en Caja</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ${data.caja?.saldo_actual?.toFixed(2) || '0.00'}
              </div>
              <p className="text-xs text-muted-foreground">
                Saldo actual
              </p>
            </CardContent>
          </Card>

          {/* Transferencias */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transferencias</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {data.transferencias.length}
              </div>
              <p className="text-xs text-muted-foreground">
                {transferenciasPendientes} pendientes
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Acciones Rápidas */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5" />
                Registrar Venta
              </CardTitle>
              <CardDescription>
                Registra una nueva venta en la sucursal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/sucursal/ventas">
                  Ir a Ventas
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Ver Inventario
              </CardTitle>
              <CardDescription>
                Consulta el stock disponible en la sucursal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" asChild className="w-full">
                <Link href="/sucursal/inventario">
                  Ver Inventario
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Gestionar Transferencias
              </CardTitle>
              <CardDescription>
                Solicita o recibe transferencias de stock
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" asChild className="w-full">
                <Link href="/sucursal/transferencias">
                  Ver Transferencias
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Alertas Recientes */}
        {data.alertas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Alertas de Stock Activas
              </CardTitle>
              <CardDescription>
                Productos que requieren atención inmediata
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.alertas.slice(0, 3).map((alerta) => (
                  <div key={alerta.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <div>
                        <p className="font-medium">Producto #{alerta.producto_id}</p>
                        <p className="text-sm text-muted-foreground">
                          Stock: {alerta.cantidad_actual} | Umbral: {alerta.umbral}
                        </p>
                      </div>
                    </div>
                    <Badge variant="destructive">Crítico</Badge>
                  </div>
                ))}
                {data.alertas.length > 3 && (
                  <Button variant="outline" asChild className="w-full">
                    <Link href="/sucursal/alerts">
                      Ver todas las alertas ({data.alertas.length})
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  } catch (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error al cargar dashboard</h3>
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
