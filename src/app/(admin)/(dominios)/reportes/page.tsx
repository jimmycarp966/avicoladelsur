import { getTodayArgentina } from '@/lib/utils'
import { obtenerKpisVentas } from '@/actions/reportes.actions'
import { obtenerKpisStock } from '@/actions/reportes-stock.actions'
import { obtenerKpisReparto } from '@/actions/reportes-reparto.actions'
import { obtenerKpisTesoreria } from '@/actions/reportes-tesoreria.actions'
import { obtenerResumenTesoreria } from '@/actions/tesoreria.actions'
import { createClient } from '@/lib/supabase/server'
import { subDays, format } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import {
  BarChart3,
  Package,
  Truck,
  DollarSign,
  Users,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ReportesPage() {
  const supabase = await createClient()

  // Filtros por defecto (hoy y últimos 7 días)
  const fechaHasta = getTodayArgentina()
  const fechaDesde = format(subDays(new Date(fechaHasta), 6), 'yyyy-MM-dd')

  const filtros = {
    fechaDesde,
    fechaHasta,
  }

  // Obtener KPIs principales
  const [
    kpisVentasResult,
    kpisStockResult,
    kpisRepartoResult,
    kpisTesoreriaResult,
    resumenTesoreriaResult,
  ] = await Promise.all([
    obtenerKpisVentas(filtros),
    obtenerKpisStock(filtros),
    obtenerKpisReparto(filtros),
    obtenerKpisTesoreria(filtros),
    obtenerResumenTesoreria(),
  ])

  const kpisVentas = kpisVentasResult.data || {}
  const kpisStock = kpisStockResult.data || {}
  const kpisReparto = kpisRepartoResult.data || {}
  const kpisTesoreria = kpisTesoreriaResult.data || {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10" />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard Ejecutivo</h1>
            <p className="text-muted-foreground mt-1">
              Visión general del negocio en tiempo real
            </p>
          </div>
        </div>
      </div>

      {/* KPIs Principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ventas del Día</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">
                  ${Number(kpisVentas.ventas_totales || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {kpisVentas.transacciones || 0} transacciones
                </p>
              </div>
              <ShoppingCart className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-info">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Caja Actual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">
                  ${Number(resumenTesoreriaResult.data?.saldoTotal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-muted-foreground">Saldo consolidado</p>
              </div>
              <DollarSign className="h-8 w-8 text-info" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-success">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Entregas Hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{kpisReparto.entregasExitosas || 0}</p>
                <p className="text-xs text-muted-foreground">
                  {kpisReparto.tasaExito ? `${kpisReparto.tasaExito.toFixed(1)}% éxito` : '0% éxito'}
                </p>
              </div>
              <Truck className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-warning">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Stock Crítico</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{kpisStock.stockCritico || 0}</p>
                <p className="text-xs text-muted-foreground">Productos bajo mínimo</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enlaces a Reportes */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/reportes/ventas">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Reporte de Ventas
              </CardTitle>
              <CardDescription>KPIs, gráficos y análisis de ventas</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/reportes/pedidos">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Reporte de Pedidos
              </CardTitle>
              <CardDescription>Funnel de conversión y lead scoring</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/reportes/stock">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Reporte de Stock
              </CardTitle>
              <CardDescription>Inventario, mermas y proyección</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/reportes/almacen">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Reporte de Almacén
              </CardTitle>
              <CardDescription>Preparación y variación de peso</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/reportes/reparto">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Reporte de Reparto
              </CardTitle>
              <CardDescription>Eficiencia y rendimiento de rutas</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/reportes/tesoreria">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Reporte de Tesorería
              </CardTitle>
              <CardDescription>Recaudación y métodos de pago</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/reportes/clientes">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Reporte de Clientes
              </CardTitle>
              <CardDescription>RFM, cohortes y preferencias</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/reportes/empleados">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Reporte de Empleados
              </CardTitle>
              <CardDescription>Asistencia y productividad</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Alertas Críticas */}
      {(kpisStock.stockCritico > 0 || kpisReparto.entregasFallidas > 0) && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Alertas Críticas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {kpisStock.stockCritico > 0 && (
              <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg">
                <span className="text-sm font-medium">
                  {kpisStock.stockCritico} productos con stock crítico
                </span>
                <Link href="/reportes/stock" className="text-sm text-primary hover:underline">
                  Ver detalles →
                </Link>
              </div>
            )}
            {kpisReparto.entregasFallidas > 0 && (
              <div className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg">
                <span className="text-sm font-medium">
                  {kpisReparto.entregasFallidas} entregas fallidas
                </span>
                <Link href="/reportes/reparto" className="text-sm text-primary hover:underline">
                  Ver detalles →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="text-right text-xs text-muted-foreground">DaniR</div>
    </div>
  )
}
