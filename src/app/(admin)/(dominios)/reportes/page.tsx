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

export const revalidate = 3600 // Revalida cada hora

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
    <div className="space-y-6 relative">
      {/* Background Pattern */}
      <div className="fixed inset-0 -z-50 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/3 rounded-full blur-3xl" />
        <div className="absolute top-40 right-20 w-96 h-96 bg-secondary/2 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-accent/2 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary via-primary/90 to-secondary p-8 shadow-2xl border border-primary/20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -z-10" />
        <div className="absolute -top-4 -right-4 w-32 h-32 bg-accent/20 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/20 rounded-full blur-3xl" />
        <div className="flex items-center justify-between relative z-10">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-lg">
              Dashboard Ejecutivo
            </h1>
            <p className="text-white/90 mt-2 text-lg drop-shadow">
              Visión general del negocio en tiempo real
            </p>
          </div>
          <div className="hidden md:block">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <BarChart3 className="h-10 w-10 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* KPIs Principales */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-primary/10 via-primary/5 to-white hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/60" />
          <div className="absolute top-4 right-4 w-16 h-16 bg-primary/10 rounded-full blur-xl" />
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-primary/80">Ventas del Día</CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-primary mb-1">
                  ${Number(kpisVentas.ventas_totales || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {kpisVentas.transacciones || 0} transacciones
                </p>
              </div>
              <div className="p-3 bg-primary/15 rounded-full">
                <ShoppingCart className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-info/10 via-info/5 to-white hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-info to-info/60" />
          <div className="absolute top-4 right-4 w-16 h-16 bg-info/10 rounded-full blur-xl" />
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-info/80">Caja Actual</CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-info mb-1">
                  ${Number(resumenTesoreriaResult.data?.saldoTotal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-muted-foreground">Saldo consolidado</p>
              </div>
              <div className="p-3 bg-info/15 rounded-full">
                <DollarSign className="h-6 w-6 text-info" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-success/10 via-success/5 to-white hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-success to-success/60" />
          <div className="absolute top-4 right-4 w-16 h-16 bg-success/10 rounded-full blur-xl" />
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-success/80">Entregas Hoy</CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-success mb-1">{kpisReparto.entregasExitosas || 0}</p>
                <p className="text-sm text-muted-foreground">
                  {kpisReparto.tasaExito ? `${kpisReparto.tasaExito.toFixed(1)}% éxito` : '0% éxito'}
                </p>
              </div>
              <div className="p-3 bg-success/15 rounded-full">
                <Truck className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-warning/10 via-warning/5 to-white hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-warning to-warning/60" />
          <div className="absolute top-4 right-4 w-16 h-16 bg-warning/10 rounded-full blur-xl" />
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-warning/80">Stock Crítico</CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-warning mb-1">{kpisStock.stockCritico || 0}</p>
                <p className="text-sm text-muted-foreground">Productos bajo mínimo</p>
              </div>
              <div className="p-3 bg-warning/15 rounded-full">
                <AlertTriangle className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enlaces a Reportes */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/reportes/ventas">
          <Card className="group relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-primary/5 via-white to-primary/10 hover:shadow-2xl transition-all duration-500 cursor-pointer h-full hover:-translate-y-2">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute top-4 right-4 w-12 h-12 bg-primary/10 rounded-full blur-lg group-hover:bg-primary/20 transition-colors" />
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/15 rounded-lg group-hover:bg-primary/25 transition-colors">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-primary group-hover:text-primary/80 transition-colors">
                    Reporte de Ventas
                  </CardTitle>
                  <CardDescription className="text-sm">KPIs, gráficos y análisis detallado</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/reportes/pedidos">
          <Card className="group relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-secondary/5 via-white to-secondary/10 hover:shadow-2xl transition-all duration-500 cursor-pointer h-full hover:-translate-y-2">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-secondary to-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute top-4 right-4 w-12 h-12 bg-secondary/10 rounded-full blur-lg group-hover:bg-secondary/20 transition-colors" />
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-secondary/15 rounded-lg group-hover:bg-secondary/25 transition-colors">
                  <ShoppingCart className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-secondary group-hover:text-secondary/80 transition-colors">
                    Reporte de Pedidos
                  </CardTitle>
                  <CardDescription className="text-sm">Conversión y métricas de pedidos</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/reportes/stock">
          <Card className="group relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-accent/5 via-white to-accent/10 hover:shadow-2xl transition-all duration-500 cursor-pointer h-full hover:-translate-y-2">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent to-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute top-4 right-4 w-12 h-12 bg-accent/10 rounded-full blur-lg group-hover:bg-accent/20 transition-colors" />
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/15 rounded-lg group-hover:bg-accent/25 transition-colors">
                  <Package className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-accent group-hover:text-accent/80 transition-colors">
                    Reporte de Stock
                  </CardTitle>
                  <CardDescription className="text-sm">Inventario y proyecciones</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/reportes/almacen">
          <Card className="group relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-warning/5 via-white to-warning/10 hover:shadow-2xl transition-all duration-500 cursor-pointer h-full hover:-translate-y-2">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-warning to-accent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute top-4 right-4 w-12 h-12 bg-warning/10 rounded-full blur-lg group-hover:bg-warning/20 transition-colors" />
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-warning/15 rounded-lg group-hover:bg-warning/25 transition-colors">
                  <Package className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-warning group-hover:text-warning/80 transition-colors">
                    Reporte de Almacén
                  </CardTitle>
                  <CardDescription className="text-sm">Preparación y control de peso</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/reportes/reparto">
          <Card className="group relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-success/5 via-white to-success/10 hover:shadow-2xl transition-all duration-500 cursor-pointer h-full hover:-translate-y-2">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-success to-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute top-4 right-4 w-12 h-12 bg-success/10 rounded-full blur-lg group-hover:bg-success/20 transition-colors" />
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success/15 rounded-lg group-hover:bg-success/25 transition-colors">
                  <Truck className="h-6 w-6 text-success" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-success group-hover:text-success/80 transition-colors">
                    Reporte de Reparto
                  </CardTitle>
                  <CardDescription className="text-sm">Eficiencia y rendimiento</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/reportes/tesoreria">
          <Card className="group relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-info/5 via-white to-info/10 hover:shadow-2xl transition-all duration-500 cursor-pointer h-full hover:-translate-y-2">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-info to-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute top-4 right-4 w-12 h-12 bg-info/10 rounded-full blur-lg group-hover:bg-info/20 transition-colors" />
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-info/15 rounded-lg group-hover:bg-info/25 transition-colors">
                  <DollarSign className="h-6 w-6 text-info" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-info group-hover:text-info/80 transition-colors">
                    Reporte de Tesorería
                  </CardTitle>
                  <CardDescription className="text-sm">Recaudación y finanzas</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/reportes/clientes">
          <Card className="group relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-primary/5 via-white to-primary/10 hover:shadow-2xl transition-all duration-500 cursor-pointer h-full hover:-translate-y-2">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-info opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute top-4 right-4 w-12 h-12 bg-primary/10 rounded-full blur-lg group-hover:bg-primary/20 transition-colors" />
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/15 rounded-lg group-hover:bg-primary/25 transition-colors">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-primary group-hover:text-primary/80 transition-colors">
                    Reporte de Clientes
                  </CardTitle>
                  <CardDescription className="text-sm">Análisis y segmentación</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/reportes/empleados">
          <Card className="group relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-secondary/5 via-white to-secondary/10 hover:shadow-2xl transition-all duration-500 cursor-pointer h-full hover:-translate-y-2">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-secondary to-accent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute top-4 right-4 w-12 h-12 bg-secondary/10 rounded-full blur-lg group-hover:bg-secondary/20 transition-colors" />
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-secondary/15 rounded-lg group-hover:bg-secondary/25 transition-colors">
                  <TrendingUp className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold text-secondary group-hover:text-secondary/80 transition-colors">
                    Reporte de Empleados
                  </CardTitle>
                  <CardDescription className="text-sm">Productividad y asistencia</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Alertas Críticas */}
      {(kpisStock.stockCritico > 0 || kpisReparto.entregasFallidas > 0) && (
        <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-destructive/10 via-destructive/5 to-white">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-destructive to-destructive/60" />
          <div className="absolute top-4 right-4 w-16 h-16 bg-destructive/10 rounded-full blur-xl" />
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-destructive relative z-10">
              <div className="p-2 bg-destructive/15 rounded-full">
                <AlertTriangle className="h-6 w-6" />
              </div>
              Alertas Críticas Requeridas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 relative z-10">
            {kpisStock.stockCritico > 0 && (
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-destructive/15 to-destructive/5 rounded-xl border border-destructive/20 hover:border-destructive/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-destructive/20 rounded-full">
                    <Package className="h-4 w-4 text-destructive" />
                  </div>
                  <span className="text-sm font-semibold text-destructive">
                    {kpisStock.stockCritico} productos con stock crítico
                  </span>
                </div>
                <Link href="/reportes/stock" className="flex items-center gap-2 text-sm font-medium text-destructive hover:text-destructive/80 transition-colors">
                  Ver detalles
                  <TrendingUp className="h-4 w-4" />
                </Link>
              </div>
            )}
            {kpisReparto.entregasFallidas > 0 && (
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-destructive/15 to-destructive/5 rounded-xl border border-destructive/20 hover:border-destructive/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-destructive/20 rounded-full">
                    <Truck className="h-4 w-4 text-destructive" />
                  </div>
                  <span className="text-sm font-semibold text-destructive">
                    {kpisReparto.entregasFallidas} entregas fallidas
                  </span>
                </div>
                <Link href="/reportes/reparto" className="flex items-center gap-2 text-sm font-medium text-destructive hover:text-destructive/80 transition-colors">
                  Ver detalles
                  <TrendingUp className="h-4 w-4" />
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
