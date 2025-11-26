import { Suspense } from 'react'
import { NuevaEvaluacionForm } from './evaluacion-form'
import { EvaluacionFormSkeleton } from './evaluacion-form-skeleton'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Nueva Evaluación - Avícola del Sur ERP',
  description: 'Crear nueva evaluación de desempeño para empleado',
}

export default function NuevaEvaluacionPage() {
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
        <h1 className="text-3xl font-bold tracking-tight">Nueva Evaluación de Desempeño</h1>
        <p className="text-muted-foreground mt-1">
          Evalúa el desempeño de un empleado con criterios objetivos y comentarios constructivos
        </p>
      </div>

      <Suspense fallback={<EvaluacionFormSkeleton />}>
        <NuevaEvaluacionForm />
      </Suspense>
    </div>
  )
}
