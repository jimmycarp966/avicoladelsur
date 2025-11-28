import { Suspense } from 'react'
import { obtenerListaPrecioAction, obtenerPreciosListaAction } from '@/actions/listas-precios.actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Edit, ArrowLeft, Loader2, Tag } from 'lucide-react'
import Link from 'next/link'
import { PreciosProductosTable } from './precios-productos-table'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Detalle Lista de Precios | Avícola del Sur',
  description: 'Detalle y gestión de precios de lista',
}

async function ListaPrecioDetalleContent({ listaId }: { listaId: string }) {
  const supabase = await createClient()

  // Validar que el ID sea un UUID válido
  if (!listaId || listaId === 'undefined' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(listaId)) {
    return <div>ID de lista de precios inválido</div>
  }

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

  const [listaResult, preciosResult] = await Promise.all([
    obtenerListaPrecioAction(listaId),
    obtenerPreciosListaAction(listaId)
  ])

  if (!listaResult.success || !listaResult.data) {
    return <div>Error al cargar lista de precios</div>
  }

  const lista = listaResult.data as any
  const precios = preciosResult.success ? (preciosResult.data || []) : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/ventas/listas-precios">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{lista.nombre}</h1>
              <p className="text-muted-foreground">
                Código: {lista.codigo} | Tipo: {lista.tipo}
              </p>
            </div>
          </div>
        </div>
        <Button asChild>
          <Link href={`/ventas/listas-precios/${listaId}/editar`}>
            <Edit className="mr-2 h-4 w-4" />
            Editar Lista
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Estado</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={lista.activa ? 'default' : 'secondary'}>
              {lista.activa ? 'Activa' : 'Inactiva'}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge>{lista.tipo}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Productos con Precio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{precios.length}</div>
          </CardContent>
        </Card>
      </div>

      {lista.margen_ganancia && (
        <Card className="border-l-[3px] border-l-accent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Margen de Ganancia Configurado
            </CardTitle>
            <CardDescription>
              Esta lista tiene un margen de ganancia del {lista.margen_ganancia}%
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Los precios se calcularán automáticamente desde el precio_costo de cada producto.
              Puedes calcular todos los precios de una vez o configurarlos manualmente.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Precios por Producto
          </CardTitle>
          <CardDescription>
            Gestiona los precios de cada producto en esta lista
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PreciosProductosTable listaId={listaId} precios={precios} listaInfo={lista} />
        </CardContent>
      </Card>
    </div>
  )
}

export default async function ListaPrecioDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <ListaPrecioDetalleContent listaId={resolvedParams.id} />
    </Suspense>
  )
}

