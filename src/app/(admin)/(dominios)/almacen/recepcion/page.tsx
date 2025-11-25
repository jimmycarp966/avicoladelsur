import { Suspense } from 'react'
import { Package, ArrowDownCircle, ArrowUpCircle, Calendar, Filter } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { RecepcionAlmacenForm } from './recepcion-almacen-form'
import { RecepcionAlmacenLista } from './recepcion-almacen-lista'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Recepción de Almacén - Avícola del Sur ERP',
  description: 'Gestión de ingresos y egresos de almacén',
}

async function RecepcionAlmacenContent({
  searchParams,
}: {
  searchParams?: { tipo?: string; fecha_desde?: string; fecha_hasta?: string }
}) {
  const supabase = await createClient()

  // Obtener productos para el formulario (con categoría)
  const { data: productos } = await supabase
    .from('productos')
    .select('id, nombre, codigo, unidad_medida, categoria')
    .eq('activo', true)
    .order('nombre')

  // Obtener lotes para ingresos (con proveedor)
  const { data: lotes } = await supabase
    .from('lotes')
    .select('id, numero_lote, producto_id, cantidad_disponible, proveedor')
    .eq('estado', 'disponible')
    .gt('cantidad_disponible', 0)
    .order('fecha_ingreso', { ascending: false })

  // Obtener categorías únicas de productos activos
  const categorias = productos
    ? [...new Set(productos.map(p => p.categoria).filter(Boolean))]
    : []

  // Obtener proveedores únicos de lotes disponibles
  const proveedores = lotes
    ? [...new Set(lotes.map(l => l.proveedor).filter(Boolean))]
    : []

  // Obtener recepciones con filtros
  const tipo = searchParams?.tipo
  const fechaDesde = searchParams?.fecha_desde
  const fechaHasta = searchParams?.fecha_hasta

  let query = supabase
    .from('recepcion_almacen')
    .select(`
      *,
      producto:productos(nombre, codigo),
      lote:lotes(numero_lote),
      usuario:usuarios(nombre, apellido)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (tipo) {
    query = query.eq('tipo', tipo)
  }

  if (fechaDesde) {
    query = query.gte('created_at', fechaDesde)
  }

  if (fechaHasta) {
    query = query.lte('created_at', fechaHasta)
  }

  const { data: recepciones } = await query

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recepción de Almacén</h1>
          <p className="text-muted-foreground mt-1">
            Registro de ingresos y egresos de productos
          </p>
        </div>
      </div>

      {/* Formulario de recepción */}
      <RecepcionAlmacenForm 
        productos={productos || []} 
        lotes={lotes || []}
        categorias={categorias}
        proveedores={proveedores}
      />

      {/* Lista de recepciones */}
      <RecepcionAlmacenLista
        recepciones={recepciones || []}
        tipo={tipo}
        fechaDesde={fechaDesde}
        fechaHasta={fechaHasta}
      />
    </div>
  )
}

export default async function RecepcionAlmacenPage({
  searchParams,
}: {
  searchParams?: Promise<{ tipo?: string; fecha_desde?: string; fecha_hasta?: string }>
}) {
  const params = await searchParams
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <RecepcionAlmacenContent searchParams={params} />
    </Suspense>
  )
}

