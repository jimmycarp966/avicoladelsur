import { Metadata } from 'next'

import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PlanRutasForm from './plan-rutas-form'
import PlanRutasTable from './plan-rutas-table'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Planificación de Rutas',
}

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default async function PlanificacionRutasPage() {
  const supabase = await createClient()

  const [plan, zonas, vehiculos, repartidores] = await Promise.all([
    supabase
      .from('plan_rutas_semanal')
      .select(
        `
          id,
          zona_id,
          dia_semana,
          turno,
          vehiculo_id,
          repartidor_id,
          zona:zonas(nombre),
          vehiculo:vehiculos(patente, marca, modelo, capacidad_kg),
          repartidor:usuarios(nombre, apellido)
        `,
      )
      .order('dia_semana', { ascending: true })
      .order('turno', { ascending: true }),
    supabase.from('zonas').select('id, nombre').eq('activo', true).order('nombre', { ascending: true }),
    supabase
      .from('vehiculos')
      .select('id, patente, marca, modelo, capacidad_kg')
      .eq('activo', true)
      .order('patente', { ascending: true })
      .then(({ data, error }) => ({
        data: data?.map(v => ({ ...v, nombre: v.patente })),
        error
      })),
    supabase
      .from('usuarios')
      .select('id, nombre, apellido')
      .eq('rol', 'repartidor')
      .eq('activo', true)
      .order('nombre', { ascending: true }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Planificación Semanal de Rutas</h1>
        <p className="text-muted-foreground">Define qué zonas se visitan cada día y qué vehículo/repartidor las cubre.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Crear nueva planificación</CardTitle>
        </CardHeader>
        <CardContent>
          <PlanRutasForm
            zonas={zonas.data ?? []}
            vehiculos={vehiculos.data ?? []}
            repartidores={repartidores.data ?? []}
            diasSemana={DIAS_SEMANA}
          />
        </CardContent>
      </Card>

      <PlanRutasTable plan={plan.data ?? []} diasSemana={DIAS_SEMANA} />
    </div>
  )
}

