import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { EditarRutaForm } from './editar-ruta-form'
import { obtenerRutaPorId } from '@/actions/reparto.actions'
import { createClient } from '@/lib/supabase/server'
import { Loader2 } from 'lucide-react'

interface EditarRutaPageProps {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Editar Ruta - Avícola del Sur ERP',
  description: 'Editar información de la ruta',
}

async function EditarRutaContent({ rutaId }: { rutaId: string }) {
  const rutaResult = await obtenerRutaPorId(rutaId)

  if (!rutaResult.success || !rutaResult.data) {
    notFound()
  }

  const ruta = rutaResult.data

  // Validar que la ruta está en estado planificada
  if (ruta.estado !== 'planificada') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/reparto/rutas">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a Rutas
            </Link>
          </Button>
        </div>
        <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
          <h2 className="text-lg font-semibold text-destructive mb-2">
            No se puede editar esta ruta
          </h2>
          <p className="text-muted-foreground">
            Solo se pueden editar rutas en estado 'planificada'. Esta ruta está en estado '{ruta.estado}'.
          </p>
        </div>
      </div>
    )
  }

  const supabase = await createClient()

  // Obtener vehículos, repartidores, zonas y pedidos disponibles
  const [vehiculos, repartidores, zonas, pedidos] = await Promise.all([
    supabase
      .from('vehiculos')
      .select('id, patente, marca, modelo, capacidad_kg')
      .eq('activo', true)
      .order('patente'),
    supabase
      .from('usuarios')
      .select('id, nombre, apellido')
      .eq('rol', 'repartidor')
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('zonas')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('pedidos')
      .select(`
        id,
        numero_pedido,
        fecha_entrega_estimada,
        turno,
        zona_id,
        estado,
        cliente:clientes(nombre),
        zona:zonas(nombre)
      `)
      .eq('estado', 'preparando')
      .order('fecha_entrega_estimada', { ascending: true }),
  ])

  // Obtener IDs de pedidos ya asignados a esta ruta
  const pedidosAsignados = ruta.detalles_ruta?.map((detalle: any) => detalle.pedido_id) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/reparto/rutas">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Rutas
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Editar Ruta {ruta.numero_ruta}</h1>
          <p className="text-muted-foreground mt-1">
            Modifica la información de la ruta de reparto
          </p>
        </div>
      </div>

      <Suspense fallback={
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2">Cargando formulario...</span>
        </div>
      }>
        <EditarRutaForm
          ruta={ruta}
          vehiculos={vehiculos.data || []}
          repartidores={repartidores.data || []}
          zonas={zonas.data || []}
          pedidos={(pedidos.data || []).map((p: any) => ({
            ...p,
            cliente: Array.isArray(p.cliente) ? p.cliente[0] : p.cliente,
            zona: Array.isArray(p.zona) ? p.zona[0] : p.zona,
          }))}
          pedidosAsignados={pedidosAsignados}
        />
      </Suspense>
    </div>
  )
}

export default async function EditarRutaPage({ params }: EditarRutaPageProps) {
  const { id } = await params
  return <EditarRutaContent rutaId={id} />
}

