import { listarGastos, listarCategoriasGasto } from '@/actions/gastos.actions'
import { listarCajas } from '@/actions/tesoreria.actions'
import { GastoForm } from '@/components/forms/GastoForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const revalidate = 300 // Revalida cada 5 minutos

export default async function GastosPage() {
  const [gastos, categorias, cajas] = await Promise.all([
    listarGastos(),
    listarCategoriasGasto(),
    listarCajas(),
  ])

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-destructive/5 via-white to-secondary/5 p-6 shadow-sm border border-destructive/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-destructive/5 rounded-full blur-3xl -z-10" />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gastos</h1>
            <p className="text-muted-foreground mt-1">
              Registra comprobantes y controla los egresos operativos.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <GastoForm categorias={categorias?.data ?? []} cajas={cajas ?? []} />

        <Card>
          <CardHeader>
            <CardTitle>Gastos recientes</CardTitle>
            <CardDescription>Últimos egresos cargados en el sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(gastos?.data ?? []).map((gasto) => (
                <div key={gasto.id} className="rounded-lg border border-muted/50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">
                        {(gasto.gastos_categorias as any)?.nombre || 'Sin categoría'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(gasto.fecha).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-destructive">
                        -${Number(gasto.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {gasto.afecta_caja ? 'Afectó caja' : 'Solo contable'}
                      </p>
                    </div>
                  </div>
                  {gasto.descripcion && (
                    <p className="text-xs text-muted-foreground mt-2">{gasto.descripcion}</p>
                  )}
                </div>
              ))}
              {gastos.data?.length === 0 && (
                <p className="text-sm text-muted-foreground text-center">Aún no registraste gastos.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="text-right text-xs text-muted-foreground">DaniR</div>
    </div>
  )
}

