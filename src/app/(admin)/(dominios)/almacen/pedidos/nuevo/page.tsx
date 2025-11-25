import { Suspense } from 'react'
import { NuevoPedidoForm } from './pedido-form'
import { PedidoFormSkeleton } from './pedido-form-skeleton'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Nuevo Pedido - Avícola del Sur ERP',
  description: 'Crear un nuevo pedido en el sistema',
}

export default function NuevoPedidoPage() {
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
        <h1 className="text-3xl font-bold tracking-tight">Nuevo Pedido</h1>
        <p className="text-muted-foreground mt-1">
          Crea un nuevo pedido para un cliente
        </p>
      </div>

      <Suspense fallback={<PedidoFormSkeleton />}>
        <NuevoPedidoForm />
      </Suspense>
    </div>
  )
}
