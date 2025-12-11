import { Suspense } from 'react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PresupuestoForm } from './presupuesto-form'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Nuevo Presupuesto - Avícola del Sur ERP',
  description: 'Crear un nuevo presupuesto',
}

async function NuevoPresupuestoContent() {
  const supabase = await createClient()

  // Obtener clientes
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nombre, telefono, zona_entrega, codigo')
    .eq('activo', true)
    .order('nombre')

  // Obtener productos
  const { data: productos } = await supabase
    .from('productos')
    .select('id, codigo, nombre, precio_venta, unidad_medida, categoria, venta_mayor_habilitada, unidad_mayor_nombre, kg_por_unidad_mayor')
    .eq('activo', true)
    .order('nombre')

  // Obtener zonas
  const { data: zonas } = await supabase
    .from('zonas')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/ventas/presupuestos">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Presupuestos
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nuevo Presupuesto</h1>
          <p className="text-muted-foreground mt-1">
            Crea un nuevo presupuesto para un cliente
          </p>
        </div>
      </div>

      <Suspense fallback={<div>Cargando formulario...</div>}>
        <PresupuestoForm
          clientes={clientes || []}
          productos={productos || []}
          zonas={zonas || []}
        />
      </Suspense>
    </div>
  )
}

export default function NuevoPresupuestoPage() {
  return <NuevoPresupuestoContent />
}

