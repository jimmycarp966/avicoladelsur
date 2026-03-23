'use client'

import { useEffect, useRef } from 'react'
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
 * Componente que maneja las actualizaciones en tiempo real de presupuestos en preparación.
 *
 * Refresca la vista cuando:
 * - entra un nuevo presupuesto en_almacen
 * - cambia un presupuesto relevante
 * - se actualiza un item de pesaje
 * - un presupuesto sale de en_almacen o ya fue convertido
 */
export function EnPreparacionRealtime({ zonaId, turno }: EnPreparacionRealtimeProps) {
  const router = useRouter()
  // TEMPORALMENTE DESHABILITADO: el sonido está causando error de JavaScript
  const { playNotification, activateAudio, audioState } = useSoundAlert(false)
  const audioActivatedRef = useRef(false)

  // Activar el AudioContext en la primera interacción del usuario
  useEffect(() => {
    const tryActivateAudio = async () => {
      if (audioActivatedRef.current) return

      const success = await activateAudio()
      if (success) {
        audioActivatedRef.current = true
        console.log('[EnPreparacionRealtime] ✅ AudioContext activado')
        cleanup()
      }
    }

    const cleanup = () => {
      const events = ['click', 'keydown', 'touchstart', 'mousedown', 'pointerdown']
      events.forEach((event) => {
        document.removeEventListener(event, tryActivateAudio)
      })
    }

    const events = ['click', 'keydown', 'touchstart', 'mousedown', 'pointerdown']
    events.forEach((event) => {
      document.addEventListener(event, tryActivateAudio, { passive: true })
    })

    tryActivateAudio()

    return cleanup
  }, [activateAudio])

  useEffect(() => {
    devLog('[EnPreparacionRealtime] Componente montado - Suscribiendo a presupuestos...')
    devLog('[EnPreparacionRealtime] Estado del audio:', audioState)
  }, [audioState])

  useRealtime({
    table: 'presupuestos',
    event: '*',
    onInsert: (payload) => {
      const presupuesto = payload.new as any

      console.log('[EnPreparacionRealtime] 🔔 INSERT recibido:', presupuesto)

      if (presupuesto.estado !== 'en_almacen') {
        console.log('[EnPreparacionRealtime] ❌ Filtrado por estado:', presupuesto.estado)
        return
      }

      if (zonaId && presupuesto.zona_id !== zonaId) {
        console.log('[EnPreparacionRealtime] ❌ Filtrado por zona:', presupuesto.zona_id, 'esperado:', zonaId)
        return
      }

      if (turno && presupuesto.turno !== turno) {
        console.log('[EnPreparacionRealtime] ❌ Filtrado por turno:', presupuesto.turno, 'esperado:', turno)
        return
      }

      console.log('[EnPreparacionRealtime] ✅ Presupuesto válido - Notificando:', presupuesto.numero_presupuesto)
      playNotification()

      toast.success('¡Nuevo presupuesto para preparar!', {
        description: `#${presupuesto.numero_presupuesto || presupuesto.id?.substring(0, 8)} - ${presupuesto.turno || ''}`,
        duration: 5000,
        action: {
          label: 'Ver',
          onClick: () => router.refresh(),
        },
      })

      setTimeout(() => {
        router.refresh()
      }, 500)
    },
    onUpdate: (payload) => {
      const presupuesto = payload.new as any

      console.log('[EnPreparacionRealtime] 🔄 UPDATE recibido:', presupuesto)

      if (zonaId && presupuesto.zona_id !== zonaId) return
      if (turno && presupuesto.turno !== turno) return

      if (presupuesto.estado !== 'en_almacen' || presupuesto.pedido_convertido_id) {
        console.log('[EnPreparacionRealtime] ✅ Presupuesto removido del flujo:', presupuesto.numero_presupuesto)
        router.refresh()
        return
      }

      router.refresh()
    },
    onDelete: () => {
      router.refresh()
    },
    onError: (error) => {
      console.error('[EnPreparacionRealtime] ❌ Error en Realtime:', error)
      toast.error('Error de conexión en tiempo real', {
        description: error.message,
      })
    },
  })

  useRealtime({
    table: 'presupuesto_items',
    event: 'UPDATE',
    onUpdate: (payload) => {
      const item = payload.new as any
      if (!item?.presupuesto_id) return

      console.log('[EnPreparacionRealtime] 🔄 UPDATE item recibido:', item)
      router.refresh()
    },
    onError: (error) => {
      console.error('[EnPreparacionRealtime] ❌ Error en Realtime items:', error)
    },
  })

  return null
}
