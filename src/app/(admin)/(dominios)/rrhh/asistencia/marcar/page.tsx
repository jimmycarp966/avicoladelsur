import { Suspense } from 'react'
import { MarcarAsistenciaForm } from './marcar-asistencia-form'
import { AsistenciaFormSkeleton } from './asistencia-form-skeleton'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Marcar Asistencia - Avícola del Sur ERP',
  description: 'Registro manual de asistencia del personal',
}

export default function MarcarAsistenciaPage() {
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
        <h1 className="text-3xl font-bold tracking-tight">Marcar Asistencia</h1>
        <p className="text-muted-foreground mt-1">
          Registro manual de entrada/salida del personal con cálculo automático de retrasos
        </p>
      </div>

      <Suspense fallback={<AsistenciaFormSkeleton />}>
        <MarcarAsistenciaForm />
      </Suspense>
    </div>
  )
}
