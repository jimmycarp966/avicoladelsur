import { Suspense } from 'react'
import { ArrowLeft, Store } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PresupuestoForm } from './presupuesto-form'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams?: Promise<{ tipo?: string }>
}

async function NuevoPresupuestoContent({ tipoVenta }: { tipoVenta?: 'reparto' | 'retira_casa_central' }) {
  const supabase = await createClient()

  // Obtener clientes
  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nombre, telefono, zona_entrega, zona_id, codigo, localidad:localidades(zona_id)')
    .eq('activo', true)
    .order('nombre')

  // Obtener productos con stock
  const { data: productos } = await supabase
    .rpc('fn_obtener_productos_con_stock_detalle')

  // Obtener zonas
  const { data: zonas } = await supabase
    .from('zonas')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')

  const esVentaDirecta = tipoVenta === 'retira_casa_central'

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
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            {esVentaDirecta ? (
              <>
                <Store className="h-8 w-8 text-primary" />
                Nueva Venta Directa
              </>
            ) : (
              'Nuevo Presupuesto'
            )}
          </h1>
          <p className="text-muted-foreground mt-1">
            {esVentaDirecta
              ? 'Venta para cliente que retira en casa central (sin reparto)'
              : 'Crea un nuevo presupuesto para un cliente'}
          </p>
        </div>
      </div>

      <Suspense fallback={<div>Cargando formulario...</div>}>
        <PresupuestoForm
          clientes={(clientes || []).map(c => ({
            ...c,
            localidad: Array.isArray(c.localidad) ? c.localidad[0] : c.localidad
          }))}
          productos={productos || []}
          zonas={zonas || []}
          tipoVentaInicial={tipoVenta}
        />
      </Suspense>
    </div>
  )
}

export default async function NuevoPresupuestoPage({ searchParams }: PageProps) {
  const params = await searchParams
  // Si viene ?tipo=venta, preseleccionar retira_casa_central
  const tipoVenta = params?.tipo === 'venta' ? 'retira_casa_central' as const : undefined

  return <NuevoPresupuestoContent tipoVenta={tipoVenta} />
}

export const metadata = {
  title: 'Nuevo Presupuesto - Avícola del Sur ERP',
  description: 'Crear un nuevo presupuesto',
}
