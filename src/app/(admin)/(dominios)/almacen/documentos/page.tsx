import { createClient } from '@/lib/supabase/server'
import DocumentosClient from './documentos-client'

export const dynamic = 'force-dynamic'

export default async function DocumentosPage() {
  const supabase = await createClient()
  const { data: documentos } = await supabase
    .from('documentos_procesados')
    .select('id, tipo, estado, archivo_url, datos_extraidos, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  return <DocumentosClient documentos={documentos ?? []} />
}

