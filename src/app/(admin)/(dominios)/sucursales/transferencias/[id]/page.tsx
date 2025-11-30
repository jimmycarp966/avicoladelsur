import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
    ArrowRightLeft,
    Calendar,
    MapPin,
    User,
    CheckCircle2,
    Truck,
    PackageCheck
} from 'lucide-react'
import { obtenerTransferenciaAction } from '@/actions/sucursales-transferencias.actions'
import { TransferenciaActions } from '@/components/sucursales/TransferenciaActions'

interface PageProps {
    params: {
        id: string
    }
}

async function getTransferencia(id: string) {
    const data = await obtenerTransferenciaAction(id)
    return data
}

export default async function TransferenciaDetallePage({ params }: PageProps) {
    const transferencia = await getTransferencia(params.id)
    if (!transferencia) notFound()

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                            <ArrowRightLeft className="w-8 h-8" />
                            {transferencia.numero_transferencia}
                        </h1>
                        <Badge variant={
                            transferencia.estado === 'recibida' ? 'default' :
                                transferencia.estado === 'pendiente' ? 'secondary' :
                                    transferencia.estado === 'en_transito' ? 'outline' : 'destructive'
                        } className="text-base px-3 py-1">
                            {transferencia.estado === 'en_transito' ? 'En Tránsito' :
                                transferencia.estado.charAt(0).toUpperCase() + transferencia.estado.slice(1)}
                        </Badge>
                    </div>
                    <p className="text-muted-foreground">
                        Solicitado el {new Date(transferencia.fecha_solicitud).toLocaleDateString()}
                    </p>
                </div>

                <TransferenciaActions
                    id={transferencia.id}
                    estado={transferencia.estado}
                />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Info General */}
                <Card>
                    <CardHeader>
                        <CardTitle>Información General</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <span className="text-sm text-muted-foreground flex items-center gap-1">
                                    <MapPin className="w-4 h-4" /> Origen
                                </span>
                                <p className="font-medium text-lg">{transferencia.sucursal_origen.nombre}</p>
                            </div>
                            <div className="text-right space-y-1">
                                <span className="text-sm text-muted-foreground flex items-center gap-1 justify-end">
                                    <MapPin className="w-4 h-4" /> Destino
                                </span>
                                <p className="font-medium text-lg">{transferencia.sucursal_destino.nombre}</p>
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground flex items-center gap-2">
                                    <User className="w-4 h-4" /> Solicitado por
                                </span>
                                <span>{transferencia.solicitado_por_user?.nombre} {transferencia.solicitado_por_user?.apellido}</span>
                            </div>

                            {transferencia.aprobado_por && (
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4" /> Aprobado por
                                    </span>
                                    <span>{transferencia.aprobado_por_user?.nombre} {transferencia.aprobado_por_user?.apellido}</span>
                                </div>
                            )}

                            {transferencia.recibido_por && (
                                <div className="flex justify-between">
                                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                                        <PackageCheck className="w-4 h-4" /> Recibido por
                                    </span>
                                    <span>{transferencia.recibido_por_user?.nombre} {transferencia.recibido_por_user?.apellido}</span>
                                </div>
                            )}
                        </div>

                        {transferencia.motivo && (
                            <div className="bg-muted/50 p-3 rounded-md mt-4">
                                <span className="text-xs font-semibold uppercase text-muted-foreground">Motivo</span>
                                <p className="text-sm mt-1">{transferencia.motivo}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Timeline / Estado */}
                <Card>
                    <CardHeader>
                        <CardTitle>Línea de Tiempo</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="relative border-l border-muted ml-2 space-y-6 pl-6 py-2">
                            {/* Solicitud */}
                            <div className="relative">
                                <span className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-background">
                                    <Calendar className="h-3 w-3" />
                                </span>
                                <div className="flex flex-col">
                                    <span className="font-medium">Solicitud Creada</span>
                                    <span className="text-sm text-muted-foreground">
                                        {new Date(transferencia.fecha_solicitud).toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* Aprobación */}
                            <div className="relative">
                                <span className={`absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background ${transferencia.fecha_aprobacion ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                                    }`}>
                                    <Truck className="h-3 w-3" />
                                </span>
                                <div className="flex flex-col">
                                    <span className={`font-medium ${!transferencia.fecha_aprobacion && 'text-muted-foreground'}`}>
                                        Enviado / En Tránsito
                                    </span>
                                    {transferencia.fecha_aprobacion && (
                                        <span className="text-sm text-muted-foreground">
                                            {new Date(transferencia.fecha_aprobacion).toLocaleString()}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Recepción */}
                            <div className="relative">
                                <span className={`absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background ${transferencia.fecha_recepcion ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                                    }`}>
                                    <PackageCheck className="h-3 w-3" />
                                </span>
                                <div className="flex flex-col">
                                    <span className={`font-medium ${!transferencia.fecha_recepcion && 'text-muted-foreground'}`}>
                                        Recibido en Destino
                                    </span>
                                    {transferencia.fecha_recepcion && (
                                        <span className="text-sm text-muted-foreground">
                                            {new Date(transferencia.fecha_recepcion).toLocaleString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Items */}
            <Card>
                <CardHeader>
                    <CardTitle>Items de la Transferencia</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground">
                                <tr>
                                    <th className="p-4 font-medium">Producto</th>
                                    <th className="p-4 font-medium">Código</th>
                                    <th className="p-4 font-medium text-right">Solicitado</th>
                                    <th className="p-4 font-medium text-right">Enviado</th>
                                    <th className="p-4 font-medium text-right">Recibido</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transferencia.items.map((item: any) => (
                                    <tr key={item.id} className="border-t">
                                        <td className="p-4 font-medium">{item.producto.nombre}</td>
                                        <td className="p-4 text-muted-foreground">{item.producto.codigo}</td>
                                        <td className="p-4 text-right font-medium">{item.cantidad_solicitada} {item.producto.unidad_medida}</td>
                                        <td className="p-4 text-right text-muted-foreground">
                                            {item.cantidad_enviada ? `${item.cantidad_enviada} ${item.producto.unidad_medida}` : '-'}
                                        </td>
                                        <td className="p-4 text-right text-muted-foreground">
                                            {item.cantidad_recibida ? `${item.cantidad_recibida} ${item.producto.unidad_medida}` : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
