import { Suspense } from 'react'
import { NuevaNovedadForm } from './novedad-form'
import { NovedadFormSkeleton } from './novedad-form-skeleton'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Nueva Novedad - Avícola del Sur ERP',
  description: 'Crear nueva novedad para comunicación interna',
}

export default function NuevaNovedadPage() {
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
        <h1 className="text-3xl font-bold tracking-tight">Nueva Novedad</h1>
        <p className="text-muted-foreground mt-1">
          Crear una nueva comunicación para el personal
        </p>
      </div>

      <Suspense fallback={<NovedadFormSkeleton />}>
        <NuevaNovedadForm />
      </Suspense>
    </div>
  )
}
