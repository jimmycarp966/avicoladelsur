'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRealtime } from '@/lib/hooks/useRealtime'
import { toast } from 'sonner'

interface AlertasStockRealtimeProps {
  sucursalId: string
}

/**
 * Componente que maneja las actualizaciones en tiempo real de alertas de stock
 * Actualiza automáticamente la página cuando hay nuevas alertas o cambios
 */
export function AlertasStockRealtime({ sucursalId }: AlertasStockRealtimeProps) {
  const router = useRouter()

  // Realtime: Suscribirse a nuevas alertas de stock
  useRealtime({
    table: 'alertas_stock',
    event: '*',
    filter: `sucursal_id=eq.${sucursalId}`,
    onInsert: (payload) => {
      const alerta = payload.new as any
      
      // Mostrar notificación push si es crítica
      if (alerta.prioridad === 'critico' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('⚠️ Alerta de Stock Crítica', {
          body: `Producto con stock crítico detectado en sucursal`,
          icon: '/images/logo-avicola.svg',
          tag: `alerta-${alerta.id}`,
        })
      }
      
      // Mostrar toast
      toast.warning('Nueva alerta de stock', {
        description: `Producto con stock bajo detectado`,
      })
      
      // Refrescar la página después de un breve delay
      setTimeout(() => {
        router.refresh()
      }, 500)
    },
    onUpdate: (payload) => {
      const alerta = payload.new as any
      
      // Si la alerta cambió de estado (resuelta), refrescar
      if (alerta.estado !== 'pendiente') {
        router.refresh()
      } else {
        // Si sigue pendiente pero cambió la prioridad, refrescar
        router.refresh()
      }
    }
  })

  // Solicitar permiso para notificaciones
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  return null // Este componente no renderiza nada, solo maneja Realtime
}

