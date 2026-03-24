import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { getEmpleadoLegajoDni, getEmpleadoNombre } from '@/lib/utils/empleado-display'
import { NuevaIncidenciaForm } from './incidencia-form'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Nueva medida disciplinaria - Avicola del Sur ERP',
  description: 'Registrar medida disciplinaria con documento dentro del legajo del empleado',
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

  const empleadoDisplay = {
    ...empleado,
    usuario: Array.isArray(empleado.usuario) ? empleado.usuario[0] : empleado.usuario,
  }

  const empleadoNombre = getEmpleadoNombre(empleadoDisplay)
  const empleadoIdentificacion = getEmpleadoLegajoDni(empleadoDisplay)

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-lg border border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 shadow-sm">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center rounded-full border border-amber-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
            Legajo
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Registrar medida disciplinaria</h1>
          <p className="text-muted-foreground">
            Vas a registrar una medida para {empleadoNombre}. Se guarda en su legajo y genera el documento para firma.
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
