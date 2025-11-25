import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { obtenerPresupuestoAction } from '@/actions/presupuestos.actions'
import { EditarPresupuestoForm } from './editar-presupuesto-form'

interface EditarPresupuestoPageProps {
  params: {
    id: string
  }
}

async function EditarPresupuestoContent({ presupuestoId }: { presupuestoId: string }) {
  const result = await obtenerPresupuestoAction(presupuestoId)

  if (!result.success || !result.data) {
    notFound()
  }

  const presupuesto = result.data

  // Solo se puede editar si está pendiente
  if (presupuesto.estado !== 'pendiente') {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">No se puede editar este presupuesto</h2>
          <p className="text-muted-foreground mb-6">
            Solo se pueden editar presupuestos en estado "Pendiente"
          </p>
          <Button asChild>
            <Link href={`/ventas/presupuestos/${presupuestoId}`}>
              Volver al Presupuesto
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/ventas/presupuestos/${presupuestoId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al Presupuesto
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Editar Presupuesto</h1>
          <p className="text-muted-foreground">
            {presupuesto.numero_presupuesto}
          </p>
        </div>
      </div>

      <EditarPresupuestoForm presupuesto={presupuesto} />
    </div>
  )
}

export default async function EditarPresupuestoPage({ params }: EditarPresupuestoPageProps) {
  const { id } = await params
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-12 bg-gray-200 animate-pulse rounded" />
        <div className="h-96 bg-gray-200 animate-pulse rounded" />
      </div>
    }>
      <EditarPresupuestoContent presupuestoId={id} />
    </Suspense>
  )
}
