import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { ProductoForm } from '@/components/forms/ProductoForm'
import { ProductoFormSkeleton } from '@/app/(admin)/(dominios)/almacen/productos/nuevo/producto-form-skeleton'
import { obtenerProductoPorId } from '@/actions/almacen.actions'

interface EditarProductoPageProps {
  params: {
    id: string
  }
}

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Editar Producto - Avícola del Sur ERP',
  description: 'Editar información del producto',
}

export default async function EditarProductoPage({ params }: EditarProductoPageProps) {
  const { id } = await params
  const productoId = id

  // Obtener el producto de la base de datos
  const result = await obtenerProductoPorId(productoId)
  
  if (!result.success || !result.data) {
    notFound()
  }

  const producto = result.data

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
        <h1 className="text-3xl font-bold tracking-tight">Editar Producto</h1>
        <p className="text-muted-foreground mt-1">
          Modifica la información del producto
        </p>
      </div>

      <Suspense fallback={<ProductoFormSkeleton />}>
        <ProductoForm producto={producto} />
      </Suspense>
    </div>
  )
}
