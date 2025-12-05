import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { Scale } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { obtenerPresupuestoAction } from '@/actions/presupuestos.actions'
import { PesajeSkeleton } from './pesaje-skeleton'
import { PesajeForm } from '@/components/almacen/PesajeForm'

interface PesajePageProps {
  params: {
    id: string
  }
}

async function PesajeContent({ presupuestoId }: { presupuestoId: string }) {
  const result = await obtenerPresupuestoAction(presupuestoId)

  if (!result.success || !result.data) {
    notFound()
  }

  const presupuesto = result.data

  // Helper para determinar si un item es pesable
  function esItemPesable(item: any): boolean {
    // Primero verificar el campo pesable del item
    if (item.pesable === true) {
      return true
    }
    // Si no está marcado como pesable, verificar la categoría del producto
    // Esto es un respaldo por si el campo 'pesable' no se setea correctamente al crear el presupuesto
    return (
      item.producto?.categoria &&
      typeof item.producto.categoria === 'string' &&
      item.producto.categoria.toUpperCase().trim() === 'BALANZA'
    )
  }

  // Filtrar solo items pesables
  const itemsPesables = presupuesto.items?.filter((item: any) => esItemPesable(item)) || []

  if (itemsPesables.length === 0) {
    return (
      <div className="text-center py-8">
        <Scale className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No hay items pesables</h3>
        <p className="text-muted-foreground">
          Este presupuesto no tiene productos que requieran pesaje
        </p>
        <Button asChild className="mt-4">
          <Link href={`/ventas/presupuestos/${presupuestoId}`}>
            Volver al Presupuesto
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <PesajeForm
      presupuesto={presupuesto}
      itemsPesables={itemsPesables}
      presupuestoId={presupuestoId}
    />
  )
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PesajePage({ params }: PesajePageProps) {
  // En Next.js 16, params es una Promise y debe ser await
  const { id } = await params
  return (
    <Suspense fallback={<PesajeSkeleton />}>
      <PesajeContent presupuestoId={id} />
    </Suspense>
  )
}
