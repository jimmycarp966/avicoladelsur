'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRealtime } from '@/lib/hooks/useRealtime'
import { toast } from 'sonner'

interface TransferenciasRealtimeProps {
  sucursalId: string
}

/**
 * Componente que maneja las actualizaciones en tiempo real de transferencias entre sucursales
 * Actualiza automáticamente la página cuando hay cambios de estado en transferencias
 */
export function TransferenciasRealtime({ sucursalId }: TransferenciasRealtimeProps) {
  const router = useRouter()

  // Realtime: Suscribirse a cambios en transferencias de stock
  useRealtime({
    table: 'transferencias_stock',
    event: '*',
    filter: `sucursal_origen_id=eq.${sucursalId},sucursal_destino_id=eq.${sucursalId}`,
    onInsert: (payload) => {
      const transferencia = payload.new as any
      
      // Mostrar notificación según el tipo de transferencia
      if (transferencia.sucursal_origen_id === sucursalId) {
        toast.info('Nueva transferencia creada', {
          description: `Transferencia hacia otra sucursal creada`,
        })
      } else if (transferencia.sucursal_destino_id === sucursalId) {
        toast.success('Nueva transferencia recibida', {
          description: `Tienes una nueva transferencia pendiente de recepción`,
        })
      }
      
      // Refrescar la página después de un breve delay
      setTimeout(() => {
        router.refresh()
      }, 500)
    },
    onUpdate: (payload) => {
      const transferencia = payload.new as any
      const estadoAnterior = payload.old?.estado
      const estadoNuevo = transferencia.estado
      
      // Mostrar notificaciones según el cambio de estado
      if (estadoAnterior !== estadoNuevo) {
        if (transferencia.sucursal_origen_id === sucursalId) {
          // Transferencia saliente
          if (estadoNuevo === 'aprobada') {
            toast.success('Transferencia aprobada', {
              description: `Tu transferencia ha sido aprobada`,
            })
          } else if (estadoNuevo === 'en_transito') {
            toast.info('Transferencia en tránsito', {
              description: `La transferencia está en camino`,
            })
          } else if (estadoNuevo === 'recibida') {
            toast.success('Transferencia recibida', {
              description: `La transferencia ha sido recibida en destino`,
            })
          }
        } else if (transferencia.sucursal_destino_id === sucursalId) {
          // Transferencia entrante
          if (estadoNuevo === 'en_transito') {
            toast.warning('Transferencia en camino', {
              description: `Una transferencia está en camino hacia tu sucursal`,
            })
          } else if (estadoNuevo === 'recibida') {
            toast.success('Transferencia recibida', {
              description: `La transferencia ha sido marcada como recibida`,
            })
          }
        }
      }
      
      // Refrescar la página para mostrar el cambio
      router.refresh()
    }
  })

  return null // Este componente no renderiza nada, solo maneja Realtime
}

