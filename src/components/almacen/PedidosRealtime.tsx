'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useRealtime } from '@/lib/hooks/useRealtime'
import { toast } from 'sonner'

interface PedidosRealtimeProps {
  fecha?: string
  estado?: string
}

/**
 * Componente que maneja las actualizaciones en tiempo real de la lista de pedidos
 * Actualiza automáticamente la página cuando hay cambios en pedidos
 */
export function PedidosRealtime({ fecha, estado }: PedidosRealtimeProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Construir filtro dinámico según los parámetros de búsqueda
  const fechaActual = fecha || searchParams.get('fecha') || new Date().toISOString().split('T')[0]
  const estadoFiltro = estado || searchParams.get('estado')

  // Realtime: Suscribirse a cambios en pedidos
  useRealtime({
    table: 'pedidos',
    event: '*',
    onInsert: (payload) => {
      const pedido = payload.new as any
      
      // Verificar si el pedido coincide con los filtros actuales
      const fechaPedido = pedido.fecha_entrega_estimada || pedido.created_at?.split('T')[0]
      const coincideFecha = !fechaActual || fechaPedido === fechaActual
      const coincideEstado = !estadoFiltro || pedido.estado === estadoFiltro

      if (coincideFecha && coincideEstado) {
        // Mostrar notificación y refrescar la página
        toast.success('Nuevo pedido creado', {
          description: `Pedido #${pedido.numero_pedido || pedido.id.substring(0, 8)} agregado`,
        })
        
        // Refrescar la página después de un breve delay
        setTimeout(() => {
          router.refresh()
        }, 500)
      }
    },
    onUpdate: (payload) => {
      const pedido = payload.new as any
      
      // Verificar si el pedido coincide con los filtros actuales
      const fechaPedido = pedido.fecha_entrega_estimada || pedido.created_at?.split('T')[0]
      const coincideFecha = !fechaActual || fechaPedido === fechaActual
      const coincideEstado = !estadoFiltro || pedido.estado === estadoFiltro

      if (coincideFecha && coincideEstado) {
        // Refrescar para mostrar cambios de estado, etc.
        router.refresh()
      } else if (coincideFecha && !coincideEstado) {
        // Si cambió de estado y ya no coincide con el filtro, refrescar para removerlo
        router.refresh()
      }
    }
  })

  return null // Este componente no renderiza nada, solo maneja Realtime
}

