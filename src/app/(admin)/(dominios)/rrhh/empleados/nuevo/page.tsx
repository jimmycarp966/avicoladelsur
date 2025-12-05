import { Suspense } from 'react'
import { NuevoEmpleadoForm } from './empleado-form'
import { EmpleadoFormSkeleton } from './empleado-form-skeleton'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Nuevo Empleado - Avícola del Sur ERP',
  description: 'Crear un nuevo empleado en el sistema RRHH',
}

export default function NuevoEmpleadoPage() {
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
        <h1 className="text-3xl font-bold tracking-tight">Nuevo Empleado</h1>
        <p className="text-muted-foreground mt-1">
          Agrega un nuevo empleado al sistema de Recursos Humanos
        </p>
      </div>

      <Suspense fallback={<EmpleadoFormSkeleton />}>
        <NuevoEmpleadoForm />
      </Suspense>
    </div>
  )
}
