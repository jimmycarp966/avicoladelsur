import { getTodayArgentina, formatCurrency } from '@/lib/utils'
import { obtenerKpisVentas } from '@/actions/reportes.actions'
import { obtenerKpisStock } from '@/actions/reportes-stock.actions'
import { obtenerKpisReparto } from '@/actions/reportes-reparto.actions'
import { obtenerKpisTesoreria } from '@/actions/reportes-tesoreria.actions'
import { obtenerResumenTesoreriaAction } from '@/actions/tesoreria.actions'
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
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'

export const revalidate = 60 // Revalida cada minuto (dashboard ejecutivo)

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
    obtenerResumenTesoreriaAction(),
  ])

  const kpisVentas = kpisVentasResult.data || {}
  const kpisStock = kpisStockResult.data || {}
  const kpisReparto = kpisRepartoResult.data || {}

  return (
    <div className="space-y-10 relative">
      {/* Background Decorativo */}
      <div className="fixed inset-0 -z-50 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-primary/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-20 right-10 w-[500px] h-[500px] bg-secondary/3 rounded-full blur-[120px]" />
      </div>

      {/* Header Ejecutivo Premium */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary via-[#2F7058] to-[#1a4d3a] p-10 shadow-2xl border border-white/10">
        <div className="absolute top-0 right-0 w-full h-full bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-white/5 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/80 text-xs font-bold uppercase tracking-widest backdrop-blur-md mb-2">
              <span className="flex h-2 w-2 rounded-full bg-secondary animate-pulse" />
              Reportes en Vivo
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white">
              Dashboard <span className="text-secondary font-black">Ejecutivo</span>
            </h1>
            <p className="text-white/70 text-lg font-medium max-w-lg">
              Analítica inteligente y control operativo centralizado para la gestión gerencial.
            </p>
          </div>
          <div className="hidden lg:flex items-center justify-center w-24 h-24 bg-white/10 rounded-3xl backdrop-blur-xl border border-white/10 shadow-inner">
            <BarChart3 className="h-12 w-12 text-secondary" />
          </div>
        </div>
      </div>

      {/* KPIs Principales con StatCard */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Ventas del Día"
          value={formatCurrency(kpisVentas.ventas_totales || 0)}
          subtitle={`${kpisVentas.transacciones || 0} transacciones registradas`}
          icon={ShoppingCart}
          variant="primary"
        />

        <StatCard
          title="Caja Actual"
          value={formatCurrency(resumenTesoreriaResult.data?.saldoTotal || 0)}
          subtitle="Saldo consolidado total"
          icon={DollarSign}
          variant="info"
        />

        <StatCard
          title="Entregas Hoy"
          value={kpisReparto.entregasExitosas || 0}
          subtitle={kpisReparto.tasaExito ? `${kpisReparto.tasaExito.toFixed(1)}% de efectividad` : '0% tasa de éxito'}
          icon={Truck}
          variant="success"
        />

        <StatCard
          title="Stock Crítico"
          value={kpisStock.stockCritico || 0}
          subtitle="Productos bajo el mínimo"
          icon={AlertTriangle}
          variant="warning"
        />
      </div>

      {/* Navegación de Reportes con Cards Bento */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 px-2">
          <div className="h-8 w-1.5 bg-primary rounded-full" />
          <h2 className="text-2xl font-black tracking-tight text-foreground uppercase">Módulos de Reporte</h2>
        </div>

        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <ReportCard
            href="/reportes/ventas"
            title="Ventas"
            desc="KPIs, ingresos y tendencias"
            icon={BarChart3}
            color="primary"
          />
          <ReportCard
            href="/reportes/pedidos"
            title="Pedidos"
            desc="Conversión y seguimiento"
            icon={ShoppingCart}
            color="secondary"
          />
          <ReportCard
            href="/reportes/stock"
            title="Stock"
            desc="Inventario y proyecciones"
            icon={Package}
            color="accent"
          />
          <ReportCard
            href="/reportes/almacen"
            title="Almacén"
            desc="Pesajes y producción"
            icon={Package}
            color="warning"
          />
          <ReportCard
            href="/reportes/reparto"
            title="Reparto"
            desc="Logística y eficiencia"
            icon={Truck}
            color="success"
          />
          <ReportCard
            href="/reportes/tesoreria"
            title="Tesorería"
            desc="Finanzas y recaudación"
            icon={DollarSign}
            color="info"
          />
          <ReportCard
            href="/reportes/clientes"
            title="Clientes"
            desc="Comportamiento y deuda"
            icon={Users}
            color="primary"
          />
          <ReportCard
            href="/reportes/empleados"
            title="Empleados"
            desc="Productividad y asistencia"
            icon={TrendingUp}
            color="secondary"
          />
        </div>
      </div>

      {/* Alertas Críticas Estandarizadas */}
      {(kpisStock.stockCritico > 0 || kpisReparto.entregasFallidas > 0) && (
        <Card className="overflow-hidden border-destructive/20 shadow-2xl bg-destructive/[0.02] rounded-3xl">
          <CardHeader className="bg-destructive/5 border-b border-destructive/10 p-6">
            <CardTitle className="flex items-center gap-3 text-destructive font-black text-xl uppercase tracking-tighter">
              <AlertTriangle className="h-7 w-7" />
              Alertas de Atención Inmediata
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-4">
            {kpisStock.stockCritico > 0 && (
              <AlertItem
                href="/reportes/stock"
                icon={Package}
                label={`${kpisStock.stockCritico} productos con stock insuficiente.`}
              />
            )}
            {kpisReparto.entregasFallidas > 0 && (
              <AlertItem
                href="/reportes/reparto"
                icon={Truck}
                label={`${kpisReparto.entregasFallidas} entregas fallidas en el día de hoy.`}
              />
            )}
          </CardContent>
        </Card>
      )}

      <div className="text-right text-xs text-muted-foreground opacity-30 pb-10 uppercase tracking-widest font-bold">Avicola del Sur v4.0</div>
    </div>
  )
}

function ReportCard({ href, title, desc, icon: Icon, color }: any) {
  const colorMap: any = {
    primary: 'text-primary bg-primary/10 border-primary/20',
    secondary: 'text-[#8b6d1a] bg-secondary/10 border-secondary/20',
    accent: 'text-accent bg-accent/10 border-accent/20',
    warning: 'text-warning-foreground bg-warning/10 border-warning/20',
    success: 'text-success bg-success/10 border-success/20',
    info: 'text-info-foreground bg-info/10 border-info/20',
  }

  return (
    <Link href={href} className="group">
      <Card className="h-full border-border/40 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 overflow-hidden bg-card/60 backdrop-blur-md rounded-2xl">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-current opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: `var(--${color})` }} />
        <CardHeader className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl transition-all duration-500 group-hover:scale-110 shadow-sm ${colorMap[color]}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-lg font-black group-hover:text-primary transition-colors tracking-tight">{title}</CardTitle>
              <CardDescription className="text-sm font-semibold leading-tight text-muted-foreground/80">{desc}</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    </Link>
  )
}

function AlertItem({ href, icon: Icon, label }: any) {
  return (
    <Link href={href} className="flex items-center justify-between p-5 bg-white rounded-2xl border border-destructive/10 hover:border-destructive/30 hover:bg-destructive/[0.02] transition-all group shadow-sm">
      <div className="flex items-center gap-4">
        <div className="p-2.5 bg-destructive/10 rounded-xl group-hover:scale-110 transition-transform shadow-sm">
          <Icon className="h-5 w-5 text-destructive" />
        </div>
        <span className="text-base font-black text-destructive/80 tracking-tight">{label}</span>
      </div>
      <div className="flex items-center gap-2 text-destructive font-black text-sm group-hover:translate-x-1 transition-transform">
        GESTIONAR
        <TrendingUp className="h-5 w-5" />
      </div>
    </Link>
  )
}
