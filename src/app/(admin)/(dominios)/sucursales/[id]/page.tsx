import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Building2,
    Settings,
    Package,
    ArrowRightLeft,
    AlertTriangle,
    TrendingUp,
    History
} from 'lucide-react'
import Link from 'next/link'
import { obtenerInventarioSucursalAction } from '@/actions/sucursales.actions'
import { listarTransferencias } from '@/actions/sucursales-transferencias.actions'

interface PageProps {
    params: {
        id: string
    }
}

async function getSucursal(id: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('sucursales')
        .select('*')
        .eq('id', id)
        .single()

    if (error || !data) return null
    return data
}

async function getInventario(id: string) {
    const result = await obtenerInventarioSucursalAction({ sucursalId: id })
    return result.success ? result.data || [] : []
}

async function getTransferencias(id: string) {
    const data = await listarTransferencias(id)
    return data.slice(0, 5) // Últimas 5
}

export default async function SucursalDashboardPage({ params }: PageProps) {
    const sucursal = await getSucursal(params.id)
    if (!sucursal) notFound()

    const inventario = await getInventario(params.id)
    const transferencias = await getTransferencias(params.id)

    const productosBajoStock = inventario.filter(i => i.bajoStock)
    const totalProductos = inventario.length
    const totalStock = inventario.reduce((sum, i) => sum + i.cantidadActual, 0)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                            <Building2 className="w-8 h-8" />
                            {sucursal.nombre}
                        </h1>
                        <Badge variant={sucursal.active ? "default" : "secondary"}>
                            {sucursal.active ? 'Activa' : 'Inactiva'}
                        </Badge>
                    </div>
                    <p className="text-muted-foreground">
                        {sucursal.direccion || 'Sin dirección registrada'} • {sucursal.telefono || 'Sin teléfono'}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" asChild>
                        <Link href={`/sucursales/${sucursal.id}/settings`}>
                            <Settings className="w-4 h-4 mr-2" />
                            Configuración
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href={`/sucursales/transferencias/nueva?origen=${sucursal.id}`}>
                            <ArrowRightLeft className="w-4 h-4 mr-2" />
                            Nueva Transferencia
                        </Link>
                    </Button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Productos</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalProductos}</div>
                        <p className="text-xs text-muted-foreground">
                            {totalStock.toFixed(2)} unidades en total
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Stock Crítico</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{productosBajoStock.length}</div>
                        <p className="text-xs text-muted-foreground">
                            Productos bajo el umbral
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Transferencias Recientes</CardTitle>
                        <History className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{transferencias.length}</div>
                        <p className="text-xs text-muted-foreground">
                            Últimos movimientos
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs Content */}
            <Tabs defaultValue="inventario" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="inventario">Inventario</TabsTrigger>
                    <TabsTrigger value="transferencias">Transferencias</TabsTrigger>
                </TabsList>

                <TabsContent value="inventario" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Inventario Actual</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-muted/50 text-muted-foreground">
                                        <tr>
                                            <th className="p-4 font-medium">Producto</th>
                                            <th className="p-4 font-medium text-right">Cantidad</th>
                                            <th className="p-4 font-medium text-center">Estado</th>
                                            <th className="p-4 font-medium text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {inventario.map((item) => (
                                            <tr key={item.productoId} className="border-t hover:bg-muted/50">
                                                <td className="p-4 font-medium">{item.nombre}</td>
                                                <td className="p-4 text-right">{item.cantidadActual}</td>
                                                <td className="p-4 text-center">
                                                    {item.bajoStock ? (
                                                        <Badge variant="destructive">Bajo Stock</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-green-600 border-green-600">Normal</Badge>
                                                    )}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <Button variant="ghost" size="sm" asChild>
                                                        <Link href={`/sucursales/transferencias/nueva?origen=${sucursal.id}&producto=${item.productoId}`}>
                                                            Transferir
                                                        </Link>
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                        {inventario.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="p-8 text-center text-muted-foreground">
                                                    No hay inventario registrado en esta sucursal
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="transferencias" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Últimas Transferencias</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {transferencias.map((trans) => (
                                    <div key={trans.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                                        <div>
                                            <div className="font-medium flex items-center gap-2">
                                                {trans.numero_transferencia}
                                                <Badge variant={
                                                    trans.estado === 'recibida' ? 'default' :
                                                        trans.estado === 'pendiente' ? 'secondary' : 'outline'
                                                }>
                                                    {trans.estado}
                                                </Badge>
                                            </div>
                                            <div className="text-sm text-muted-foreground mt-1">
                                                {trans.sucursal_origen_id === sucursal.id ? (
                                                    <>Enviado a <span className="font-medium text-foreground">{trans.sucursal_destino.nombre}</span></>
                                                ) : (
                                                    <>Recibido de <span className="font-medium text-foreground">{trans.sucursal_origen.nombre}</span></>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-medium">
                                                {new Date(trans.fecha_solicitud).toLocaleDateString()}
                                            </div>
                                            <Button variant="link" size="sm" className="h-auto p-0" asChild>
                                                <Link href={`/sucursales/transferencias/${trans.id}`}>
                                                    Ver detalles
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                {transferencias.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground">
                                        No hay transferencias recientes
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
