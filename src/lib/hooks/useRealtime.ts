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

  // Usar una ref para las opciones de callback para evitar re-suscripciones
  const optionsRef = useRef(options)

  // Actualizar la ref cuando cambian las opciones (excepto para causar re-subscripciones)
  useEffect(() => {
    optionsRef.current = options
  })

  // Extraer las propiedades que afectan la configuración de la suscripción
  const { table, event, schema, filter } = options

  useEffect(() => {
    // Crear un nombre de canal único que incluya tabla, evento y filtro
    // Esto evita conflictos cuando hay múltiples suscripciones a la misma tabla
    const filterSuffix = filter ? `-${filter.replace(/[^a-zA-Z0-9]/g, '')}` : ''
    const channelName = `realtime-${table}-${event || 'all'}${filterSuffix}-${Date.now()}`
    const channel = supabase.channel(channelName)

    // Configurar eventos según el tipo especificado
    const eventType = event || '*'

    // Crear configuración base para postgres_changes
    const baseConfig = {
      schema: schema || 'public',
      table,
    }

    if (eventType === '*' || eventType === 'INSERT') {
      const config = filter
        ? { ...baseConfig, event: 'INSERT' as const, filter }
        : { ...baseConfig, event: 'INSERT' as const }

      channel.on(
        'postgres_changes',
        config,
        (payload) => {
          try {
            optionsRef.current.onInsert?.(payload)
          } catch (error) {
            console.error(`[useRealtime] Error en onInsert para ${table}:`, error)
            optionsRef.current.onError?.(error instanceof Error ? error : new Error(String(error)))
          }
        }
      )
    }

    if (eventType === '*' || eventType === 'UPDATE') {
      const config = filter
        ? { ...baseConfig, event: 'UPDATE' as const, filter }
        : { ...baseConfig, event: 'UPDATE' as const }

      channel.on(
        'postgres_changes',
        config,
        (payload) => {
          try {
            optionsRef.current.onUpdate?.(payload)
          } catch (error) {
            console.error(`[useRealtime] Error en onUpdate para ${table}:`, error)
            optionsRef.current.onError?.(error instanceof Error ? error : new Error(String(error)))
          }
        }
      )
    }

    if (eventType === '*' || eventType === 'DELETE') {
      const config = filter
        ? { ...baseConfig, event: 'DELETE' as const, filter }
        : { ...baseConfig, event: 'DELETE' as const }

      channel.on(
        'postgres_changes',
        config,
        (payload) => {
          try {
            optionsRef.current.onDelete?.(payload)
          } catch (error) {
            console.error(`[useRealtime] Error en onDelete para ${table}:`, error)
            optionsRef.current.onError?.(error instanceof Error ? error : new Error(String(error)))
          }
        }
      )
    }

    // Suscribirse al canal
    channel.subscribe((status, err) => {
      console.log(`[useRealtime] Estado de suscripción para ${table}:`, status, err ? `Error: ${err.message}` : '')
      if (status === 'SUBSCRIBED') {
        console.log(`[useRealtime] ✅ Suscrito exitosamente a ${table}`)
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`[useRealtime] ❌ Error al suscribirse a ${table}:`, err)
        optionsRef.current.onError?.(new Error(`Error al suscribirse a ${table}: ${err?.message || 'Unknown error'}`))
      } else if (status === 'TIMED_OUT') {
        console.warn(`[useRealtime] ⚠️ Timeout al suscribirse a ${table}`)
      } else if (status === 'CLOSED') {
        console.warn(`[useRealtime] ⚠️ Canal cerrado para ${table}`)
      }
    })

    channelRef.current = channel

    // Cleanup: desuscribirse cuando el componente se desmonte
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
        console.log(`[useRealtime] Desuscrito de ${table}`)
      }
    }
  }, [
    table,
    event,
    schema,
    filter,
    supabase,
    // No incluir las funciones de callback (onInsert, onUpdate, onDelete) en las dependencias
    // para evitar re-suscripciones innecesarias
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

