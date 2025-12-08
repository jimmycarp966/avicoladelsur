import { Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowRightLeft, Plus, Filter } from 'lucide-react'
import Link from 'next/link'
import { listarTransferenciasAction } from '@/actions/sucursales-transferencias.actions'

async function getTransferencias() {
    const data = await listarTransferenciasAction()
    return data
}

export default async function TransferenciasPage() {
    const transferencias = await getTransferencias()

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <ArrowRightLeft className="w-8 h-8" />
                        Transferencias de Stock
                    </h1>
                    <p className="text-muted-foreground">
                        Gestiona los movimientos de mercadería entre sucursales
                    </p>
                </div>
                <Button asChild>
                    <Link href="/sucursales/transferencias/nueva">
                        <Plus className="w-4 h-4 mr-2" />
                        Nueva Transferencia
                    </Link>
                </Button>
            </div>

            {/* Lista */}
            <Card>
                <CardHeader>
                    <CardTitle>Historial de Transferencias</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground">
                                <tr>
                                    <th className="p-4 font-medium">Referencia</th>
                                    <th className="p-4 font-medium">Origen</th>
                                    <th className="p-4 font-medium">Destino</th>
                                    <th className="p-4 font-medium">Estado</th>
                                    <th className="p-4 font-medium">Fecha</th>
                                    <th className="p-4 font-medium text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transferencias.map((trans) => (
                                    <tr key={trans.id} className="border-t hover:bg-muted/50">
                                        <td className="p-4 font-medium">{trans.numero_transferencia}</td>
                                        <td className="p-4">{trans.sucursal_origen.nombre}</td>
                                        <td className="p-4">{trans.sucursal_destino.nombre}</td>
                                        <td className="p-4">
                                            <Badge variant={
                                                trans.estado === 'recibida' ? 'default' :
                                                    trans.estado === 'pendiente' ? 'secondary' :
                                                        trans.estado === 'en_transito' ? 'outline' : 'destructive'
                                            }>
                                                {trans.estado === 'en_transito' ? 'En Tránsito' :
                                                    trans.estado.charAt(0).toUpperCase() + trans.estado.slice(1)}
                                            </Badge>
                                        </td>
                                        <td className="p-4 text-muted-foreground">
                                            {new Date(trans.fecha_solicitud).toLocaleDateString()}
                                        </td>
                                        <td className="p-4 text-right">
                                            <Button variant="ghost" size="sm" asChild>
                                                <Link href={`/sucursales/transferencias/${trans.id}`}>
                                                    Ver Detalles
                                                </Link>
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                {transferencias.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                            No hay transferencias registradas
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
