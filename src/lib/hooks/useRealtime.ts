'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface RealtimeSubscriptionOptions {
  table: string
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  schema?: string
  filter?: string
  onInsert?: (payload: any) => void
  onUpdate?: (payload: any) => void
  onDelete?: (payload: any) => void
  onError?: (error: Error) => void
}

/**
 * Hook reutilizable para suscribirse a cambios en tiempo real de Supabase
 * 
 * @example
 * ```tsx
 * useRealtime({
 *   table: 'presupuestos',
 *   event: '*',
 *   filter: 'estado=eq.en_almacen',
 *   onInsert: (payload) => {
 *     console.log('Nuevo presupuesto:', payload.new)
 *   },
 *   onUpdate: (payload) => {
 *     console.log('Presupuesto actualizado:', payload.new)
 *   }
 * })
 * ```
 */
export function useRealtime(options: RealtimeSubscriptionOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const channelName = `realtime-${options.table}-${Date.now()}`
    const channel = supabase.channel(channelName)

    // Configurar eventos según el tipo especificado
    const eventType = options.event || '*'
    
    if (eventType === '*' || eventType === 'INSERT') {
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: options.schema || 'public',
          table: options.table,
          filter: options.filter,
        },
        (payload) => {
          try {
            options.onInsert?.(payload)
          } catch (error) {
            console.error(`[useRealtime] Error en onInsert para ${options.table}:`, error)
            options.onError?.(error instanceof Error ? error : new Error(String(error)))
          }
        }
      )
    }

    if (eventType === '*' || eventType === 'UPDATE') {
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: options.schema || 'public',
          table: options.table,
          filter: options.filter,
        },
        (payload) => {
          try {
            options.onUpdate?.(payload)
          } catch (error) {
            console.error(`[useRealtime] Error en onUpdate para ${options.table}:`, error)
            options.onError?.(error instanceof Error ? error : new Error(String(error)))
          }
        }
      )
    }

    if (eventType === '*' || eventType === 'DELETE') {
      channel.on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: options.schema || 'public',
          table: options.table,
          filter: options.filter,
        },
        (payload) => {
          try {
            options.onDelete?.(payload)
          } catch (error) {
            console.error(`[useRealtime] Error en onDelete para ${options.table}:`, error)
            options.onError?.(error instanceof Error ? error : new Error(String(error)))
          }
        }
      )
    }

    // Suscribirse al canal
    channel.subscribe((status, err) => {
      console.log(`[useRealtime] Estado de suscripción para ${options.table}:`, status, err ? `Error: ${err.message}` : '')
      if (status === 'SUBSCRIBED') {
        console.log(`[useRealtime] ✅ Suscrito exitosamente a ${options.table}`)
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`[useRealtime] ❌ Error al suscribirse a ${options.table}:`, err)
        options.onError?.(new Error(`Error al suscribirse a ${options.table}: ${err?.message || 'Unknown error'}`))
      } else if (status === 'TIMED_OUT') {
        console.warn(`[useRealtime] ⚠️ Timeout al suscribirse a ${options.table}`)
      } else if (status === 'CLOSED') {
        console.warn(`[useRealtime] ⚠️ Canal cerrado para ${options.table}`)
      }
    })

    channelRef.current = channel

    // Cleanup: desuscribirse cuando el componente se desmonte
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
        console.log(`[useRealtime] Desuscrito de ${options.table}`)
      }
    }
  }, [
    options.table,
    options.event,
    options.schema,
    options.filter,
    // No incluir las funciones de callback en las dependencias para evitar re-suscripciones innecesarias
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ])

  // Función para desuscribirse manualmente si es necesario
  const unsubscribe = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }, [supabase])

  return { unsubscribe }
}

