import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
export const dynamic = 'force-dynamic'

import {
  Building2,
  Package,
  AlertTriangle,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  BarChart3,
  Download
} from 'lucide-react'
import { obtenerSucursalesAction } from '@/actions/sucursales.actions'
import { format } from 'date-fns'

interface FiltrosReportes {
  sucursalId?: string
  fechaDesde: string
  fechaHasta: string
}

async function getReportesSucursales(filtros: FiltrosReportes) {
  const supabase = await createClient()

  // Obtener sucursales
  const sucursalesResult = await obtenerSucursalesAction()
  const sucursales = sucursalesResult.success ? sucursalesResult.data || [] : []

  // Si hay filtro por sucursal específica
  if (filtros.sucursalId && filtros.sucursalId !== 'todas') {
    // Obtener datos detallados de una sucursal
    const sucursalId = filtros.sucursalId

    // Ventas de la sucursal
    const { data: ventas, error: ventasError } = await supabase
      .from('pedidos')
      .select('total, created_at, metodo_pago')
      .eq('sucursal_id', sucursalId)
      .gte('created_at', `${filtros.fechaDesde}T00:00:00`)
      .lte('created_at', `${filtros.fechaHasta}T23:59:59`)

    // Inventario de la sucursal
    const { data: inventario, error: inventarioError } = await supabase
      .from('lotes')
      .select(`
        producto_id,
        cantidad_disponible,
        productos (nombre)
      `)
      .eq('sucursal_id', sucursalId)
      .gt('cantidad_disponible', 0)

    // Alertas de la sucursal
    const { data: alertas, error: alertasError } = await supabase
      .from('alertas_stock')
      .select('id, estado')
      .eq('sucursal_id', sucursalId)

    // Tesorería de la sucursal
    const { data: movimientos, error: movimientosError } = await supabase
      .from('tesoreria_movimientos')
      .select('tipo, monto, created_at, origen_tipo')
      .eq('sucursal_id', sucursalId)
      .gte('created_at', `${filtros.fechaDesde}T00:00:00`)
      .lte('created_at', `${filtros.fechaHasta}T23:59:59`)

    const sucursal = sucursales.find(s => s.id === sucursalId)

    return {
      tipo: 'sucursal_especifica',
      sucursal,
      ventas: ventas || [],
      inventario: inventario || [],
      alertas: alertas || [],
      movimientos: movimientos || []
    }
  }

  // Vista consolidada de todas las sucursales
  const consolidado = await Promise.all(
    sucursales.map(async (sucursal) => {
      // Ventas por sucursal
      const { data: ventas } = await supabase
        .from('pedidos')
        .select('total')
        .eq('sucursal_id', sucursal.id)
        .gte('created_at', `${filtros.fechaDesde}T00:00:00`)
        .lte('created_at', `${filtros.fechaHasta}T23:59:59`)

      // Alertas por sucursal
      const { count: alertasCount } = await supabase
        .from('alertas_stock')
        .select('*', { count: 'exact', head: true })
        .eq('sucursal_id', sucursal.id)
        .eq('estado', 'pendiente')

      // Tesorería por sucursal
      const { data: movimientos } = await supabase
        .from('tesoreria_movimientos')
        .select('tipo, monto')
        .eq('sucursal_id', sucursal.id)
        .gte('created_at', `${filtros.fechaDesde}T00:00:00`)
        .lte('created_at', `${filtros.fechaHasta}T23:59:59`)

      const totalVentas = ventas?.reduce((sum, v) => sum + (v.total || 0), 0) || 0
      const ingresos = movimientos?.filter(m => m.tipo === 'ingreso').reduce((sum, m) => sum + m.monto, 0) || 0
      const egresos = movimientos?.filter(m => m.tipo === 'egreso').reduce((sum, m) => sum + m.monto, 0) || 0

      return {
        ...sucursal,
        totalVentas,
        alertasPendientes: alertasCount || 0,
        ingresos,
        egresos,
        saldoNeto: ingresos - egresos
      }
    })
  )

  return {
    tipo: 'consolidado',
    consolidado,
    fechaDesde: filtros.fechaDesde,
    fechaHasta: filtros.fechaHasta
  }
}

function ReportesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-24"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-16"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default async function ReportesSucursalesPage({
  searchParams
}: {
  searchParams: { sucursal?: string; desde?: string; hasta?: string }
}) {
  const filtros: FiltrosReportes = {
    sucursalId: searchParams.sucursal || 'todas',
    fechaDesde: searchParams.desde || format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    fechaHasta: searchParams.hasta || format(new Date(), 'yyyy-MM-dd')
  }

  const reportesData = await getReportesSucursales(filtros)
  const sucursalesResult = await obtenerSucursalesAction()
  const sucursales = sucursalesResult.success ? sucursalesResult.data || [] : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-8 h-8" />
            Reportes de Sucursales
          </h1>
          <p className="text-muted-foreground">
            Análisis detallado y consolidado por sucursal
          </p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Selecciona período y sucursal para generar reportes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="sucursal">Sucursal</Label>
              <Select name="sucursal" defaultValue={filtros.sucursalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar sucursal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las sucursales</SelectItem>
                  {sucursales.map((sucursal) => (
                    <SelectItem key={sucursal.id} value={sucursal.id}>
                      {sucursal.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="desde">Fecha Desde</Label>
              <Input
                id="desde"
                name="desde"
                type="date"
                defaultValue={filtros.fechaDesde}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hasta">Fecha Hasta</Label>
              <Input
                id="hasta"
                name="hasta"
                type="date"
                defaultValue={filtros.fechaHasta}
              />
            </div>

            <div className="flex items-end">
              <Button type="submit" className="w-full">
                <BarChart3 className="w-4 h-4 mr-2" />
                Generar Reporte
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Resultados */}
      <Suspense fallback={<ReportesSkeleton />}>
        {reportesData.tipo === 'consolidado' ? (
          <ReportesConsolidados
            data={reportesData.consolidado || []}
            fechaDesde={filtros.fechaDesde}
            fechaHasta={filtros.fechaHasta}
          />
        ) : (
          <ReporteSucursalEspecifica data={reportesData} />
        )}
      </Suspense>
    </div>
  )
}

function ReportesConsolidados({ data, fechaDesde, fechaHasta }: { data: any[], fechaDesde: string, fechaHasta: string }) {
  const totalSucursales = data.length
  const sucursalesActivas = data.filter(s => s.active).length
  const totalVentas = data.reduce((sum, s) => sum + s.totalVentas, 0)
  const totalAlertas = data.reduce((sum, s) => sum + s.alertasPendientes, 0)
  const totalSaldoNeto = data.reduce((sum, s) => sum + s.saldoNeto, 0)

  return (
    <div className="space-y-6">
      {/* Estadísticas consolidadas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sucursales</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSucursales}</div>
            <p className="text-xs text-muted-foreground">
              {sucursalesActivas} activas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalVentas.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Todas las sucursales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas Activas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalAlertas}</div>
            <p className="text-xs text-muted-foreground">
              Requieren atención
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Neto</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalSaldoNeto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${totalSaldoNeto.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Ingresos - Egresos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exportar</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" className="w-full">
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Tabla detallada por sucursal */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle por Sucursal</CardTitle>
          <CardDescription>
            Rendimiento individual de cada sucursal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.map((sucursal) => (
              <div key={sucursal.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div>
                    <h3 className="font-semibold">{sucursal.nombre}</h3>
                    <Badge variant={sucursal.active ? "default" : "secondary"}>
                      {sucursal.active ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-6 text-right">
                  <div>
                    <p className="text-sm text-muted-foreground">Ventas</p>
                    <p className="font-semibold">${sucursal.totalVentas.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Alertas</p>
                    <Badge variant={sucursal.alertasPendientes > 0 ? "destructive" : "secondary"}>
                      {sucursal.alertasPendientes}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Saldo Neto</p>
                    <p className={`font-semibold ${sucursal.saldoNeto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${sucursal.saldoNeto.toLocaleString()}
                    </p>
                  </div>
                  <div>
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/reportes/sucursales?sucursal=${sucursal.id}&desde=${fechaDesde}&hasta=${fechaHasta}`}>
                        Ver Detalle
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ReporteSucursalEspecifica({ data }: { data: any }) {
  const { sucursal, ventas, inventario, alertas, movimientos } = data

  const totalVentas = ventas.reduce((sum: number, v: any) => sum + (v.total || 0), 0)
  const alertasPendientes = alertas.filter((a: any) => a.estado === 'pendiente').length
  const totalProductos = inventario.length
  const productosBajoStock = inventario.filter((p: any) => p.cantidad_disponible <= 5).length // Umbral por defecto
  const ingresos = movimientos.filter((m: any) => m.tipo === 'ingreso').reduce((sum: number, m: any) => sum + m.monto, 0)
  const egresos = movimientos.filter((m: any) => m.tipo === 'egreso').reduce((sum: number, m: any) => sum + m.monto, 0)

  return (
    <div className="space-y-6">
      {/* Header específico */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Reporte de {sucursal.nombre}
          </CardTitle>
          <CardDescription>
            Análisis detallado del período seleccionado
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Estadísticas específicas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalVentas.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {ventas.length} pedidos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productos en Stock</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProductos}</div>
            <p className="text-xs text-muted-foreground">
              {productosBajoStock} bajo stock
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas Activas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{alertasPendientes}</div>
            <p className="text-xs text-muted-foreground">
              De {alertas.length} totales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Tesorería</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(ingresos - egresos) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${(ingresos - egresos).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Ingresos: ${ingresos.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secciones detalladas */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top productos */}
        <Card>
          <CardHeader>
            <CardTitle>Productos en Inventario</CardTitle>
            <CardDescription>Top productos por cantidad</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {inventario.slice(0, 10).map((item: any, index: number) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sm">{item.productos?.nombre || 'Producto desconocido'}</span>
                  <Badge variant={item.cantidad_disponible <= 5 ? "destructive" : "secondary"}>
                    {item.cantidad_disponible}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Movimientos recientes */}
        <Card>
          <CardHeader>
            <CardTitle>Movimientos de Tesorería</CardTitle>
            <CardDescription>Actividad financiera reciente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {movimientos.slice(0, 10).map((mov: any, index: number) => (
                <div key={index} className="flex justify-between items-center">
                  <div>
                    <span className="text-sm capitalize">{mov.origen_tipo}</span>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(mov.created_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                  <Badge variant={mov.tipo === 'ingreso' ? "default" : "destructive"}>
                    {mov.tipo === 'ingreso' ? '+' : '-'}${mov.monto.toLocaleString()}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
