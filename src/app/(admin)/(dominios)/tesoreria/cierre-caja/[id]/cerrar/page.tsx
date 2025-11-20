import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { ArrowLeft, DollarSign, Calculator } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { CerrarCierreCajaForm } from './cerrar-cierre-caja-form'

export const dynamic = 'force-dynamic'

interface CerrarCierreCajaPageProps {
  params: {
    id: string
  }
}

async function CerrarCierreCajaContent({ cierreId }: { cierreId: string }) {
  const supabase = await createClient()

  const { data: cierre, error } = await supabase
    .from('cierres_caja')
    .select(`
      *,
      caja:tesoreria_cajas(nombre, moneda, saldo_actual)
    `)
    .eq('id', cierreId)
    .single()

  if (error || !cierre) {
    notFound()
  }

  if (cierre.estado === 'cerrado') {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <h3 className="text-lg font-medium">Este cierre ya está cerrado</h3>
          <p className="text-muted-foreground">
            No se puede modificar un cierre cerrado
          </p>
          <Button asChild className="mt-4">
            <Link href="/tesoreria/cierre-caja">Volver a Cierres</Link>
          </Button>
        </div>
      </div>
    )
  }

  // Obtener movimientos del día para calcular totales
  const fechaInicio = `${cierre.fecha}T00:00:00Z`
  const fechaFin = `${cierre.fecha}T23:59:59Z`

  const { data: movimientos } = await supabase
    .from('tesoreria_movimientos')
    .select('tipo, monto')
    .eq('caja_id', cierre.caja_id)
    .gte('created_at', fechaInicio)
    .lte('created_at', fechaFin)

  const totalIngresos = movimientos?.filter(m => m.tipo === 'ingreso').reduce((sum, m) => sum + m.monto, 0) || 0
  const totalEgresos = movimientos?.filter(m => m.tipo === 'egreso').reduce((sum, m) => sum + m.monto, 0) || 0

  // Obtener cobranzas de cuenta corriente del día
  const { data: cobranzas } = await supabase
    .from('cuentas_movimientos')
    .select('monto')
    .eq('tipo', 'pago')
    .gte('fecha', fechaInicio)
    .lte('fecha', fechaFin)

  const totalCobranzasCC = cobranzas?.reduce((sum, c) => sum + c.monto, 0) || 0

  // Obtener gastos del día
  const { data: gastos } = await supabase
    .from('gastos')
    .select('monto')
    .eq('fecha', cierre.fecha)
    .eq('afecta_caja', true)

  const totalGastos = gastos?.reduce((sum, g) => sum + g.monto, 0) || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/tesoreria/cierre-caja">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Cierres
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Cerrar Cierre de Caja</h1>
          <p className="text-muted-foreground">
            Caja: {cierre.caja?.nombre} • Fecha: {new Date(cierre.fecha).toLocaleDateString('es-AR')}
          </p>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Inicial</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${cierre.saldo_inicial.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos</CardTitle>
            <Calculator className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${totalIngresos.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Egresos</CardTitle>
            <Calculator className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">${totalEgresos.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Final Estimado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(cierre.saldo_inicial + totalIngresos - totalEgresos).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formulario de cierre */}
      <CerrarCierreCajaForm
        cierreId={cierreId}
        saldoInicial={cierre.saldo_inicial}
        totalIngresos={totalIngresos}
        totalEgresos={totalEgresos}
        totalCobranzasCC={totalCobranzasCC}
        totalGastos={totalGastos}
      />
    </div>
  )
}

export default function CerrarCierreCajaPage({ params }: CerrarCierreCajaPageProps) {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <CerrarCierreCajaContent cierreId={params.id} />
    </Suspense>
  )
}

