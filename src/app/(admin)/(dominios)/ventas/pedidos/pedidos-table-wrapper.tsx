'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PedidosTable } from '@/components/tables/PedidosTable'
import { useNotificationStore } from '@/store/notificationStore'
import type { Pedido } from '@/types/domain.types'

// Datos de ejemplo - en producción vendrían de la base de datos
const pedidosEjemplo: Pedido[] = [
  {
    id: '1',
    numero_pedido: 'PED-2025-001',
    cliente_id: '1',
    fecha_pedido: '2025-11-05T10:00:00Z',
    fecha_entrega_estimada: '2025-11-05T14:00:00Z',
    estado: 'entregado',
    tipo_pedido: 'venta',
    origen: 'web',
    subtotal: 1250.00,
    descuento: 0,
    total: 1250.00,
    observaciones: 'Entrega exitosa',
    created_at: '2025-11-05T10:00:00Z',
    updated_at: '2025-11-05T14:30:00Z',
  },
  {
    id: '2',
    numero_pedido: 'PED-2025-002',
    cliente_id: '2',
    fecha_pedido: '2025-11-05T11:30:00Z',
    fecha_entrega_estimada: '2025-11-05T16:00:00Z',
    estado: 'enviado',
    tipo_pedido: 'venta',
    origen: 'web',
    subtotal: 890.50,
    descuento: 0,
    total: 890.50,
    observaciones: 'Cliente pidió embalaje especial',
    created_at: '2025-11-05T11:30:00Z',
    updated_at: '2025-11-05T15:00:00Z',
  },
  {
    id: '3',
    numero_pedido: 'PED-2025-003',
    cliente_id: '3',
    fecha_pedido: '2025-11-05T14:15:00Z',
    fecha_entrega_estimada: '2025-11-06T10:00:00Z',
    estado: 'confirmado',
    tipo_pedido: 'venta',
    origen: 'web',
    subtotal: 2100.00,
    descuento: 0,
    total: 2100.00,
    observaciones: 'Pedido urgente',
    created_at: '2025-11-05T14:15:00Z',
    updated_at: '2025-11-05T14:15:00Z',
  },
  {
    id: '4',
    numero_pedido: 'PED-2025-004',
    cliente_id: '1',
    fecha_pedido: '2025-11-05T16:45:00Z',
    fecha_entrega_estimada: '2025-11-06T12:00:00Z',
    estado: 'preparando',
    tipo_pedido: 'venta',
    origen: 'web',
    subtotal: 675.25,
    descuento: 0,
    total: 675.25,
    observaciones: undefined,
    created_at: '2025-11-05T16:45:00Z',
    updated_at: '2025-11-05T16:45:00Z',
  },
  {
    id: '5',
    numero_pedido: 'PED-2025-005',
    cliente_id: '2',
    fecha_pedido: '2025-11-04T09:30:00Z',
    fecha_entrega_estimada: '2025-11-05T11:00:00Z',
    estado: 'pendiente',
    tipo_pedido: 'venta',
    origen: 'web',
    subtotal: 450.00,
    descuento: 0,
    total: 450.00,
    observaciones: 'Cliente nuevo - verificar dirección',
    created_at: '2025-11-04T09:30:00Z',
    updated_at: '2025-11-04T09:30:00Z',
  },
]

export function PedidosTableWrapper() {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [pedidos, setPedidos] = useState<Pedido[]>(pedidosEjemplo)

  const handleView = (pedido: Pedido) => {
    router.push(`/ventas/pedidos/${pedido.id}`)
  }

  const handleEdit = (pedido: Pedido) => {
    router.push(`/ventas/pedidos/${pedido.id}/editar`)
  }

  const handleDelete = async (pedido: Pedido) => {
    if (confirm(`¿Estás seguro de que quieres cancelar el pedido ${pedido.numero_pedido}?`)) {
      try {
        // En producción, esto sería una llamada real a la API
        setPedidos(prev => prev.map(p =>
          p.id === pedido.id ? { ...p, estado: 'cancelado' } : p
        ))
        showToast('success', `Pedido ${pedido.numero_pedido} cancelado exitosamente`)
      } catch (error) {
        showToast('error', 'Error al cancelar pedido')
      }
    }
  }

  const handleDeliver = async (pedido: Pedido) => {
    try {
      // En producción, esto sería una llamada real a la API
      setPedidos(prev => prev.map(p =>
        p.id === pedido.id ? { ...p, estado: 'entregado', fecha_entrega_real: new Date().toISOString() } : p
      ))
      showToast('success', `Pedido ${pedido.numero_pedido} marcado como entregado`)
    } catch (error) {
      showToast('error', 'Error al marcar pedido como entregado')
    }
  }

  const handlePrint = (pedido: Pedido) => {
    // Simulación de impresión
    window.print()
    showToast('info', `Imprimiendo pedido ${pedido.numero_pedido}`)
  }

  return (
    <PedidosTable
      data={pedidos}
      onView={handleView}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onDeliver={handleDeliver}
      onPrint={handlePrint}
    />
  )
}
