import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * Caché de listas de precios activas
 * Se revalida automáticamente cada 5 minutos en Server Components
 */
export const getListasPreciosCached = cache(async () => {
  const supabase = await createClient()
  const hoy = new Date().toISOString().split('T')[0]
  
  const { data, error } = await supabase
    .from('listas_precios')
    .select('*')
    .eq('activa', true)
    .or(`vigencia_activa.eq.false,and(vigencia_activa.eq.true,fecha_vigencia_desde.lte.${hoy},fecha_vigencia_hasta.gte.${hoy})`)
    .order('nombre', { ascending: true })

  if (error) {
    throw error
  }

  return data || []
})

