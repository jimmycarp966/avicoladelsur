'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRealtime } from '@/lib/hooks/useRealtime'
import { toast } from 'sonner'

interface MovimientosRealtimeProps {
  cajaId?: string
}

/**
 * Componente que maneja las actualizaciones en tiempo real de movimientos de tesorería
 * Actualiza automáticamente la página cuando hay nuevos movimientos o cambios en cajas
 */
export function MovimientosRealtime({ cajaId }: MovimientosRealtimeProps) {
  const router = useRouter()

  // Realtime: Suscribirse a nuevos movimientos de caja
  useRealtime({
    table: 'tesoreria_movimientos',
    event: 'INSERT',
    filter: cajaId ? `caja_id=eq.${cajaId}` : undefined,
    onInsert: (payload) => {
      const movimiento = payload.new as any
      
      // Mostrar notificación
      toast.success('Nuevo movimiento registrado', {
        description: `${movimiento.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} de $${movimiento.monto?.toFixed(2) || '0.00'}`,
      })
      
      // Refrescar la página después de un breve delay
      setTimeout(() => {
        router.refresh()
      }, 500)
    }
  })

  // Realtime: Suscribirse a cambios en cajas (saldo actualizado)
  useRealtime({
    table: 'tesoreria_cajas',
    event: 'UPDATE',
    filter: cajaId ? `id=eq.${cajaId}` : undefined,
    onUpdate: (payload) => {
      const caja = payload.new as any
      
      // Refrescar para mostrar el nuevo saldo
      router.refresh()
    }
  })

  // Realtime: Suscribirse a cambios en entregas (cuando se valida un cobro)
  useRealtime({
    table: 'entregas',
    event: 'UPDATE',
    onUpdate: (payload) => {
      const entrega = payload.new as any
      
      // Si se validó un pago, refrescar para mostrar el nuevo movimiento
      if (entrega.pago_validado) {
        router.refresh()
      }
    }
  })

  return null // Este componente no renderiza nada, solo maneja Realtime
}

