import { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import SemanaCard from './semana-card'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Historial de Planificaciones',
}

export default async function HistorialPlanificacionesPage() {
  const supabase = await createClient()

  // Obtener todas las semanas planificadas ordenadas por fecha descendente
  const { data: semanas, error } = await supabase
    .from('v_semanas_planificadas')
    .select('*')
    .order('semana_inicio', { ascending: false })
    .limit(50) // Limitar a las últimas 50 semanas

  if (error) {
    console.error('Error al cargar semanas:', error)
  }

  // Obtener planes detallados para cada semana
  const semanasConPlanes = await Promise.all(
    (semanas || []).map(async (semana) => {
      const { data: planes } = await supabase
        .from('plan_rutas_semanal')
        .select(
          `
          id,
          zona_id,
          dia_semana,
          turno,
          repartidor_id,
          zona:zonas(nombre),
          repartidor:usuarios(nombre, apellido)
        `,
        )
        .eq('semana_inicio', semana.semana_inicio)
        .eq('activo', true)
        .order('dia_semana', { ascending: true })
        .order('turno', { ascending: true })

      return {
        ...semana,
        planes: planes || [],
      }
    }),
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Historial de Planificaciones</h1>
        <p className="text-muted-foreground">
          Visualiza todas las semanas planificadas con sus detalles completos.
        </p>
      </div>

      {semanasConPlanes.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              No hay semanas planificadas en el historial.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {semanasConPlanes.map((semana) => (
            <SemanaCard key={semana.semana_inicio} semana={semana} />
          ))}
        </div>
      )}
    </div>
  )
}

