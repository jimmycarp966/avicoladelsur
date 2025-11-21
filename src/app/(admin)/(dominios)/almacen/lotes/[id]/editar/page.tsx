import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { EditarLoteForm } from './editar-lote-form'
import { obtenerLotes } from '@/actions/almacen.actions'
import { createClient } from '@/lib/supabase/server'
import { Loader2 } from 'lucide-react'

interface EditarLotePageProps {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Editar Lote - Avícola del Sur ERP',
  description: 'Editar información del lote',
}

async function EditarLoteContent({ loteId }: { loteId: string }) {
  const supabase = await createClient()

  const { data: lote, error } = await supabase
    .from('lotes')
    .select(`
      *,
      producto:productos(id, codigo, nombre, unidad_medida)
    `)
    .eq('id', loteId)
    .single()

  if (error || !lote) {
    notFound()
  }

  // Obtener productos para el selector
  const { data: productos } = await supabase
    .from('productos')
    .select('id, codigo, nombre, unidad_medida')
    .eq('activo', true)
    .order('nombre')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/almacen/lotes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Lotes
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Editar Lote {lote.numero_lote}</h1>
          <p className="text-muted-foreground mt-1">
            Modifica la información del lote
          </p>
        </div>
      </div>

      <Suspense fallback={
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2">Cargando formulario...</span>
        </div>
      }>
        <EditarLoteForm lote={lote} productos={productos || []} />
      </Suspense>
    </div>
  )
}

export default async function EditarLotePage({ params }: EditarLotePageProps) {
  const { id } = await params
  return <EditarLoteContent loteId={id} />
}

