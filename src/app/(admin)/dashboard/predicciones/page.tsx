import { createClient } from '@/lib/supabase/server'
import PrediccionesClient from './predicciones-client'

export const dynamic = 'force-dynamic'

export default async function PrediccionesPage() {
  const supabase = await createClient()
  const { data: productos } = await supabase
    .from('productos')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')
    .limit(50)

  return <PrediccionesClient productos={productos ?? []} />
}

