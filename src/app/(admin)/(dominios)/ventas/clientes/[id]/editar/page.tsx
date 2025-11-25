import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { NuevoClienteForm } from '@/app/(admin)/(dominios)/ventas/clientes/nuevo/cliente-form'
import { ClienteFormSkeleton } from '@/app/(admin)/(dominios)/ventas/clientes/nuevo/cliente-form-skeleton'
// import { getClienteById } from '@/actions/ventas.actions' // TODO: Implementar cuando esté disponible

interface EditarClientePageProps {
  params: {
    id: string
  }
}

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Editar Cliente - Avícola del Sur ERP',
  description: 'Editar información del cliente',
}

export default async function EditarClientePage({ params }: EditarClientePageProps) {
  const { id } = await params
  const clienteId = id

  // En producción, esto sería una llamada real a la base de datos
  // const cliente = await getClienteById(clienteId)
  // if (!cliente) notFound()

  // Datos de ejemplo para desarrollo
  const clienteEjemplo = {
    id: clienteId,
    nombre: 'Supermercado Central',
    telefono: '+5491123456789',
    whatsapp: '+5491123456789',
    email: 'contacto@supercentral.com',
    direccion: 'Av. Principal 123, Ciudad',
    zona_entrega: 'Centro',
    coordenadas: { lat: -34.6118, lng: -58.3965 },
    tipo_cliente: 'mayorista',
    limite_credito: 50000.00,
    activo: true,
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
        <NuevoClienteForm />
      </Suspense>
    </div>
  )
}
