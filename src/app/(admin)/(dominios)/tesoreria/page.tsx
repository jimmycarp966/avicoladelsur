import { obtenerResumenTesoreriaAction, listarCajasAction, obtenerRutasPendientesValidacionAction, obtenerClientesMorososAction } from '@/actions/tesoreria.actions'
import { obtenerResumenProveedoresAction } from '@/actions/proveedores.actions'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { PiggyBank, Wallet, TrendingUp, TrendingDown, CheckCircle2, Building2, AlertTriangle, Users, Vault } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'

export const revalidate = 300 // Revalida cada 5 minutos

export default async function TesoreriaPage() {
  const supabase = await createClient()

  const [resumen, cajas, rutasPendientes, resumenProveedores, clientesMorosos, tesoroResult] = await Promise.all([
    obtenerResumenTesoreriaAction(),
    listarCajasAction(),
    obtenerRutasPendientesValidacionAction(),
    obtenerResumenProveedoresAction(),
    obtenerClientesMorososAction(),
    supabase.from('tesoro').select('monto').then(r => ({
      total: r.data?.reduce((sum, m) => sum + Number(m.monto), 0) || 0
    }))
  ])

  const rutasPendientesCount = rutasPendientes.success ? rutasPendientes.data?.length || 0 : 0
  const proveedoresData = resumenProveedores.success ? resumenProveedores.data : null
  const clientesMorososCount = clientesMorosos.success ? clientesMorosos.data?.length || 0 : 0
  const clientesMorososMonto = clientesMorosos.success
    ? clientesMorosos.data?.reduce((sum: number, c: any) => sum + (c.saldo_cuenta_corriente || 0), 0) || 0
    : 0

  return (
    <div className="space-y-8">
      {/* Header Estandarizado */}
      <PageHeader
        title="Tesorería"
        description="Control de cajas, egresos, proveedores y flujo de efectivo"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {rutasPendientesCount > 0 && (
              <Button asChild variant="default" size="sm" className="bg-yellow-600 hover:bg-yellow-700 shadow-sm md:h-10">
                <Link href="/tesoreria/validar-rutas" className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Validar Rutas ({rutasPendientesCount})
                </Link>
              </Button>
            )}
            <Button asChild size="sm" className="bg-primary hover:bg-primary/90 shadow-sm md:h-10">
              <Link href="/tesoreria/cajas">Gestionar cajas</Link>
            </Button>
          </div>
        }
      />

      {/* Stats Principales Estandarizados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Saldo total"
          value={formatCurrency(resumen.data?.saldoTotal ?? 0)}
          subtitle={`${(Array.isArray(resumen.data?.cajas) ? resumen.data.cajas.length : resumen.data?.cajas ?? 0)} cajas activas`}
          icon={PiggyBank}
          variant="primary"
        />

        <StatCard
          title="Ingresos hoy"
          value={formatCurrency(resumen.data?.totalIngresos ?? 0)}
          subtitle="Cobros registrados"
          icon={TrendingUp}
          variant="success"
        />

        <StatCard
          title="Egresos hoy"
          value={formatCurrency(resumen.data?.totalEgresos ?? 0)}
          subtitle="Gastos pagados"
          icon={TrendingDown}
          variant="danger"
        />

        <StatCard
          title="Tesoro"
          value={formatCurrency(tesoroResult.total)}
          subtitle="Fondo de reserva"
          icon={Vault}
          variant="info"
          action={
            <Link href="/tesoreria/tesoro" className="text-sm text-info hover:underline font-medium inline-flex items-center gap-1">
              Ver detalle →
            </Link>
          }
        />
      </div>

      {/* Stats Secundarios Estandarizados */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Deuda Proveedores"
          value={formatCurrency(proveedoresData?.deuda_total || 0)}
          subtitle={`${proveedoresData?.facturas_pendientes || 0} facturas pendientes`}
          icon={Building2}
          variant={(proveedoresData?.deuda_total || 0) > 0 ? 'warning' : 'default'}
          action={
            <Link href="/tesoreria/proveedores" className="text-sm font-medium hover:underline text-muted-foreground">
              Ver proveedores →
            </Link>
          }
        />

        <StatCard
          title="Clientes Morosos"
          value={`${clientesMorososCount} clientes`}
          subtitle={`Total: ${formatCurrency(clientesMorososMonto)}`}
          icon={Users}
          variant={clientesMorososCount > 0 ? 'danger' : 'default'}
          action={
            <Link href="/tesoreria/cuentas-corrientes" className="text-sm font-medium hover:underline text-muted-foreground">
              Ver cuentas corrientes →
            </Link>
          }
        />

        <StatCard
          title="Cajas Activas"
          value={cajas?.length ?? 0}
          subtitle="Físicas y virtuales"
          icon={Wallet}
          variant="default"
          action={
            <Link href="/tesoreria/cajas" className="text-sm font-medium hover:underline text-muted-foreground">
              Gestionar cajas →
            </Link>
          }
        />
      </div>

      {/* Alertas Financieras */}
      {((proveedoresData?.facturas_vencidas || 0) > 0 || clientesMorososCount > 0) && (
        <Card className="border-amber-200 bg-amber-50/50 shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-5 w-5" />
              Alertas Financieras
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {(proveedoresData?.facturas_vencidas || 0) > 0 && (
                <Link
                  href="/tesoreria/proveedores"
                  className="flex items-center gap-3 px-4 py-2.5 bg-white rounded-xl text-orange-800 text-sm font-semibold border border-orange-200 shadow-sm hover:bg-orange-50 transition-colors"
                >
                  <Building2 className="h-5 w-5 text-orange-500" />
                  {proveedoresData?.facturas_vencidas} facturas de proveedores vencidas
                </Link>
              )}
              {clientesMorososCount > 0 && (
                <Link
                  href="/tesoreria/cuentas-corrientes"
                  className="flex items-center gap-3 px-4 py-2.5 bg-white rounded-xl text-red-800 text-sm font-semibold border border-red-200 shadow-sm hover:bg-red-50 transition-colors"
                >
                  <Users className="h-5 w-5 text-red-500" />
                  {clientesMorososCount} clientes con deuda pendiente
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabla de cajas recientes - Card Dashboard style */}
      <Card className="overflow-hidden border-border/60">
        <CardHeader className="pb-4 border-b border-border/50">
          <CardTitle className="text-xl font-bold">Resumen de Cajas</CardTitle>
          <CardDescription className="text-base mt-1">Saldos actuales por caja registrada</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-base">
              <thead>
                <tr className="text-left bg-muted/30">
                  <th className="py-4 px-6 font-semibold text-sm uppercase tracking-wider text-muted-foreground">Nombre</th>
                  <th className="py-4 px-6 font-semibold text-sm uppercase tracking-wider text-muted-foreground">Saldo actual</th>
                  <th className="py-4 px-6 font-semibold text-sm uppercase tracking-wider text-muted-foreground text-right">Moneda</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {(cajas ?? []).map((caja) => (
                  <tr key={caja.id} className="hover:bg-muted/10 transition-colors">
                    <td className="py-4 px-6 font-bold text-foreground">{caja.nombre}</td>
                    <td className="py-4 px-6 font-black text-primary text-lg">
                      {formatCurrency(caja.saldo_actual)}
                    </td>
                    <td className="py-4 px-6 font-medium text-muted-foreground text-right">
                      <span className="bg-primary/5 text-primary px-2.5 py-1 rounded-full text-xs font-bold">
                        {caja.moneda}
                      </span>
                    </td>
                  </tr>
                ))}
                {cajas?.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-muted-foreground">
                      No hay cajas registradas aún.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="text-right text-xs text-muted-foreground opacity-50">DaniR</div>
    </div>
  )
}
