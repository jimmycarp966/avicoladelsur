import { obtenerResumenTesoreria } from '@/actions/tesoreria.actions'
import { listarGastos } from '@/actions/gastos.actions'
import { ReporteExportForm } from '@/components/forms/ReporteExportForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

export default async function ReportesPage() {
  const [resumen, gastos] = await Promise.all([obtenerResumenTesoreria(), listarGastos()])

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-info/5 via-white to-secondary/5 p-6 shadow-sm border border-info/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-info/5 rounded-full blur-3xl -z-10" />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reportes</h1>
            <p className="text-muted-foreground mt-1">
              Genera exportes en CSV para compartir con el equipo financiero.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ReporteExportForm />

        <Card>
          <CardHeader>
            <CardTitle>Resumen rápido</CardTitle>
            <CardDescription>Indicadores clave antes de exportar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-primary/10 p-4 bg-primary/5">
              <p className="text-sm text-muted-foreground">Saldo consolidado</p>
              <p className="text-2xl font-bold">
                ${Number(resumen.data?.saldo_total ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Últimos gastos registrados</p>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                {(gastos.data ?? []).slice(0, 5).map((gasto) => (
                  <div key={gasto.id} className="text-sm border border-muted/50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {(gasto.gastos_categorias as any)?.nombre || 'Sin categoría'}
                      </span>
                      <span className="text-destructive font-semibold">
                        -${Number(gasto.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(gasto.fecha).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                ))}
                {gastos.data?.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sin datos recientes</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="text-right text-xs text-muted-foreground">DaniR</div>
    </div>
  )
}
