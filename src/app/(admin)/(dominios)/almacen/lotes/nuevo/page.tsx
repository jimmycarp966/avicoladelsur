import { Suspense } from 'react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LoteForm } from './lote-form'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Nuevo Lote - Avícola del Sur ERP',
  description: 'Crear un nuevo lote de mercadería',
}

async function NuevoLoteContent() {
  const supabase = await createClient()

  // Obtener productos
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
          <h1 className="text-3xl font-bold tracking-tight">Nuevo Lote</h1>
          <p className="text-muted-foreground mt-1">
            Registra el ingreso de un nuevo lote de mercadería
          </p>
        </div>
      </div>

      <Suspense fallback={<div>Cargando formulario...</div>}>
        <LoteForm productos={productos || []} />
      </Suspense>
    </div>
  )
}

export default function NuevoLotePage() {
  return <NuevoLoteContent />
}

