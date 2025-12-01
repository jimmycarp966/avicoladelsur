import { listarCajas } from '@/actions/tesoreria.actions'
import { CajaForm } from '@/components/forms/CajaForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const revalidate = 300 // Revalida cada 5 minutos

export default async function CajasPage() {
  const cajas = await listarCajas()

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10" />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cajas</h1>
            <p className="text-muted-foreground mt-1">
              Administra saldos iniciales y controla el efectivo disponible por sucursal
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <CajaForm />

        <Card className="border-l-[3px] border-l-secondary">
          <CardHeader>
            <CardTitle className="text-secondary">Cajas activas</CardTitle>
            <CardDescription>Listado resumido de las cajas registradas en el sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(cajas ?? []).map((caja) => (
                <div
                  key={caja.id}
                  className="rounded-lg border border-primary/10 bg-white/80 p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Nombre</p>
                      <p className="text-lg font-semibold">{caja.nombre}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Saldo actual</p>
                      <p className="text-xl font-bold text-primary">
                        ${Number(caja.saldo_actual).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{caja.moneda}</span>
                    <span>Actualizado: {new Date(caja.updated_at).toLocaleDateString('es-AR')}</span>
                  </div>
                </div>
              ))}
              {(cajas ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center">Aún no hay cajas registradas.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="text-right text-xs text-muted-foreground">DaniR</div>
    </div>
  )
}

