import { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import CalendarioSemanalWrapper from './calendario-wrapper'
import SelectorSemana from './selector-semana'
import ValidarSemanaButton from './validar-semana-button'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Planificación Semanal',
}

// Función helper para calcular inicio de semana (lunes)
function calcularInicioSemana(fecha: Date): Date {
  const dia = fecha.getDay()
  const diff = dia === 0 ? -6 : 1 - dia
  const lunes = new Date(fecha)
  lunes.setDate(fecha.getDate() + diff)
  lunes.setHours(0, 0, 0, 0)
  return lunes
}

export default async function PlanificacionSemanaPage({
  searchParams,
}: {
  searchParams: { semana?: string }
}) {
  const supabase = await createClient()

  // Determinar semana a mostrar
  let semanaInicio: Date
  if (searchParams.semana) {
    semanaInicio = new Date(searchParams.semana)
    if (isNaN(semanaInicio.getTime())) {
      semanaInicio = calcularInicioSemana(new Date())
    } else {
      semanaInicio = calcularInicioSemana(semanaInicio)
    }
  } else {
    semanaInicio = calcularInicioSemana(new Date())
  }

  const semanaInicioStr = semanaInicio.toISOString().split('T')[0]

  // Obtener datos necesarios
  const [planesResult, zonas, repartidores] = await Promise.all([
    supabase
      .from('plan_rutas_semanal')
      .select(
        `
        id,
        zona_id,
        dia_semana,
        turno,
        repartidor_id,
        semana_inicio,
        zonas!plan_rutas_semanal_zona_id_fkey(nombre),
        usuarios!plan_rutas_semanal_repartidor_id_fkey(nombre, apellido)
      `,
      )
      .eq('semana_inicio', semanaInicioStr)
      .eq('activo', true)
      .order('dia_semana', { ascending: true })
      .order('turno', { ascending: true }),
    supabase
      .from('zonas')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre', { ascending: true }),
    supabase
      .from('usuarios')
      .select('id, nombre, apellido')
      .eq('rol', 'repartidor')
      .eq('activo', true)
      .order('nombre', { ascending: true }),
  ])

  // Transformar planes para que coincidan con el tipo esperado
  const planes = (planesResult.data || []).map((plan: any) => ({
    ...plan,
    zonas: Array.isArray(plan.zonas) ? plan.zonas[0] : plan.zonas,
    usuarios: Array.isArray(plan.usuarios) ? plan.usuarios[0] : plan.usuarios,
  }))

  if (planesResult.error) {
    console.error('Error al cargar planes:', planesResult.error)
  }

  if (zonas.error) {
    console.error('Error al cargar zonas:', zonas.error)
  }

  if (repartidores.error) {
    console.error('Error al cargar repartidores:', repartidores.error)
  }

  const semanaFin = new Date(semanaInicio)
  semanaFin.setDate(semanaInicio.getDate() + 6)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Planificación Semanal</h1>
        <p className="text-muted-foreground">
          Planifica las rutas de la semana seleccionada. Haz clic en una celda para crear o editar un plan.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Semana del {semanaInicio.toLocaleDateString('es-AR')} al {semanaFin.toLocaleDateString('es-AR')}</CardTitle>
            <div className="flex items-center gap-2">
              <SelectorSemana semanaInicio={semanaInicioStr} />
              <ValidarSemanaButton semanaInicio={semanaInicioStr} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <CalendarioSemanalWrapper
            semanaInicio={semanaInicioStr}
            planes={planes}
            zonas={zonas.data || []}
            repartidores={repartidores.data || []}
          />
        </CardContent>
      </Card>
    </div>
  )
}

