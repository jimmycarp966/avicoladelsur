'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRealtime } from '@/lib/hooks/useRealtime'
import { toast } from 'sonner'

interface PresupuestosDiaRealtimeProps {
  fecha: string
  zonaId?: string
  turno?: string
}

/**
 * Componente que maneja las actualizaciones en tiempo real de presupuestos del día
 * Actualiza automáticamente la página cuando hay cambios
 */
export function PresupuestosDiaRealtime({
  fecha,
  zonaId,
  turno,
}: PresupuestosDiaRealtimeProps) {
  const router = useRouter()

  // Realtime: Suscribirse a cambios en presupuestos con estado en_almacen
  useRealtime({
    table: 'presupuestos',
    event: '*',
    filter: `estado=eq.en_almacen`,
    onInsert: (payload) => {
      const presupuesto = payload.new as any
      
      // Verificar si el presupuesto coincide con los filtros actuales
      const fechaPresupuesto = presupuesto.fecha_entrega_estimada
      const coincideFecha = !fecha || fechaPresupuesto === fecha
      const coincideZona = !zonaId || presupuesto.zona_id === zonaId
      const coincideTurno = !turno || presupuesto.turno === turno

      if (coincideFecha && coincideZona && coincideTurno) {
        // Mostrar notificación y refrescar la página
        toast.success('Nuevo presupuesto disponible', {
          description: `Presupuesto #${presupuesto.numero_presupuesto || presupuesto.id.substring(0, 8)} agregado`,
        })
        
        // Refrescar la página después de un breve delay para que el usuario vea la notificación
        setTimeout(() => {
          router.refresh()
        }, 500)
      }
    },
    onUpdate: (payload) => {
      const presupuesto = payload.new as any
      
      // Si el presupuesto cambió de estado (ya no está en_almacen), refrescar
      if (presupuesto.estado !== 'en_almacen') {
        router.refresh()
        return
      }

      // Verificar si el presupuesto coincide con los filtros actuales
      const fechaPresupuesto = presupuesto.fecha_entrega_estimada
      const coincideFecha = !fecha || fechaPresupuesto === fecha
      const coincideZona = !zonaId || presupuesto.zona_id === zonaId
      const coincideTurno = !turno || presupuesto.turno === turno

      if (coincideFecha && coincideZona && coincideTurno) {
        // Refrescar la página para mostrar cambios (pesaje, etc.)
        router.refresh()
      }
    },
    onDelete: () => {
      // Si se elimina un presupuesto, refrescar
      router.refresh()
    }
  })

  // Realtime: Suscribirse a cambios en items de presupuestos (pesaje)
  useRealtime({
    table: 'presupuesto_items',
    event: 'UPDATE',
    onUpdate: (payload) => {
      const item = payload.new as any
      
      // Si se actualizó el peso final, refrescar para mostrar el cambio
      if (item.peso_final) {
        router.refresh()
      }
    }
  })

  return null // Este componente no renderiza nada, solo maneja Realtime
}

