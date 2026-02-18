import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Wallet, DollarSign, Users, PiggyBank, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { CuentasCorrientesTable } from './cuentas-table'
import { obtenerPromesasDelDiaAction } from '@/actions/tesoreria.actions'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Cuentas Corrientes - Avicola del Sur ERP',
  description: 'Gestion integral de cuentas corrientes de clientes',
}

export default async function CuentasCorrientesPage() {
  const supabase = await createClient()

  const [{ data: todasCuentas, error }, promesasResult] = await Promise.all([
    supabase.rpc('fn_obtener_todas_cuentas_corrientes'),
    obtenerPromesasDelDiaAction(),
  ])

  if (error) {
    console.error('Error obteniendo cuentas corrientes:', error)
  }

  const cuentas = todasCuentas || []
  const promesasDelDia = promesasResult.success ? promesasResult.data || [] : []

  const totalClientes = cuentas.length
  const deudaTotal = cuentas
    .filter((c: any) => c.saldo_cuenta_corriente > 0)
    .reduce((sum: number, c: any) => sum + c.saldo_cuenta_corriente, 0)

  const saldoFavorTotal = cuentas
    .filter((c: any) => c.saldo_cuenta_corriente < 0)
    .reduce((sum: number, c: any) => sum + Math.abs(c.saldo_cuenta_corriente), 0)

  const clientesDeudores = cuentas.filter((c: any) => c.saldo_cuenta_corriente > 0).length
  const clientesFavor = cuentas.filter((c: any) => c.saldo_cuenta_corriente < 0).length
  const clientesAlDia = cuentas.filter((c: any) => c.saldo_cuenta_corriente === 0).length

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-border p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Wallet className="h-8 w-8 text-blue-600" />
              Cuentas Corrientes
            </h1>
            <p className="text-muted-foreground mt-2 text-base">
              Gestion de saldos, deudas y creditos de clientes
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cuentas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClientes}</div>
            <p className="text-xs text-muted-foreground">
              {clientesDeudores} deudores, {clientesFavor} a favor
            </p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-900">Deuda Total</CardTitle>
            <DollarSign className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(deudaTotal)}</div>
            <p className="text-xs text-red-700">Pendiente de cobro</p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-900">Saldo a Favor Total</CardTitle>
            <PiggyBank className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(saldoFavorTotal)}</div>
            <p className="text-xs text-green-700">Credito de clientes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estado General</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-red-600 font-medium">Deudores:</span>
                <span>{clientesDeudores}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-green-600 font-medium">A favor:</span>
                <span>{clientesFavor}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Al dia:</span>
                <span>{clientesAlDia}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="text-base">Promesas del dia ({promesasDelDia.length})</CardTitle>
          <p className="text-xs text-muted-foreground">Horario Argentina GMT-3</p>
        </CardHeader>
        <CardContent>
          {promesasDelDia.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay promesas pendientes para hoy.</p>
          ) : (
            <div className="space-y-2">
              {promesasDelDia.slice(0, 8).map((promesa: any) => (
                <div key={promesa.id} className="rounded-md border bg-white p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{promesa.cliente?.nombre || 'Cliente'}</p>
                    <p className="text-xs text-blue-700 font-medium">
                      {promesa.hora_proximo_contacto ? `${promesa.hora_proximo_contacto.slice(0, 5)} hs` : 'Sin hora'}
                    </p>
                  </div>
                  <p className="text-muted-foreground mt-1 line-clamp-2">{promesa.nota}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Listado de Cuentas</CardTitle>
        </CardHeader>
        <CardContent>
          <CuentasCorrientesTable clientes={cuentas} />
        </CardContent>
      </Card>
    </div>
  )
}
