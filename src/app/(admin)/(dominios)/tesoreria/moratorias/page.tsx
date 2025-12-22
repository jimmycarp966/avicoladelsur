import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, RefreshCw, DollarSign, Clock, Users, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { MoratoriasTable } from './moratorias-table'
import { ActualizarMorasButton } from './actualizar-moras-button'

export const dynamic = 'force-dynamic'

export const metadata = {
    title: 'Moratorias - Avícola del Sur ERP',
    description: 'Gestión de clientes con deuda y moratorias',
}

export default async function MoratoriasPage() {
    const supabase = await createClient()

    // Obtener clientes morosos
    const { data: clientesMorosos, error } = await supabase.rpc('fn_obtener_clientes_morosos')

    if (error) {
        console.error('Error obteniendo clientes morosos:', error)
    }

    const clientes = clientesMorosos || []

    // Calcular estadísticas
    const totalClientes = clientes.length
    const totalDeuda = clientes.reduce((sum: number, c: any) => sum + (c.deuda_total || 0), 0)
    const totalMora = clientes.reduce((sum: number, c: any) => sum + (c.total_mora_calculada || 0), 0)
    const clientesBloqueados = clientes.filter((c: any) => c.bloqueado_por_deuda).length
    const clientesConMora = clientes.filter((c: any) => c.dias_maximos_vencido > 0).length

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg border border-border p-6 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <AlertTriangle className="h-8 w-8 text-amber-500" />
                            Moratorias
                        </h1>
                        <p className="text-muted-foreground mt-2 text-base">
                            Clientes con deuda pendiente y facturas vencidas
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <ActualizarMorasButton />
                    </div>
                </div>
            </div>

            {/* Estadísticas */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Clientes con Deuda</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalClientes}</div>
                        <p className="text-xs text-muted-foreground">
                            Total de clientes
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-red-200 bg-red-50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-red-900">Deuda Total</CardTitle>
                        <DollarSign className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{formatCurrency(totalDeuda)}</div>
                        <p className="text-xs text-red-700">
                            Incluyendo moras
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-amber-200 bg-amber-50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-amber-900">Moras Calculadas</CardTitle>
                        <TrendingUp className="h-4 w-4 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">{formatCurrency(totalMora)}</div>
                        <p className="text-xs text-amber-700">
                            Intereses por atraso
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Con Facturas Vencidas</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{clientesConMora}</div>
                        <p className="text-xs text-muted-foreground">
                            Facturas pasadas de fecha
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-red-300 bg-red-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-red-900">Bloqueados</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-700">{clientesBloqueados}</div>
                        <p className="text-xs text-red-700">
                            No pueden comprar
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabla de clientes morosos */}
            <Card>
                <CardHeader>
                    <CardTitle>Clientes con Deuda</CardTitle>
                    <CardDescription>
                        Ordenados por días de vencimiento (mayor a menor)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {clientes.length === 0 ? (
                        <div className="text-center py-12">
                            <DollarSign className="mx-auto h-12 w-12 text-green-500 mb-4" />
                            <h3 className="text-lg font-medium text-green-700">¡Sin moratorias!</h3>
                            <p className="text-muted-foreground mt-2">
                                No hay clientes con deuda pendiente
                            </p>
                        </div>
                    ) : (
                        <MoratoriasTable clientes={clientes} />
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
