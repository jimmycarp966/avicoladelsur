import { Suspense } from 'react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChecklistVehiculoForm } from './checklist-form'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Checklist Diario - Avícola del Sur ERP',
  description: 'Registrar checklist diario del vehículo',
}

interface ChecklistPageProps {
  params: Promise<{
    id: string
  }>
}

async function ChecklistContent({ vehiculoId }: { vehiculoId: string }) {
  const supabase = await createClient()

  // Obtener información del vehículo
  const { data: vehiculo, error } = await supabase
    .from('vehiculos')
    .select('id, patente, marca, modelo')
    .eq('id', vehiculoId)
    .single()

  if (error || !vehiculo) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/reparto/vehiculos">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Vehículos
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Checklist Diario</h1>
          <p className="text-muted-foreground mt-1">
            Vehículo: {vehiculo.patente} - {vehiculo.marca} {vehiculo.modelo}
          </p>
        </div>
      </div>

      <Suspense fallback={<div>Cargando formulario...</div>}>
        <ChecklistVehiculoForm vehiculoId={vehiculoId} />
      </Suspense>
    </div>
  )
}

export default async function ChecklistPage({ params }: ChecklistPageProps) {
  const { id } = await params
  return <ChecklistContent vehiculoId={id} />
}

