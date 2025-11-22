import { obtenerResumenTesoreria, listarCajas, obtenerRutasPendientesValidacion } from '@/actions/tesoreria.actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { PiggyBank, Wallet, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function TesoreriaPage() {
  const [resumen, cajas, rutasPendientes] = await Promise.all([
    obtenerResumenTesoreria(),
    listarCajas(),
    obtenerRutasPendientesValidacion(),
  ])
  
  const rutasPendientesCount = rutasPendientes.success ? rutasPendientes.data?.length || 0 : 0

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Tesorería</h1>
            <p className="text-muted-foreground mt-2 text-base">
              Control en tiempo real de tus cajas, egresos y flujo de efectivo
            </p>
          </div>
          <div className="flex items-center gap-2">
            {rutasPendientesCount > 0 && (
              <Button asChild variant="default" className="bg-yellow-600 hover:bg-yellow-700 shadow-sm">
                <Link href="/tesoreria/validar-rutas" className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Validar Rutas ({rutasPendientesCount})
                </Link>
              </Button>
            )}
            <Button asChild className="bg-primary hover:bg-primary/90 shadow-sm">
              <Link href="/tesoreria/cajas">Gestionar cajas</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-t-[4px] border-t-primary hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Saldo total</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <PiggyBank className="h-6 w-6 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary mb-2">
              ${Number(resumen.data?.saldoTotal ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
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
              ${Number(resumen.data?.totalIngresos ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
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
              ${Number(resumen.data?.totalEgresos ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-sm text-muted-foreground font-medium">Gastos que afectan caja</p>
          </CardContent>
        </Card>

        <Card className="border-t-[4px] border-t-secondary hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Cajas activas</CardTitle>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/10">
              <Wallet className="h-6 w-6 text-secondary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-secondary mb-2">{cajas?.length ?? 0}</div>
            <p className="text-sm text-muted-foreground font-medium">Incluye cajas físicas y virtuales</p>
          </CardContent>
        </Card>
      </div>

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
                      ${Number(caja.saldo_actual).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
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

