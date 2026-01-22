import { listarCajasAction } from '@/actions/tesoreria.actions'
import { CajaForm } from '@/components/forms/CajaForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { Wallet } from 'lucide-react'

export const revalidate = 300 // Revalida cada 5 minutos

export default async function CajasPage() {
  const cajas = await listarCajasAction()

  return (
    <div className="space-y-8">
      {/* Header Estandarizado */}
      <PageHeader
        title="Cajas"
        description="Administra saldos iniciales y controla el efectivo disponible por sucursal"
        icon={Wallet}
      />

      <div className="grid gap-8 md:grid-cols-2">
        {/* Formulario envuelto en Card con estilo dashboard */}
        <div className="space-y-6">
          <CajaForm />
        </div>

        {/* Listado de Cajas con Card Estandarizada */}
        <Card className="border-border/60 shadow-md">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-xl font-bold text-primary">Cajas activas</CardTitle>
            <CardDescription className="text-base">
              Listado resumido de las cajas registradas en el sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {(cajas ?? []).map((caja) => (
                <div
                  key={caja.id}
                  className="rounded-xl border border-border/60 bg-muted/30 p-4 transition-all hover:bg-muted/50 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nombre</p>
                      <p className="text-lg font-bold text-foreground">{caja.nombre}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Saldo actual</p>
                      <p className="text-2xl font-black text-primary">
                        ${Number(caja.saldo_actual).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs font-medium text-muted-foreground/80 border-t border-border/40 pt-2">
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">{caja.moneda}</span>
                    <span>Actualizado: {new Date(caja.updated_at).toLocaleDateString('es-AR')}</span>
                  </div>
                </div>
              ))}
              {(cajas ?? []).length === 0 && (
                <div className="py-12 text-center">
                  <p className="text-muted-foreground">Aún no hay cajas registradas.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="text-right text-xs text-muted-foreground opacity-50">DaniR</div>
    </div>
  )
}

