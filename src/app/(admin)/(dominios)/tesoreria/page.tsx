import { obtenerResumenTesoreriaAction, listarCajasAction, obtenerRutasPendientesValidacionAction, obtenerClientesMorososAction } from '@/actions/tesoreria.actions'
import { obtenerResumenProveedoresAction } from '@/actions/proveedores.actions'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { PiggyBank, Wallet, TrendingUp, TrendingDown, CheckCircle2, Building2, AlertTriangle, Users, Vault } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

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
    <div className="space-y-6">
      {/* Header - Responsivo */}
      <div className="bg-white rounded-lg border border-border p-4 md:p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Tesorería</h1>
            <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">
              Control de cajas, egresos, proveedores y flujo de efectivo
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {rutasPendientesCount > 0 && (
              <Button asChild variant="default" size="sm" className="bg-yellow-600 hover:bg-yellow-700 shadow-sm">
                <Link href="/tesoreria/validar-rutas" className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Validar Rutas ({rutasPendientesCount})
                </Link>
              </Button>
            )}
            <Button asChild size="sm" className="bg-primary hover:bg-primary/90 shadow-sm">
              <Link href="/tesoreria/cajas">Gestionar cajas</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Principales - Responsivo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="border-t-[4px] border-t-primary hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Saldo total</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <PiggyBank className="h-6 w-6 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary mb-2">
              {formatCurrency(resumen.data?.saldoTotal ?? 0)}
            </div>
            <p className="text-sm text-muted-foreground font-medium">{(Array.isArray(resumen.data?.cajas) ? resumen.data.cajas.length : resumen.data?.cajas ?? 0)} cajas activas</p>
          </CardContent>
        </Card>

        <Card className="border-t-[4px] border-t-success hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Ingresos hoy</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
              <TrendingUp className="h-6 w-6 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-success mb-2">
              {formatCurrency(resumen.data?.totalIngresos ?? 0)}
            </div>
            <p className="text-sm text-muted-foreground font-medium">Cobros registrados en el día</p>
          </CardContent>
        </Card>

        <Card className="border-t-[4px] border-t-destructive hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Egresos hoy</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
              <TrendingDown className="h-6 w-6 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-destructive mb-2">
              {formatCurrency(resumen.data?.totalEgresos ?? 0)}
            </div>
            <p className="text-sm text-muted-foreground font-medium">Gastos que afectan caja</p>
          </CardContent>
        </Card>

        <Card className="border-t-[4px] border-t-amber-500 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Tesoro</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10">
              <Vault className="h-6 w-6 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-amber-600 mb-2">{formatCurrency(tesoroResult.total)}</div>
            <Link href="/tesoreria/tesoro" className="text-sm text-amber-600 hover:underline font-medium">
              Ver detalle →
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Stats Secundarios - Deuda Proveedores y Clientes Morosos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <Card className={`hover:shadow-md transition-shadow ${(proveedoresData?.deuda_total || 0) > 0 ? 'border-orange-200 bg-orange-50/50' : ''}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deuda con Proveedores</CardTitle>
            <Building2 className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(proveedoresData?.deuda_total || 0) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {formatCurrency(proveedoresData?.deuda_total || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {proveedoresData?.facturas_pendientes || 0} facturas pendientes
              {(proveedoresData?.facturas_vencidas || 0) > 0 && (
                <span className="text-red-600 ml-1">({proveedoresData?.facturas_vencidas} vencidas)</span>
              )}
            </p>
            <Link href="/tesoreria/proveedores" className="text-xs text-blue-600 hover:underline">
              Ver proveedores →
            </Link>
          </CardContent>
        </Card>

        <Card className={`hover:shadow-md transition-shadow ${clientesMorososCount > 0 ? 'border-red-200 bg-red-50/50' : ''}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Morosos</CardTitle>
            <Users className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${clientesMorososCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {clientesMorososCount} clientes
            </div>
            <p className="text-xs text-muted-foreground">
              Deuda total: {formatCurrency(clientesMorososMonto)}
            </p>
            <Link href="/tesoreria/cuentas-corrientes" className="text-xs text-blue-600 hover:underline">
              Ver cuentas corrientes →
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cajas Activas</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cajas?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              Incluye cajas físicas y virtuales
            </p>
            <Link href="/tesoreria/cajas" className="text-xs text-blue-600 hover:underline">
              Gestionar cajas →
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      {((proveedoresData?.facturas_vencidas || 0) > 0 || clientesMorososCount > 0) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-5 w-5" />
              Alertas Financieras
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {(proveedoresData?.facturas_vencidas || 0) > 0 && (
                <Link
                  href="/tesoreria/proveedores"
                  className="flex items-center gap-2 px-3 py-2 bg-orange-100 rounded-lg text-orange-800 text-sm hover:bg-orange-200 transition-colors"
                >
                  <Building2 className="h-4 w-4" />
                  {proveedoresData?.facturas_vencidas} facturas de proveedores vencidas
                </Link>
              )}
              {clientesMorososCount > 0 && (
                <Link
                  href="/tesoreria/cuentas-corrientes"
                  className="flex items-center gap-2 px-3 py-2 bg-red-100 rounded-lg text-red-800 text-sm hover:bg-red-200 transition-colors"
                >
                  <Users className="h-4 w-4" />
                  {clientesMorososCount} clientes con deuda pendiente
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-bold">Cajas recientes</CardTitle>
          <CardDescription className="text-base mt-1">Resumen ejecutivo de las últimas cajas creadas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-base">
              <thead>
                <tr className="text-left bg-muted/50">
                  <th className="pb-3 px-4 font-semibold text-sm">Nombre</th>
                  <th className="pb-3 px-4 font-semibold text-sm">Saldo actual</th>
                  <th className="pb-3 px-4 font-semibold text-sm">Moneda</th>
                </tr>
              </thead>
              <tbody>
                {(cajas ?? []).map((caja) => (
                  <tr key={caja.id} className="border-t border-muted/50">
                    <td className="py-3 px-4 font-semibold text-foreground">{caja.nombre}</td>
                    <td className="py-3 px-4 font-bold text-foreground">
                      {formatCurrency(caja.saldo_actual)}
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground">{caja.moneda}</td>
                  </tr>
                ))}
                {cajas?.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-muted-foreground">
                      No hay cajas registradas aún.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="text-right text-xs text-muted-foreground">DaniR</div>
    </div>
  )
}
