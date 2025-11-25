import { Suspense } from 'react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MantenimientoVehiculoForm } from './mantenimiento-form'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Programar Mantenimiento - Avícola del Sur ERP',
  description: 'Programar mantenimiento para el vehículo',
}

interface MantenimientoPageProps {
  params: {
    id: string
  }
}

async function MantenimientoContent({ vehiculoId }: { vehiculoId: string }) {
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
          <h1 className="text-3xl font-bold tracking-tight">Programar Mantenimiento</h1>
          <p className="text-muted-foreground mt-1">
            Vehículo: {vehiculo.patente} - {vehiculo.marca} {vehiculo.modelo}
          </p>
        </div>
      </div>

      <Suspense fallback={<div>Cargando formulario...</div>}>
        <MantenimientoVehiculoForm vehiculoId={vehiculoId} />
      </Suspense>
    </div>
  )
}

export default async function MantenimientoPage({ params }: MantenimientoPageProps) {
  const { id } = await params
  return <MantenimientoContent vehiculoId={id} />
}

