import { Suspense } from 'react'
import { CalcularLiquidacionesForm } from './calcular-liquidaciones-form'
import { LiquidacionesFormSkeleton } from './liquidaciones-form-skeleton'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Calcular Liquidaciones - Avícola del Sur ERP',
  description: 'Calcular liquidaciones de sueldo mensuales para empleados',
}

export default function CalcularLiquidacionesPage() {
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
        <h1 className="text-3xl font-bold tracking-tight">Calcular Liquidaciones</h1>
        <p className="text-muted-foreground mt-1">
          Calcula las liquidaciones de sueldo mensuales para el personal basado en asistencia y producción
        </p>
      </div>

      <Suspense fallback={<LiquidacionesFormSkeleton />}>
        <CalcularLiquidacionesForm />
      </Suspense>
    </div>
  )
}
