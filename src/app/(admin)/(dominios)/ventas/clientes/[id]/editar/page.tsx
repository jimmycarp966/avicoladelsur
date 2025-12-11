import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { obtenerClientePorIdAction } from '@/actions/ventas.actions'
import { EditarClienteForm } from './editar-cliente-form'
import { ClienteFormSkeleton } from '@/app/(admin)/(dominios)/ventas/clientes/nuevo/cliente-form-skeleton'
import { createClient } from '@/lib/supabase/server'

interface EditarClientePageProps {
  params: Promise<{
    id: string
  }>
}

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Editar Cliente - Avícola del Sur ERP',
  description: 'Editar información del cliente',
}

export default async function EditarClientePage({ params }: EditarClientePageProps) {
  const { id } = await params
  const clienteId = id

  // Obtener zonas activas
  const supabase = await createClient()
  const { data: zonas } = await supabase
    .from('zonas')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')

  // Cargar datos reales del cliente
  const clienteResult = await obtenerClientePorIdAction(clienteId)

  if (!clienteResult.success || !clienteResult.data) {
    notFound()
  }

  // Mapear solo los campos necesarios para el formulario
  const cliente = {
    id: clienteResult.data.id,
    codigo: clienteResult.data.codigo,
    nombre: clienteResult.data.nombre,
    telefono: clienteResult.data.telefono,
    whatsapp: clienteResult.data.whatsapp,
    email: clienteResult.data.email,
    direccion: clienteResult.data.direccion,
    zona_entrega: clienteResult.data.zona_entrega,
    coordenadas: clienteResult.data.coordenadas,
    tipo_cliente: clienteResult.data.tipo_cliente,
    limite_credito: clienteResult.data.limite_credito || 0,
    activo: clienteResult.data.activo,
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
        <h1 className="text-3xl font-bold tracking-tight">Editar Cliente</h1>
        <p className="text-muted-foreground mt-1">
          Modifica la información del cliente
        </p>
      </div>

      <Suspense fallback={<ClienteFormSkeleton />}>
        <EditarClienteForm cliente={cliente} zonas={zonas || []} />
      </Suspense>
    </div>
  )
}
