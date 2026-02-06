'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRealtime } from '@/lib/hooks/useRealtime'
import { toast } from 'sonner'
import { useSoundAlert } from '@/components/ui/sound-alert'
import { devLog } from '@/lib/utils/logger'

interface EnPreparacionRealtimeProps {
  zonaId?: string
  turno?: string
}

/**
 * Componente que maneja las actualizaciones en tiempo real de presupuestos en preparación
 *
 * - Se suscribe a INSERT en presupuestos con estado en_almacen
 * - Reproduce un sonido (doble beep) cuando llega un nuevo presupuesto
 * - Muestra una notificación toast con información del presupuesto
 * - Refresca automáticamente la página después de un breve delay
 *
 * Este componente no renderiza nada visualmente, solo maneja la lógica de realtime.
 */
export function EnPreparacionRealtime({ zonaId, turno }: EnPreparacionRealtimeProps) {
  const router = useRouter()
  const { playNotification } = useSoundAlert(true)

  // Suscribirse a INSERT de nuevos presupuestos en estado en_almacen
  useRealtime({
    table: 'presupuestos',
    event: 'INSERT',
    filter: `estado=eq.en_almacen`,
    onInsert: (payload) => {
      const presupuesto = payload.new as any

      devLog('[EnPreparacionRealtime] Nuevo presupuesto detectado:', presupuesto)

      // Verificar si el presupuesto coincide con los filtros opcionales
      if (zonaId && presupuesto.zona_id !== zonaId) {
        devLog('[EnPreparacionRealtime] Presupuesto filtrado por zona:', presupuesto.zona_id, 'esperado:', zonaId)
        return
      }

      if (turno && presupuesto.turno !== turno) {
        devLog('[EnPreparacionRealtime] Presupuesto filtrado por turno:', presupuesto.turno, 'esperado:', turno)
        return
      }

      // Reproducir sonido de notificación
      playNotification()

      // Mostrar notificación visual
      toast.success('¡Nuevo presupuesto para preparar!', {
        description: `#${presupuesto.numero_presupuesto || presupuesto.id?.substring(0, 8)} - ${presupuesto.turno || ''}`,
        duration: 5000,
        action: {
          label: 'Ver',
          onClick: () => router.refresh(),
        },
      })

      // Refrescar la página después de un breve delay
      // para que el usuario vea la notificación primero
      setTimeout(() => {
        router.refresh()
      }, 500)
    },
  })

  // Suscribirse a UPDATE de presupuestos (cuando se marca como listo)
  useRealtime({
    table: 'presupuestos',
    event: 'UPDATE',
    filter: `estado=eq.en_almacen&preparacion_completada=eq.true`,
    onUpdate: (payload) => {
      const presupuesto = payload.new as any

      // Verificar si coincide con los filtros
      if (zonaId && presupuesto.zona_id !== zonaId) return
      if (turno && presupuesto.turno !== turno) return

      // Si se marcó como completado, refrescar para mostrar el cambio
      if (presupuesto.preparacion_completada) {
        devLog('[EnPreparacionRealtime] Presupuesto marcado como listo:', presupuesto.numero_presupuesto)
        router.refresh()
      }
    },
  })

  return null // Componente invisible
}
