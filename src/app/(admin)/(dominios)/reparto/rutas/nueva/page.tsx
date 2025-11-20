import { Suspense } from 'react'
import { ArrowLeft, Truck, MapPin, Clock } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { NuevaRutaForm } from './nueva-ruta-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Nueva Ruta - Reparto - Avícola del Sur ERP',
  description: 'Crear una nueva ruta de reparto',
}

async function NuevaRutaContent() {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/reparto/rutas">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Rutas
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Nueva Ruta de Reparto</h1>
          <p className="text-muted-foreground">Crea una nueva ruta con turno y zona estipulados</p>
        </div>
      </div>

      {/* Formulario */}
      <NuevaRutaForm
        vehiculos={vehiculos.data || []}
        repartidores={repartidores.data || []}
        zonas={zonas.data || []}
        pedidos={(pedidos.data || []).map((p: any) => ({
          ...p,
          cliente: Array.isArray(p.cliente) ? p.cliente[0] : p.cliente,
          zona: Array.isArray(p.zona) ? p.zona[0] : p.zona,
        }))}
      />
    </div>
  )
}

export default function NuevaRutaPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <NuevaRutaContent />
    </Suspense>
  )
}

