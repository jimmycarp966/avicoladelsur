import { Metadata } from 'next'
import Link from 'next/link'

import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import PlanRutasForm from './plan-rutas-form'
import PlanRutasTable from './plan-rutas-table'
import { Calendar, History } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Planificación de Rutas',
}

// Días ordenados de lunes a domingo (índice 0 = lunes, índice 6 = domingo)
// Pero en BD: 0=domingo, 1=lunes, ..., 6=sábado
const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export default async function PlanificacionRutasPage() {
  const supabase = await createClient()

  // Calcular semana actual
  const hoy = new Date()
  const dia = hoy.getDay()
  const diff = dia === 0 ? -6 : 1 - dia
  const semanaActual = new Date(hoy)
  semanaActual.setDate(hoy.getDate() + diff)
  semanaActual.setHours(0, 0, 0, 0)
  const semanaActualStr = semanaActual.toISOString().split('T')[0]

  const [plan, zonas, repartidores] = await Promise.all([
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
          zona:zonas(nombre),
          repartidor:usuarios(nombre, apellido)
        `,
      )
      .eq('semana_inicio', semanaActualStr)
      .eq('activo', true)
      .order('dia_semana', { ascending: true })
      .order('turno', { ascending: true }),
    supabase.from('zonas').select('id, nombre').eq('activo', true).order('nombre', { ascending: true }),
    supabase
      .from('usuarios')
      .select('id, nombre, apellido')
      .eq('rol', 'repartidor')
      .eq('activo', true)
      .order('nombre', { ascending: true }),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Planificación Semanal de Rutas</h1>
          <p className="text-muted-foreground">
            Define qué zonas se visitan cada día y qué repartidor las cubre.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/reparto/planificacion/semana">
            <Button>
              <Calendar className="mr-2 h-4 w-4" />
              Calendario Semanal
            </Button>
          </Link>
          <Link href="/reparto/planificacion/historial">
            <Button variant="outline">
              <History className="mr-2 h-4 w-4" />
              Historial
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="crear" className="space-y-4">
        <TabsList>
          <TabsTrigger value="crear">Crear Planificación</TabsTrigger>
          <TabsTrigger value="actual">Semana Actual</TabsTrigger>
        </TabsList>

        <TabsContent value="crear" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Crear nueva planificación</CardTitle>
            </CardHeader>
            <CardContent>
              <PlanRutasForm
                zonas={zonas.data ?? []}
                repartidores={repartidores.data ?? []}
                diasSemana={DIAS_SEMANA}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actual" className="space-y-4">
          <PlanRutasTable plan={plan.data ?? []} diasSemana={DIAS_SEMANA} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

