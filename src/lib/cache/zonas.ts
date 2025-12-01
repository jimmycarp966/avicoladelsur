import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * Caché de zonas activas
 * Se revalida automáticamente cada 5 minutos en Server Components
 */
export const getZonasCached = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('zonas')
    .select('*')
    .eq('activo', true)
    .order('nombre', { ascending: true })

  if (error) {
    throw error
  }

  return data || []
})

