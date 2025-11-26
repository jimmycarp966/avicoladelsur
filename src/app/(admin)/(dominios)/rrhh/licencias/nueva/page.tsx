import { Suspense } from 'react'
import { NuevaLicenciaForm } from './licencia-form'
import { LicenciaFormSkeleton } from './licencia-form-skeleton'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Nueva Licencia - Avícola del Sur ERP',
  description: 'Crear nueva solicitud de licencia para empleado',
}

export default function NuevaLicenciaPage() {
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
        <h1 className="text-3xl font-bold tracking-tight">Nueva Licencia</h1>
        <p className="text-muted-foreground mt-1">
          Solicitar licencia o descanso para un empleado
        </p>
      </div>

      <Suspense fallback={<LicenciaFormSkeleton />}>
        <NuevaLicenciaForm />
      </Suspense>
    </div>
  )
}
