import { Suspense } from 'react'
import { ReportesRRHHForm } from './reportes-rrhh-form'
import { ReportesFormSkeleton } from './reportes-form-skeleton'

export const revalidate = 3600 // Revalida cada hora

export const metadata = {
  title: 'Reportes RRHH - Avícola del Sur ERP',
  description: 'Generar reportes de personal, sueldos, evaluaciones y asistencia',
}

export default function ReportesRRHHPage() {
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
        <h1 className="text-3xl font-bold tracking-tight">Reportes de Recursos Humanos</h1>
        <p className="text-muted-foreground mt-1">
          Genera reportes detallados de personal, liquidaciones, evaluaciones y asistencia
        </p>
      </div>

      <Suspense fallback={<ReportesFormSkeleton />}>
        <ReportesRRHHForm />
      </Suspense>
    </div>
  )
}
