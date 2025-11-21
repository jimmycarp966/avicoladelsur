import { Suspense } from 'react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { VehiculoForm } from './vehiculo-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Nuevo Vehículo - Avícola del Sur ERP',
  description: 'Registrar un nuevo vehículo en la flota',
}

export default function NuevoVehiculoPage() {
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
          <h1 className="text-3xl font-bold tracking-tight">Nuevo Vehículo</h1>
          <p className="text-muted-foreground mt-1">
            Registra un nuevo vehículo en la flota de reparto
          </p>
        </div>
      </div>

      <Suspense fallback={<div>Cargando formulario...</div>}>
        <VehiculoForm />
      </Suspense>
    </div>
  )
}

