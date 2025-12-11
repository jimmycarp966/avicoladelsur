import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { NuevoPedidoForm } from '@/app/(admin)/(dominios)/almacen/pedidos/nuevo/pedido-form'
import { PedidoFormSkeleton } from '@/app/(admin)/(dominios)/almacen/pedidos/nuevo/pedido-form-skeleton'
// import { getPedidoById } from '@/actions/ventas.actions' // TODO: Implementar cuando esté disponible

interface EditarPedidoPageProps {
  params: Promise<{
    id: string
  }>
}

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Editar Pedido - Avícola del Sur ERP',
  description: 'Editar información del pedido',
}

export default async function EditarPedidoPage({ params }: EditarPedidoPageProps) {
  const { id } = await params
  const pedidoId = id

  // En producción, esto sería una llamada real a la base de datos
  // const pedido = await getPedidoById(pedidoId)
  // if (!pedido) notFound()

  // Datos de ejemplo para desarrollo
  const pedidoEjemplo = {
    id: pedidoId,
    numero_pedido: 'PED-2025-001',
    cliente_id: '1',
    fecha_entrega_estimada: '2025-11-05T14:00:00Z',
    observaciones: 'Pedido urgente - cliente preferencial',
    items: [
      {
        producto_id: '1',
        cantidad: 10,
        precio_unitario: 850.00,
      },
      {
        producto_id: '2',
        cantidad: 5,
        precio_unitario: 1200.00,
      },
    ],
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
        <h1 className="text-3xl font-bold tracking-tight">Editar Pedido</h1>
        <p className="text-muted-foreground mt-1">
          Modifica la información del pedido {pedidoEjemplo.numero_pedido}
        </p>
      </div>

      <Suspense fallback={<PedidoFormSkeleton />}>
        <NuevoPedidoForm />
      </Suspense>
    </div>
  )
}
