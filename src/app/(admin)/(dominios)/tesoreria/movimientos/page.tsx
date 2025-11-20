import { obtenerMovimientosCaja, listarCajas } from '@/actions/tesoreria.actions'
import { MovimientoCajaForm } from '@/components/forms/MovimientoCajaForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

export default async function MovimientosPage() {
  const [movimientos, cajas] = await Promise.all([obtenerMovimientosCaja(), listarCajas()])

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

      <div className="grid gap-6 md:grid-cols-2">
        <MovimientoCajaForm cajas={cajas ?? []} />

        <Card>
          <CardHeader>
            <CardTitle>Últimos movimientos</CardTitle>
            <CardDescription>Historial resumido de ingresos y egresos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {((movimientos as any)?.movimientos ?? (movimientos as any)?.data ?? []).map((movimiento: any) => (
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
              {((movimientos as any)?.movimientos ?? (movimientos as any)?.data ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center">Aún no hay movimientos registrados.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="text-right text-xs text-muted-foreground">DaniR</div>
    </div>
  )
}

