import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { EditarVehiculoForm } from './editar-vehiculo-form'
import { obtenerVehiculoPorId } from '@/actions/reparto.actions'
import { Loader2 } from 'lucide-react'

interface EditarVehiculoPageProps {
  params: {
    id: string
  }
}

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Editar Vehículo - Avícola del Sur ERP',
  description: 'Editar información del vehículo',
}

async function EditarVehiculoContent({ vehiculoId }: { vehiculoId: string }) {
  const result = await obtenerVehiculoPorId(vehiculoId)

  if (!result.success || !result.data) {
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
          <h1 className="text-3xl font-bold tracking-tight">Editar Vehículo</h1>
          <p className="text-muted-foreground mt-1">
            Modifica la información del vehículo
          </p>
        </div>
      </div>

      <Suspense fallback={
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2">Cargando formulario...</span>
        </div>
      }>
        <EditarVehiculoForm vehiculoId={vehiculoId} />
      </Suspense>
    </div>
  )
}

export default async function EditarVehiculoPage({ params }: EditarVehiculoPageProps) {
  return (
    <EditarVehiculoContent vehiculoId={params.id} />
  )
}

