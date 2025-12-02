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
  const { data: usuarioData } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('email', user.email)
    .single()

  const esAdmin = usuarioData?.rol === 'admin'

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
    const { data: primeraSucursal } = await supabase
      .from('sucursales')
      .select('id')
      .eq('active', true)
      .order('nombre')
      .limit(1)
      .single()
    
    if (primeraSucursal) {
      sucursalIdFinal = primeraSucursal.id
    } else {
      throw new Error('No hay sucursales activas en el sistema')
    }
  }

  // Obtener información de la sucursal
  const { data: sucursal, error: sucursalError } = await supabase
    .from('sucursales')
    .select('*')
    .eq('id', sucursalIdFinal)
    .single()

  if (sucursalError) {
    throw new Error('Error al obtener datos de sucursal')
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

  // Obtener ventas del día
  const hoy = new Date().toISOString().split('T')[0]
  const { data: ventasDia, error: ventasError } = await supabase
    .from('pedidos')
    .select('total, estado')
    .eq('sucursal_id', sucursalId)
    .eq('estado', 'completado')
    .gte('created_at', `${hoy}T00:00:00.000Z`)
    .lte('created_at', `${hoy}T23:59:59.999Z`)

  // Obtener alertas activas
  const { data: alertas, error: alertasError } = await supabase
    .from('alertas_stock')
    .select('id, producto_id, cantidad_actual, umbral')
    .eq('sucursal_id', sucursalId)
    .eq('estado', 'pendiente')

  // Obtener saldo de caja
  const { data: caja, error: cajaError } = await supabase
    .from('tesoreria_cajas')
    .select('saldo_actual')
    .eq('sucursal_id', sucursalId)
    .eq('active', true)
    .single()

  // Obtener transferencias pendientes
  const { data: transferencias, error: transferenciasError } = await supabase
    .from('transferencias_stock')
    .select('id, estado')
    .or(`sucursal_origen_id.eq.${sucursalId},sucursal_destino_id.eq.${sucursalId}`)
    .in('estado', ['pendiente', 'en_transito'])

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
            {data.esAdmin && data.todasLasSucursales.length > 1 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1">Cambiar sucursal:</p>
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
