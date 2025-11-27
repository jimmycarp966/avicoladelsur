import { Suspense } from 'react'
import { obtenerListasPreciosAction } from '@/actions/listas-precios.actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Tag, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { ListasPreciosTable } from './listas-precios-table'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Listas de Precios | Avícola del Sur',
  description: 'Gestión de listas de precios',
}

async function ListasPreciosContent() {
  const supabase = await createClient()
  
  // Verificar permisos (solo admin)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return <div>No autenticado</div>
  }

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!usuario || usuario.rol !== 'admin') {
    return <div>No tienes permisos para ver esta página</div>
  }

  const result = await obtenerListasPreciosAction({ activa: true })

  if (!result.success) {
    return <div>Error al cargar listas de precios</div>
  }

  const listas = result.data || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Listas de Precios</h1>
          <p className="text-muted-foreground">
            Gestiona las listas de precios del sistema
          </p>
        </div>
        <Button asChild>
          <Link href="/ventas/listas-precios/nuevo">
            <Plus className="mr-2 h-4 w-4" />
            Nueva Lista
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Listas de Precios
          </CardTitle>
          <CardDescription>
            Administra las listas de precios disponibles en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ListasPreciosTable listas={listas} />
        </CardContent>
      </Card>
    </div>
  )
}

export default function ListasPreciosPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <ListasPreciosContent />
    </Suspense>
  )
}

