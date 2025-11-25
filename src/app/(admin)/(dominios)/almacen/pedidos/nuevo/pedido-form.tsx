'use client'

import { PedidoForm } from '@/components/forms/PedidoForm'

export function NuevoPedidoForm() {
  return <PedidoForm onSuccess={() => window.location.href = '/almacen/pedidos'} />
}