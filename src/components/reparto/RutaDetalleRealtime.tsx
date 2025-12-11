'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRealtime } from '@/lib/hooks/useRealtime'
import { toast } from 'sonner'

interface RutaDetalleRealtimeProps {
  rutaId: string
}

/**
 * Componente que maneja las actualizaciones en tiempo real del detalle de ruta
 * Actualiza automáticamente la página cuando hay cambios en entregas o estado de ruta
 */
export function RutaDetalleRealtime({ rutaId }: RutaDetalleRealtimeProps) {
  const router = useRouter()

  // Realtime: Suscribirse a cambios en entregas de esta ruta
  useRealtime({
    table: 'entregas',
    event: 'UPDATE',
    filter: `pedido_id=in.(SELECT id FROM pedidos WHERE ruta_id=eq.${rutaId})`,
    onUpdate: (payload) => {
      const entrega = payload.new as any
      
      // Mostrar notificación cuando cambia el estado de una entrega
      if (entrega.estado_entrega === 'entregado') {
        toast.success('Entrega completada', {
          description: `Entrega marcada como entregada`,
        })
      }
      
      // Refrescar la página para mostrar el cambio
      router.refresh()
    }
  })

  // Realtime: Suscribirse a cambios en detalles_ruta (estado de entrega, pago, etc.)
  useRealtime({
    table: 'detalles_ruta',
    event: 'UPDATE',
    filter: `ruta_id=eq.${rutaId}`,
    onUpdate: (payload) => {
      const detalle = payload.new as any
      
      // Si cambió el estado de entrega o el pago, refrescar
      router.refresh()
    }
  })

  // Realtime: Suscribirse a cambios en la ruta (estado, validación, etc.)
  useRealtime({
    table: 'rutas_reparto',
    event: 'UPDATE',
    filter: `id=eq.${rutaId}`,
    onUpdate: (payload) => {
      const ruta = payload.new as any
      
      // Si la ruta cambió de estado (completada, validada, etc.), refrescar
      if (ruta.estado === 'completada') {
        toast.success('Ruta completada', {
          description: `La ruta ha sido marcada como completada`,
        })
      }
      
      if (ruta.validada_por_tesorero) {
        toast.success('Ruta validada', {
          description: `La ruta ha sido validada por tesorería`,
        })
      }
      
      router.refresh()
    }
  })

  return null // Este componente no renderiza nada, solo maneja Realtime
}

