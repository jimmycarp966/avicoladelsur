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

  // Log al montar el componente
  useEffect(() => {
    devLog('[EnPreparacionRealtime] Componente montado - Suscribiendo a presupuestos...')
  }, [])

  // Suscribirse a INSERT de nuevos presupuestos
  // NOTA: No usamos filtro aquí porque Supabase Realtime puede no filtrar correctamente
  // en el momento del INSERT. Filtramos en el código.
  useRealtime({
    table: 'presupuestos',
    event: 'INSERT',
    onInsert: (payload) => {
      const presupuesto = payload.new as any

      console.log('[EnPreparacionRealtime] 🔔 INSERT recibido:', presupuesto)

      // Filtrar por estado en_almacen
      if (presupuesto.estado !== 'en_almacen') {
        console.log('[EnPreparacionRealtime] ❌ Filtrado por estado:', presupuesto.estado)
        return
      }

      // Verificar si el presupuesto coincide con los filtros opcionales
      if (zonaId && presupuesto.zona_id !== zonaId) {
        console.log('[EnPreparacionRealtime] ❌ Filtrado por zona:', presupuesto.zona_id, 'esperado:', zonaId)
        return
      }

      if (turno && presupuesto.turno !== turno) {
        console.log('[EnPreparacionRealtime] ❌ Filtrado por turno:', presupuesto.turno, 'esperado:', turno)
        return
      }

      console.log('[EnPreparacionRealtime] ✅ Presupuesto válido - Notificando:', presupuesto.numero_presupuesto)

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
      setTimeout(() => {
        router.refresh()
      }, 500)
    },
  })

  // Suscribirse a UPDATE de presupuestos (cuando se marca como listo)
  useRealtime({
    table: 'presupuestos',
    event: 'UPDATE',
    onUpdate: (payload) => {
      const presupuesto = payload.new as any
      console.log('[EnPreparacionRealtime] 🔄 UPDATE recibido:', presupuesto)

      // Verificar si coincide con los filtros
      if (zonaId && presupuesto.zona_id !== zonaId) return
      if (turno && presupuesto.turno !== turno) return

      // Si se marcó como completado, refrescar para mostrar el cambio
      if (presupuesto.preparacion_completada) {
        console.log('[EnPreparacionRealtime] ✅ Presupuesto marcado como listo:', presupuesto.numero_presupuesto)
        router.refresh()
      }
    },
  })

  return null // Componente invisible
}
