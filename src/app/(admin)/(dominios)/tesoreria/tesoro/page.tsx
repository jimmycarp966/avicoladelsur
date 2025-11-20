import { Suspense } from 'react'
import { PiggyBank, DollarSign, ArrowDownCircle, ArrowUpCircle, CreditCard } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'
import { TesoroResumen } from './tesoro-resumen'
import { TesoroMovimientos } from './tesoro-movimientos'
import { TesoroForm } from './tesoro-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Tesoro - Tesorería - Avícola del Sur ERP',
  description: 'Gestión del tesoro separado de cajas',
}

async function TesoroContent({
  searchParams,
}: {
  searchParams?: { tipo?: string; fecha_desde?: string; fecha_hasta?: string }
}) {
  const supabase = await createClient()

  // Obtener movimientos de tesoro
  const tipo = searchParams?.tipo
  const fechaDesde = searchParams?.fecha_desde
  const fechaHasta = searchParams?.fecha_hasta

  let query = supabase
    .from('tesoro')
    .select('*')
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

  const { data: movimientos } = await query

  // Calcular saldos por tipo
  const saldosPorTipo = {
    efectivo: 0,
    transferencia: 0,
    qr: 0,
    tarjeta: 0,
  }

  movimientos?.forEach((mov: any) => {
    if (mov.tipo in saldosPorTipo) {
      saldosPorTipo[mov.tipo as keyof typeof saldosPorTipo] += mov.monto
    }
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10"></div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tesoro</h1>
          <p className="text-muted-foreground mt-1">
            Gestión del tesoro separado de cajas (dinero físico en casa central)
          </p>
        </div>
      </div>

      {/* Resumen de saldos */}
      <TesoroResumen saldosPorTipo={saldosPorTipo} />

      {/* Formulario de retiro/depósito */}
      <TesoroForm />

      {/* Movimientos */}
      <TesoroMovimientos
        movimientos={movimientos || []}
        tipo={tipo}
        fechaDesde={fechaDesde}
        fechaHasta={fechaHasta}
      />
    </div>
  )
}

export default async function TesoroPage({
  searchParams,
}: {
  searchParams?: Promise<{ tipo?: string; fecha_desde?: string; fecha_hasta?: string }>
}) {
  const params = await searchParams
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <TesoroContent searchParams={params} />
    </Suspense>
  )
}

