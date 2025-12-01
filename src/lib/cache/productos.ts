import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * Caché de productos activos
 * Se revalida automáticamente cada 5 minutos en Server Components
 */
export const getProductosCached = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('activo', true)
    .order('nombre', { ascending: true })

  if (error) {
    throw error
  }

  return data || []
})

