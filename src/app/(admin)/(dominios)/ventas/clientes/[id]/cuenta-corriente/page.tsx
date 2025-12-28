import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, DollarSign, AlertTriangle, CheckCircle2, Clock, TrendingDown, TrendingUp } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { RegistrarPagoForm } from './registrar-pago-form'
import { DesbloquearClienteButton } from './desbloquear-cliente-button'
import { FacturasTable } from '@/components/tables/FacturasTable'

interface CuentaCorrientePageProps {
    params: Promise<{
        id: string
    }>
}

export const dynamic = 'force-dynamic'

export const metadata = {
    title: 'Cuenta Corriente - Avícola del Sur ERP',
    description: 'Gestión de cuenta corriente del cliente',
}

export default async function CuentaCorrientePage({ params }: CuentaCorrientePageProps) {
    const { id } = await params
    const clienteId = id

    const supabase = await createClient()

    // Obtener datos del cliente con cuenta corriente
    const { data: cliente, error: clienteError } = await supabase
        .from('clientes')
        .select(`
      id,
      nombre,
      telefono,
      bloqueado_por_deuda,
      limite_credito,
      dias_gracia_mora,
      porcentaje_mora_mensual,
      saldo_cuenta_corriente,
      cuenta_corriente:cuentas_corrientes(
        id,
        saldo,
        limite_credito,
        updated_at
      )
    `)
        .eq('id', clienteId)
        .single()

    if (clienteError || !cliente) {
        notFound()
    }

    // Obtener movimientos de cuenta corriente
    const cuentaId = cliente.cuenta_corriente?.[0]?.id
    let movimientos: any[] = []

    if (cuentaId) {
        const { data: movData } = await supabase
            .from('cuentas_movimientos')
            .select('*')
            .eq('cuenta_corriente_id', cuentaId)
            .order('created_at', { ascending: false })
            .limit(20)

        movimientos = movData || []
    }

    // Obtener facturas pendientes
    const { data: facturasPendientes } = await supabase
        .from('facturas')
        .select('id, numero_factura, total, saldo_pendiente, estado_pago, fecha_emision, fecha_vencimiento')
        .eq('cliente_id', clienteId)
        .in('estado_pago', ['pendiente', 'parcial'])
        .order('fecha_emision', { ascending: false })

    // Calcular estadísticas
    const cuenta = cliente.cuenta_corriente?.[0]
    const saldoActual = cuenta?.saldo || cliente.saldo_cuenta_corriente || 0
    const limiteCredito = cuenta?.limite_credito || cliente.limite_credito || 0
    const creditoDisponible = limiteCredito - saldoActual
    const porcentajeUsado = limiteCredito > 0 ? (saldoActual / limiteCredito) * 100 : 0
    const totalFacturasPendientes = facturasPendientes?.reduce((sum, f) => sum + (f.saldo_pendiente || 0), 0) || 0

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/ventas/clientes/${clienteId}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Volver al cliente
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Cuenta Corriente</h1>
                        <p className="text-muted-foreground">{cliente.nombre}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {cliente.bloqueado_por_deuda && (
                        <>
                            <Badge variant="destructive" className="text-lg py-1 px-3">
                                <AlertTriangle className="mr-2 h-4 w-4" />
                                Cliente Bloqueado por Deuda
                            </Badge>
                            <DesbloquearClienteButton
                                clienteId={clienteId}
                                clienteNombre={cliente.nombre}
                            />
                        </>
                    )}
                </div>
            </div>

            {/* Resumen de cuenta */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card className={saldoActual > limiteCredito ? 'border-red-300 bg-red-50' : saldoActual < 0 ? 'border-green-300 bg-green-50' : ''}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Saldo Actual</CardTitle>
                        <DollarSign className={`h-4 w-4 ${saldoActual < 0 ? 'text-green-600' : 'text-muted-foreground'}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${saldoActual > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(Math.abs(saldoActual))}
                        </div>
                        <p className={`text-xs ${saldoActual < 0 ? 'text-green-700 font-medium' : 'text-muted-foreground'}`}>
                            {saldoActual > 0 ? 'Deuda pendiente' : saldoActual < 0 ? 'Saldo a favor' : 'Al día'}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Límite de Crédito</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                            {formatCurrency(limiteCredito)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Crédito máximo autorizado
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Crédito Disponible</CardTitle>
                        <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${creditoDisponible < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(creditoDisponible)}
                        </div>
                        <div className="mt-1 h-2 w-full rounded-full bg-gray-200">
                            <div
                                className={`h-2 rounded-full ${porcentajeUsado > 100 ? 'bg-red-500' : porcentajeUsado > 80 ? 'bg-amber-500' : 'bg-green-500'}`}
                                style={{ width: `${Math.min(porcentajeUsado, 100)}%` }}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {porcentajeUsado.toFixed(0)}% utilizado
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Facturas Pendientes</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">
                            {facturasPendientes?.length || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Total: {formatCurrency(totalFacturasPendientes)}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Registrar Pago */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5" />
                            Registrar Pago
                        </CardTitle>
                        <CardDescription>
                            Abonar a la cuenta corriente del cliente
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <RegistrarPagoForm
                            clienteId={clienteId}
                            saldoActual={saldoActual}
                            facturasPendientes={facturasPendientes || []}
                        />
                    </CardContent>
                </Card>

                {/* Últimos movimientos */}
                <Card>
                    <CardHeader>
                        <CardTitle>Últimos Movimientos</CardTitle>
                        <CardDescription>
                            Historial de cargos y abonos
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                            {movimientos.length === 0 ? (
                                <p className="text-center text-muted-foreground py-4">
                                    No hay movimientos registrados
                                </p>
                            ) : (
                                movimientos.map((mov) => (
                                    <div
                                        key={mov.id}
                                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                                    >
                                        <div className="flex items-center gap-3">
                                            {mov.tipo === 'pago' || mov.tipo === 'abono' ? (
                                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                            ) : (
                                                <TrendingUp className="h-5 w-5 text-red-600" />
                                            )}
                                            <div>
                                                <p className="font-medium text-sm">
                                                    {mov.tipo === 'pago' || mov.tipo === 'abono' ? 'Pago recibido' : 'Cargo'}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatDate(mov.created_at)} - {mov.descripcion || 'Sin descripción'}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`font-semibold ${mov.tipo === 'pago' || mov.tipo === 'abono' ? 'text-green-600' : 'text-red-600'}`}>
                                            {mov.tipo === 'pago' || mov.tipo === 'abono' ? '-' : '+'}
                                            {formatCurrency(mov.monto)}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Facturas del cliente */}
            <Card>
                <CardHeader>
                    <CardTitle>Facturas del Cliente</CardTitle>
                    <CardDescription>
                        Historial completo de facturas
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <FacturasTable clienteId={clienteId} />
                </CardContent>
            </Card>
        </div>
    )
}
