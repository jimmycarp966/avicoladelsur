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
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10" />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tesorería</h1>
            <p className="text-muted-foreground mt-1">
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
        <Card className="border-t-[3px] border-t-primary bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo total</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <PiggyBank className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${Number(resumen.data?.saldoTotal ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">{(Array.isArray(resumen.data?.cajas) ? resumen.data.cajas.length : resumen.data?.cajas ?? 0)} cajas activas</p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-success bg-success/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos hoy</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${Number(resumen.data?.totalIngresos ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Cobros registrados en el día</p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-destructive bg-destructive/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Egresos hoy</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <TrendingDown className="h-5 w-5 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${Number(resumen.data?.totalEgresos ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Gastos que afectan caja</p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-secondary bg-secondary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cajas activas</CardTitle>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
              <Wallet className="h-5 w-5 text-secondary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cajas?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground">Incluye cajas físicas y virtuales</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cajas recientes</CardTitle>
          <CardDescription>Resumen ejecutivo de las últimas cajas creadas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-2">Nombre</th>
                  <th className="pb-2">Saldo actual</th>
                  <th className="pb-2">Moneda</th>
                </tr>
              </thead>
              <tbody>
                {(cajas ?? []).map((caja) => (
                  <tr key={caja.id} className="border-t border-muted/50">
                    <td className="py-2 font-medium">{caja.nombre}</td>
                    <td className="py-2">
                      ${Number(caja.saldo_actual).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2">{caja.moneda}</td>
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

