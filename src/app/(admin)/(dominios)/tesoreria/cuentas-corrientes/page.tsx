import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Wallet, DollarSign, Users, PiggyBank, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { CuentasCorrientesTable } from './cuentas-table'
import { ActualizarMorasButton } from './actualizar-moras-button' // Reusing button logic for now

export const dynamic = 'force-dynamic'

export const metadata = {
    title: 'Cuentas Corrientes - Avícola del Sur ERP',
    description: 'Gestión integral de cuentas corrientes de clientes',
}

export default async function CuentasCorrientesPage() {
    const supabase = await createClient()

    // Obtener TODAS las cuentas corrientes
    // Esta función debe haber sido credada en la migración
    const { data: todasCuentas, error } = await supabase.rpc('fn_obtener_todas_cuentas_corrientes')

    if (error) {
        console.error('Error obteniendo cuentas corrientes:', error)
    }

    const cuentas = todasCuentas || []

    // Calcular estadísticas
    const totalClientes = cuentas.length

    // Deuda Total: Suma de saldos positivos
    const deudaTotal = cuentas
        .filter((c: any) => c.saldo_cuenta_corriente > 0)
        .reduce((sum: number, c: any) => sum + c.saldo_cuenta_corriente, 0)

    // Saldo a Favor Total: Suma de saldos negativos (convertidos a positivo para visualización)
    const saldoFavorTotal = cuentas
        .filter((c: any) => c.saldo_cuenta_corriente < 0)
        .reduce((sum: number, c: any) => sum + Math.abs(c.saldo_cuenta_corriente), 0)

    const clientesDeudores = cuentas.filter((c: any) => c.saldo_cuenta_corriente > 0).length
    const clientesFavor = cuentas.filter((c: any) => c.saldo_cuenta_corriente < 0).length
    const clientesAlDia = cuentas.filter((c: any) => c.saldo_cuenta_corriente === 0).length

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg border border-border p-6 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <Wallet className="h-8 w-8 text-blue-600" />
                            Cuentas Corrientes
                        </h1>
                        <p className="text-muted-foreground mt-2 text-base">
                            Gestión de saldos, deudas y créditos de clientes
                        </p>
                    </div>
                </div>
            </div>

            {/* Estadísticas */}
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
                        <p className="text-xs text-red-700">
                            Pendiente de cobro
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-green-200 bg-green-50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-green-900">Saldo a Favor Total</CardTitle>
                        <PiggyBank className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{formatCurrency(saldoFavorTotal)}</div>
                        <p className="text-xs text-green-700">
                            Crédito de clientes
                        </p>
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
                                <span className="text-gray-500">Al día:</span>
                                <span>{clientesAlDia}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabla Principal */}
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
