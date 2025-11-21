import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AjustarStockForm } from './ajustar-stock-form'
import { createClient } from '@/lib/supabase/server'
import { Loader2 } from 'lucide-react'

interface AjustarStockPageProps {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Ajustar Stock - Avícola del Sur ERP',
  description: 'Ajustar cantidad disponible del lote',
}

async function AjustarStockContent({ loteId }: { loteId: string }) {
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

  // Validar que el lote está disponible para ajuste
  if (lote.estado !== 'disponible') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/almacen/lotes">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a Lotes
            </Link>
          </Button>
        </div>
        <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
          <h2 className="text-lg font-semibold text-destructive mb-2">
            No se puede ajustar este lote
          </h2>
          <p className="text-muted-foreground">
            Solo se pueden ajustar lotes en estado "disponible". Este lote está en estado "{lote.estado}".
          </p>
        </div>
      </div>
    )
  }

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
          <h1 className="text-3xl font-bold tracking-tight">Ajustar Stock - {lote.numero_lote}</h1>
          <p className="text-muted-foreground mt-1">
            Ajusta la cantidad disponible del lote
          </p>
        </div>
      </div>

      <Suspense fallback={
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2">Cargando formulario...</span>
        </div>
      }>
        <AjustarStockForm lote={lote} />
      </Suspense>
    </div>
  )
}

export default async function AjustarStockPage({ params }: AjustarStockPageProps) {
  const { id } = await params
  return <AjustarStockContent loteId={id} />
}

