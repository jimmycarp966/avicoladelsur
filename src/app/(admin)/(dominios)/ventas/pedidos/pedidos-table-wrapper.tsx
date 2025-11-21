'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PedidosTable } from '@/components/tables/PedidosTable'
import { useNotificationStore } from '@/store/notificationStore'
import { obtenerPedidos } from '@/actions/ventas.actions'
import type { Pedido } from '@/types/domain.types'

export function PedidosTableWrapper() {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)

  // Cargar pedidos desde la base de datos
  useEffect(() => {
    loadPedidos()
  }, [])

  const loadPedidos = async () => {
    try {
      setLoading(true)
      const result = await obtenerPedidos()
      if (result.success && result.data) {
        setPedidos(result.data as Pedido[])
      } else {
        showToast('error', result.error || 'Error al cargar pedidos')
        setPedidos([])
      }
    } catch (error) {
      console.error('Error cargando pedidos:', error)
      showToast('error', 'Error al cargar pedidos')
      setPedidos([])
    } finally {
      setLoading(false)
    }
  }

  const handleView = (pedido: Pedido) => {
    router.push(`/ventas/pedidos/${pedido.id}`)
  }

  const handleEdit = (pedido: Pedido) => {
    router.push(`/ventas/pedidos/${pedido.id}/editar`)
  }

  const handleDelete = async (pedido: Pedido) => {
    if (confirm(`¿Estás seguro de que quieres cancelar el pedido ${pedido.numero_pedido}?`)) {
      try {
        const { actualizarEstadoPedido } = await import('@/actions/ventas.actions')
        const result = await actualizarEstadoPedido(pedido.id, 'cancelado')
        if (result.success) {
          await loadPedidos()
          showToast('success', result.message || `Pedido ${pedido.numero_pedido} cancelado exitosamente`)
        } else {
          showToast('error', result.error || 'Error al cancelar pedido')
        }
      } catch (error: any) {
        console.error('Error al cancelar pedido:', error)
        showToast('error', error.message || 'Error al cancelar pedido')
      }
    }
  }

  const handleDeliver = async (pedido: Pedido) => {
    try {
      const { actualizarEstadoPedido } = await import('@/actions/ventas.actions')
      const result = await actualizarEstadoPedido(pedido.id, 'entregado')
      if (result.success) {
        await loadPedidos()
        showToast('success', result.message || `Pedido ${pedido.numero_pedido} marcado como entregado`)
      } else {
        showToast('error', result.error || 'Error al marcar pedido como entregado')
      }
    } catch (error: any) {
      console.error('Error al marcar pedido como entregado:', error)
      showToast('error', error.message || 'Error al marcar pedido como entregado')
    }
  }

  const handlePrint = (pedido: Pedido) => {
    // Simulación de impresión
    window.print()
    showToast('info', `Imprimiendo pedido ${pedido.numero_pedido}`)
  }

  if (loading) {
    return <div className="text-center py-8">Cargando pedidos...</div>
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
