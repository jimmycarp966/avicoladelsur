/**
 * Gestión de Estados Pendientes del Bot
 * Maneja estados de flujos conversacionales (registro, reclamos, confirmaciones)
 * con persistencia en Supabase para evitar pérdida en Vercel serverless
 */

import { createAdminClient } from '@/lib/supabase/server'

// Tipos de estado (deben coincidir con CHECK constraint en BD)
export type StateType = 'registro' | 'reclamo' | 'confirmacion'

// Interfaces de estado (de route.ts:257-278)
export interface RegistroClienteEstado {
  estado: 'esperando_confirmacion' | 'esperando_nombre' | 'esperando_direccion' | 'esperando_zona'
  nombre?: string
  apellido?: string
  direccion?: string
  productos_pendientes: Array<{ codigo: string; cantidad: number }>
  timestamp: number
  zonas?: any[] // Zonas disponibles para selección
}

export interface ReclamoEstado {
  estado: 'esperando_tipo' | 'esperando_descripcion' | 'esperando_pedido'
  tipo_reclamo?: string
  descripcion?: string
  pedido_id?: string
  timestamp: number
}

export interface ConfirmacionEstado {
  productos: Array<{ codigo: string; cantidad: number }>
  timestamp: number
}

export type PendingState = RegistroClienteEstado | ReclamoEstado | ConfirmacionEstado

// Fallback en memoria (solo si Supabase falla)
const memoryFallback = new Map<string, PendingState>()

/**
 * Obtiene un estado pendiente desde Supabase
 * Fallback a memoria si Supabase falla
 */
export async function getPendingState<T extends PendingState>(
  phoneNumber: string,
  stateType: StateType
): Promise<T | null> {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase.rpc('get_bot_pending_state', {
      p_phone_number: phoneNumber,
      p_state_type: stateType
    })

    if (error) {
      console.warn('[State Manager] Error obteniendo estado de Supabase, usando fallback:', error)
      const key = `${phoneNumber}:${stateType}`
      return (memoryFallback.get(key) as T) || null
    }

    if (!data || !data.success) {
      return null
    }

    return data.state.state_data as T
  } catch (error) {
    console.error('[State Manager] Error crítico obteniendo estado:', error)
    const key = `${phoneNumber}:${stateType}`
    return (memoryFallback.get(key) as T) || null
  }
}

/**
 * Guarda un estado pendiente en Supabase
 * Fallback a memoria si Supabase falla
 */
export async function setPendingState(
  phoneNumber: string,
  stateType: StateType,
  stateData: PendingState,
  expiresInMinutes: number = 60
): Promise<boolean> {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase.rpc('upsert_bot_pending_state', {
      p_phone_number: phoneNumber,
      p_state_type: stateType,
      p_state_data: stateData,
      p_expires_in_minutes: expiresInMinutes
    })

    if (error) {
      console.warn('[State Manager] Error guardando estado en Supabase, usando fallback:', error)
      const key = `${phoneNumber}:${stateType}`
      memoryFallback.set(key, stateData)
      return true
    }

    if (!data || !data.success) {
      console.warn('[State Manager] Supabase retornó error, usando fallback:', data?.error)
      const key = `${phoneNumber}:${stateType}`
      memoryFallback.set(key, stateData)
      return true
    }

    console.log(`[State Manager] Estado guardado en Supabase: ${phoneNumber} - ${stateType}`)
    return true
  } catch (error) {
    console.error('[State Manager] Error crítico guardando estado:', error)
    const key = `${phoneNumber}:${stateType}`
    memoryFallback.set(key, stateData)
    return true
  }
}

/**
 * Elimina un estado pendiente de Supabase
 * También limpia del fallback en memoria
 */
export async function deletePendingState(
  phoneNumber: string,
  stateType: StateType
): Promise<boolean> {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase.rpc('delete_bot_pending_state', {
      p_phone_number: phoneNumber,
      p_state_type: stateType
    })

    // Limpiar fallback en memoria siempre
    const key = `${phoneNumber}:${stateType}`
    memoryFallback.delete(key)

    if (error) {
      console.warn('[State Manager] Error eliminando estado de Supabase:', error)
      return true // Ya se limpió de memoria
    }

    if (!data || !data.success) {
      console.warn('[State Manager] Supabase retornó error al eliminar:', data?.error)
      return true // Ya se limpió de memoria
    }

    console.log(`[State Manager] Estado eliminado: ${phoneNumber} - ${stateType}`)
    return true
  } catch (error) {
    console.error('[State Manager] Error crítico eliminando estado:', error)
    const key = `${phoneNumber}:${stateType}`
    memoryFallback.delete(key)
    return true
  }
}

/**
 * Limpia estados expirados (para ejecutar periódicamente)
 * Solo limpia en Supabase, el fallback en memoria se limpia automáticamente al reiniciar
 */
export async function cleanupExpiredStates(): Promise<number> {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase.rpc('cleanup_expired_bot_states')

    if (error) {
      console.error('[State Manager] Error limpiando estados expirados:', error)
      return 0
    }

    if (!data || !data.success) {
      console.warn('[State Manager] Error en limpieza:', data?.error)
      return 0
    }

    console.log(`[State Manager] Limpieza completada: ${data.deleted_count} estados eliminados`)
    return data.deleted_count
  } catch (error) {
    console.error('[State Manager] Error crítico en limpieza:', error)
    return 0
  }
}
