import { obtenerListaPrecioAction } from '@/actions/listas-precios.actions'
import { ListaPrecioEditForm } from './lista-precio-edit-form'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export const metadata = {
  title: 'Editar Lista de Precios | Avícola del Sur',
  description: 'Editar lista de precios',
}

export default async function EditarListaPrecioPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  const supabase = await createClient()

  // Validar que el ID sea un UUID válido
  if (!resolvedParams.id || resolvedParams.id === 'undefined' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedParams.id)) {
    notFound()
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

  const result = await obtenerListaPrecioAction(resolvedParams.id)

  if (!result.success || !result.data) {
    notFound()
  }

  const lista = result.data as any

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Editar Lista de Precios</h1>
        <p className="text-muted-foreground">
          Modifica los datos de la lista de precios
        </p>
      </div>

      <ListaPrecioEditForm lista={lista} />
    </div>
  )
}

