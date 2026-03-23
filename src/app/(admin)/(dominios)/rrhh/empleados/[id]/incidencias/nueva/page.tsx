import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { getEmpleadoLegajoDni, getEmpleadoNombre } from '@/lib/utils/empleado-display'
import { NuevaIncidenciaForm } from './incidencia-form'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Nueva incidencia de legajo - Avicola del Sur ERP',
  description: 'Registrar incidencia manual dentro del legajo del empleado',
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function NuevaIncidenciaPage({ params }: PageProps) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: empleado } = await supabase
    .from('rrhh_empleados')
    .select(`
      id,
      legajo,
      dni,
      nombre,
      apellido,
      usuario:usuarios(nombre, apellido, email)
    `)
    .eq('id', id)
    .maybeSingle()

  if (!empleado) {
    notFound()
  }

  const empleadoNombre = getEmpleadoNombre(empleado)
  const empleadoIdentificacion = getEmpleadoLegajoDni(empleado)

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-lg border border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 shadow-sm">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center rounded-full border border-amber-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
            Legajo
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Registrar incidencia</h1>
          <p className="text-muted-foreground">
            Vas a registrar una incidencia manual para {empleadoNombre}. Se sincroniza directo con su legajo.
          </p>
        </div>
      </div>

      <NuevaIncidenciaForm
        empleadoId={id}
        empleadoNombre={empleadoNombre}
        empleadoIdentificacion={empleadoIdentificacion}
      />
    </div>
  )
}
