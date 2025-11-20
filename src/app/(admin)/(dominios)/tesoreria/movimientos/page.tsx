import { obtenerMovimientosCaja, listarCajas } from '@/actions/tesoreria.actions'
import { MovimientoCajaForm } from '@/components/forms/MovimientoCajaForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function MovimientosPage() {
  const [movimientos, cajas] = await Promise.all([obtenerMovimientosCaja(), listarCajas()])

  const movimientosPayload = (movimientos as any)?.data ?? {}
  const movimientosList = movimientosPayload.movimientos ?? []
  const totalesPorMetodo = movimientosPayload.totales_por_metodo ?? {}
  const totalesPorTipo = movimientosPayload.totales_por_tipo ?? { ingresos: 0, egresos: 0 }
  const cajaCentral = movimientosPayload.caja_central
  const neto = totalesPorTipo.ingresos - totalesPorTipo.egresos

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-success/5 via-white to-secondary/5 p-6 shadow-sm border border-success/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-success/5 rounded-full blur-3xl -z-10" />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Movimientos de caja</h1>
            <p className="text-muted-foreground mt-1">
              Registra ingresos y egresos manuales para mantener conciliado tu saldo real
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-t-4 border-t-green-500 bg-green-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">Ingresos del día</CardTitle>
            <ArrowUpCircle className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              ${totalesPorTipo.ingresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-green-700/80">Cobros registrados en las cajas</p>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-red-500 bg-red-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-800">Egresos del día</CardTitle>
            <ArrowDownCircle className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
              ${totalesPorTipo.egresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-red-700/80">Pagos y salidas de caja</p>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-primary bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Neto del día</CardTitle>
            <Wallet className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${neto >= 0 ? 'text-primary' : 'text-destructive'}`}>
              ${neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Resultado ingresos - egresos</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <MovimientoCajaForm cajas={cajas ?? []} />

          <Card>
            <CardHeader>
              <CardTitle>Recaudación por método</CardTitle>
              <CardDescription>Distribución de ingresos por medio de pago</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.keys(totalesPorMetodo).length === 0 && (
                <p className="text-sm text-muted-foreground">Aún no se registraron cobros hoy.</p>
              )}

              {Object.entries(totalesPorMetodo).map(([metodo, valores]) => {
                const valoresTyped = valores as { ingresos: number; egresos: number }
                return (
                  <div
                    key={metodo}
                    className="flex items-center justify-between rounded-lg border border-muted/50 p-4"
                  >
                    <div>
                      <p className="font-semibold capitalize">{metodo.replace('_', ' ')}</p>
                      <p className="text-xs text-muted-foreground">
                        Ingresos: ${valoresTyped.ingresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    {valoresTyped.egresos > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Egresos: ${valoresTyped.egresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Caja Central</CardTitle>
              <CardDescription>Resumen de lo recaudado por reparto</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {cajaCentral ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Ingresos acumulados</p>
                      <p className="text-2xl font-bold text-green-600">
                        ${cajaCentral.ingresos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <Badge variant="outline">{cajaCentral.nombre}</Badge>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(cajaCentral.totales_por_metodo ?? {}).map(([metodo, monto]) => {
                      const montoTyped = monto as number
                      return (
                        <div key={metodo} className="flex items-center justify-between text-sm">
                          <span className="capitalize text-muted-foreground">{metodo.replace('_', ' ')}</span>
                          <span className="font-semibold">
                            ${montoTyped.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )
                    })}
                    {Object.keys(cajaCentral.totales_por_metodo ?? {}).length === 0 && (
                      <p className="text-sm text-muted-foreground">Aún no ingresaron cobros.</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Crea una caja llamada "Caja Central" para visualizar la recaudación diaria.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Últimos movimientos</CardTitle>
              <CardDescription>Historial resumido de ingresos y egresos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {movimientosList.map((movimiento: any) => (
                  <div
                    key={movimiento.id}
                    className="rounded-lg border border-muted/50 p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold">
                        {movimiento.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} ·{' '}
                        {(movimiento.tesoreria_cajas as any)?.nombre || 'Caja'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(movimiento.created_at).toLocaleString('es-AR')}
                      </p>
                      {movimiento.descripcion && (
                        <p className="text-xs text-muted-foreground mt-1">{movimiento.descripcion}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p
                        className={
                          movimiento.tipo === 'ingreso' ? 'font-bold text-success' : 'font-bold text-destructive'
                        }
                      >
                        {movimiento.tipo === 'ingreso' ? '+' : '-'}$
                        {Number(movimiento.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground">{movimiento.metodo_pago}</p>
                    </div>
                  </div>
                ))}
                {movimientosList.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center">
                    Aún no hay movimientos registrados.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="text-right text-xs text-muted-foreground">DaniR</div>
    </div>
  )
}

