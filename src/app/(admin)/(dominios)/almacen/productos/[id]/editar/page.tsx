import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { NuevoProductoForm } from '@/app/(admin)/(dominios)/almacen/productos/nuevo/producto-form'
import { ProductoFormSkeleton } from '@/app/(admin)/(dominios)/almacen/productos/nuevo/producto-form-skeleton'
// import { getProductoById } from '@/actions/almacen.actions' // TODO: Implementar cuando esté disponible

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

  // En producción, esto sería una llamada real a la base de datos
  // const producto = await getProductoById(productoId)
  // if (!producto) notFound()

  // Datos de ejemplo para desarrollo
  const productoEjemplo = {
    id: productoId,
    codigo: 'POLLO001',
    nombre: 'Pollo Entero',
    descripcion: 'Pollo entero fresco de granja',
    categoria: 'Aves',
    precio_venta: 850.00,
    precio_costo: 700.00,
    unidad_medida: 'kg',
    stock_minimo: 50,
    activo: true,
  }

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
        <NuevoProductoForm />
      </Suspense>
    </div>
  )
}
