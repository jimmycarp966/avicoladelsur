'use server'

import { createClient } from '@/lib/supabase/server'
import { getTodayArgentina } from '@/lib/utils'
import { format } from 'date-fns'

/**
 * Obtiene el número de mensajes del bot enviados hoy
 */
export async function obtenerMensajesHoyAction(): Promise<{
  data?: number
  error?: string
}> {
  try {
    const supabase = await createClient()

    const hoy = getTodayArgentina()

    const { count, error } = await supabase
      .from('bot_messages')
      .select('*', { count: 'exact', head: false })
      .eq('direction', 'outgoing')
      .gte('created_at', `${hoy}T00:00:00`)
      .lte('created_at', `${hoy}T23:59:59`)

    if (error) {
      console.error('[Bot Métricas] Error:', error)
      return { error: error.message }
    }

    return {
      data: count || 0
    }
  } catch (error: any) {
    console.error('[Bot Métricas] Error:', error)
    return { error: error.message || 'Error desconocido' }
  }
}
