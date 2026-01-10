import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Building2,
    ArrowLeft,
    Phone,
    Mail,
    MapPin,
    FileText,
    CreditCard,
    AlertTriangle,
    TrendingDown,
    Wallet
} from 'lucide-react'
import {
    obtenerProveedorAction,
    listarFacturasProveedorAction,
    listarPagosProveedorAction,
    obtenerEstadoCuentaProveedorAction
} from '@/actions/proveedores.actions'
import { formatCurrency } from '@/lib/utils'
import { FacturasTable } from './facturas-table'
import { PagosTable } from './pagos-table'
import { RegistrarFacturaDialog } from './registrar-factura-dialog'
import { RegistrarPagoDialog } from './registrar-pago-dialog'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const result = await obtenerProveedorAction(id)

    return {
        title: result.success
            ? `${result.data.nombre} - Proveedores - Avícola del Sur ERP`
            : 'Proveedor no encontrado',
    }
}

export default async function ProveedorDetallePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    const [proveedorResult, facturasResult, pagosResult, estadoCuentaResult] = await Promise.all([
        obtenerProveedorAction(id),
        listarFacturasProveedorAction(id),
        listarPagosProveedorAction(id),
        obtenerEstadoCuentaProveedorAction(id)
    ])

    if (!proveedorResult.success) {
        notFound()
    }

    const proveedor = proveedorResult.data
    const facturas = facturasResult.success ? facturasResult.data : []
    const pagos = pagosResult.success ? pagosResult.data : []
    const estadoCuenta = estadoCuentaResult.success ? estadoCuentaResult.data : null

    return (
        <div className="space-y-6">
            {/* Header con navegación */}
            <div className="bg-white rounded-lg border border-border p-6 shadow-sm">
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                        <Button asChild variant="ghost" size="icon" className="mt-1">
                            <Link href="/tesoreria/proveedores">
                                <ArrowLeft className="h-5 w-5" />
                            </Link>
                        </Button>
                        <div>
                            <div className="flex items-center gap-3">
                                <Building2 className="h-8 w-8 text-blue-600" />
                                <h1 className="text-3xl font-bold tracking-tight text-foreground">
                                    {proveedor.nombre}
                                </h1>
                                <Badge variant={proveedor.activo ? 'default' : 'secondary'}>
                                    {proveedor.activo ? 'Activo' : 'Inactivo'}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-muted-foreground">
                                {proveedor.cuit && (
                                    <span className="text-sm">CUIT: {proveedor.cuit}</span>
                                )}
                                {proveedor.telefono && (
                                    <span className="flex items-center gap-1 text-sm">
                                        <Phone className="h-3 w-3" />
                                        {proveedor.telefono}
                                    </span>
                                )}
                                {proveedor.email && (
                                    <span className="flex items-center gap-1 text-sm">
                                        <Mail className="h-3 w-3" />
                                        {proveedor.email}
                                    </span>
                                )}
                                {proveedor.direccion && (
                                    <span className="flex items-center gap-1 text-sm">
                                        <MapPin className="h-3 w-3" />
                                        {proveedor.direccion}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <RegistrarFacturaDialog
                            proveedorId={proveedor.id}
                            proveedorNombre={proveedor.nombre}
                        />
                        <RegistrarPagoDialog
                            proveedorId={proveedor.id}
                            proveedorNombre={proveedor.nombre}
                        />
                    </div>
                </div>
            </div>

            {/* Estado de Cuenta */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Facturado</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(estadoCuenta?.total_facturado || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {estadoCuenta?.facturas_pendientes || 0} facturas pendientes
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Pagado</CardTitle>
                        <CreditCard className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {formatCurrency(estadoCuenta?.total_pagado || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {pagos.length} pagos realizados
                        </p>
                    </CardContent>
                </Card>

                <Card className={estadoCuenta?.saldo_pendiente > 0 ? 'border-red-200 bg-red-50' : ''}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Saldo Pendiente</CardTitle>
                        <Wallet className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${estadoCuenta?.saldo_pendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(estadoCuenta?.saldo_pendiente || 0)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Deuda actual con proveedor
                        </p>
                    </CardContent>
                </Card>

                <Card className={estadoCuenta?.facturas_vencidas > 0 ? 'border-orange-200 bg-orange-50' : ''}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Facturas Vencidas</CardTitle>
                        <AlertTriangle className={`h-4 w-4 ${estadoCuenta?.facturas_vencidas > 0 ? 'text-orange-600' : 'text-muted-foreground'}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${estadoCuenta?.facturas_vencidas > 0 ? 'text-orange-600' : ''}`}>
                            {estadoCuenta?.facturas_vencidas || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Requieren atención inmediata
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs de Facturas y Pagos */}
            <Tabs defaultValue="facturas" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="facturas" className="gap-2">
                        <FileText className="h-4 w-4" />
                        Facturas ({facturas.length})
                    </TabsTrigger>
                    <TabsTrigger value="pagos" className="gap-2">
                        <CreditCard className="h-4 w-4" />
                        Pagos ({pagos.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="facturas" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Facturas Recibidas</CardTitle>
                            <CardDescription>
                                Historial de comprobantes del proveedor
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <FacturasTable facturas={facturas} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="pagos" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Pagos Realizados</CardTitle>
                            <CardDescription>
                                Historial de pagos al proveedor
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <PagosTable pagos={pagos} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Notas del proveedor */}
            {proveedor.notas && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Notas</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground whitespace-pre-wrap">
                            {proveedor.notas}
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
