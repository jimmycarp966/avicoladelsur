import { Suspense } from 'react'
import { NuevaLicenciaForm } from './licencia-form'
import { LicenciaFormSkeleton } from './licencia-form-skeleton'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Nueva Licencia - Avícola del Sur ERP',
  description: 'Crear nueva solicitud de licencia para empleado',
}

type PageProps = {
  searchParams?: Promise<{ tipo?: string }>
}

export default async function NuevaLicenciaPage({ searchParams }: PageProps) {
  const params = (await searchParams) || {}
  const esVacaciones = params.tipo === 'vacaciones'

  return (
    <div className="space-y-6">
      <div
        className={`relative overflow-hidden rounded-lg border p-6 shadow-sm ${
          esVacaciones
            ? 'border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-teal-50'
            : 'border-primary/10 bg-gradient-to-br from-primary/5 via-white to-secondary/5'
        }`}
      >
        <div
          className={`absolute top-0 right-0 h-64 w-64 rounded-full blur-3xl -z-10 ${
            esVacaciones ? 'bg-emerald-100/50' : 'bg-primary/5'
          }`}
        />
        <div className="max-w-3xl space-y-3">
          <div
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
              esVacaciones
                ? 'border-emerald-200 bg-white/80 text-emerald-700'
                : 'border-primary/15 bg-white/80 text-primary'
            }`}
          >
            {esVacaciones ? 'Vacaciones' : 'Licencias'}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            {esVacaciones ? 'Programar vacaciones' : 'Nueva Licencia'}
          </h1>
          <p className="text-muted-foreground">
            {esVacaciones
              ? 'Alta rápida: solo necesitamos fechas y observaciones. No hace falta certificado, diagnóstico ni control 24h.'
              : 'Solicitar licencia o descanso para un empleado.'}
          </p>
        </div>
      </div>

      <Suspense fallback={<LicenciaFormSkeleton />}>
        <NuevaLicenciaForm defaultTipo={esVacaciones ? 'vacaciones' : undefined} />
      </Suspense>
    </div>
  )
}
