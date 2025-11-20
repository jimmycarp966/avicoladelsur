import { Suspense } from 'react'
import { Calendar, DollarSign, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { CierreCajaLista } from './cierre-caja-lista'
import { CierreCajaForm } from './cierre-caja-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Cierres de Caja - Tesorería - Avícola del Sur ERP',
  description: 'Gestión de cierres de caja diarios',
}

async function CierreCajaContent({
  searchParams,
}: {
  searchParams?: { caja_id?: string; fecha?: string; estado?: string }
}) {
  const supabase = await createClient()

  // Obtener cajas
  const { data: cajas } = await supabase
    .from('tesoreria_cajas')
    .select('id, nombre, moneda')
    .order('nombre')

  // Obtener cierres con filtros
  const cajaId = searchParams?.caja_id
  const fecha = searchParams?.fecha
  const estado = searchParams?.estado

  let query = supabase
    .from('cierres_caja')
    .select(`
      *,
      caja:tesoreria_cajas(nombre, moneda)
    `)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  if (cajaId) {
    query = query.eq('caja_id', cajaId)
  }

  if (fecha) {
    query = query.eq('fecha', fecha)
  }

  if (estado) {
    query = query.eq('estado', estado)
  }

  const { data: cierres } = await query

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cierres de Caja</h1>
          <p className="text-muted-foreground mt-1">
            Gestión de cierres de caja diarios con totales y conciliación
          </p>
        </div>
      </div>

      {/* Formulario de cierre */}
      <CierreCajaForm cajas={cajas || []} />

      {/* Lista de cierres */}
      <CierreCajaLista
        cierres={cierres || []}
        cajas={cajas || []}
        cajaId={cajaId}
        fecha={fecha}
        estado={estado}
      />
    </div>
  )
}

export default async function CierreCajaPage({
  searchParams,
}: {
  searchParams?: Promise<{ caja_id?: string; fecha?: string; estado?: string }>
}) {
  const params = await searchParams
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <CierreCajaContent searchParams={params} />
    </Suspense>
  )
}

