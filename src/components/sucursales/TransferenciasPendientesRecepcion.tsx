'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion'
import {
    ArrowRightLeft,
    PackageCheck,
    Loader2,
    MapPin,
    AlertTriangle,
    CheckCircle2
} from 'lucide-react'
import { toast } from 'sonner'
import { confirmarRecepcionTransferenciaAction } from '@/actions/sucursales-transferencias.actions'

interface TransferenciaItem {
    id: string
    cantidad_solicitada: number
    cantidad_enviada: number | null
    cantidad_recibida: number | null
    producto: {
        nombre: string
        codigo: string
        unidad_medida: string
    }
}

interface Transferencia {
    id: string
    numero_transferencia: string
    estado: string
    fecha_solicitud: string
    motivo: string | null
    sucursal_origen: { id: string; nombre: string }
    sucursal_destino: { id: string; nombre: string }
    items: TransferenciaItem[]
}

interface TransferenciasPendientesRecepcionProps {
    transferencias: Transferencia[]
    sucursalId: string
}

export function TransferenciasPendientesRecepcion({
    transferencias,
    sucursalId
}: TransferenciasPendientesRecepcionProps) {
    const router = useRouter()
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [dialogOpen, setDialogOpen] = useState<string | null>(null)
    const [cantidadesRecibidas, setCantidadesRecibidas] = useState<Record<string, number>>({})
    const [hayDiferencias, setHayDiferencias] = useState(false)

    const handleConfirmarRecepcion = async (transferenciaId: string, conDiferencias: boolean = false) => {
        setLoadingId(transferenciaId)
        try {
            let itemsRecibidos: { item_id: string; cantidad_recibida: number }[] | undefined

            if (conDiferencias) {
                // Preparar items con cantidades ajustadas
                itemsRecibidos = Object.entries(cantidadesRecibidas).map(([itemId, cantidad]) => ({
                    item_id: itemId,
                    cantidad_recibida: cantidad
                }))
            }

            const result = await confirmarRecepcionTransferenciaAction(transferenciaId, itemsRecibidos)

            if (result.success) {
                toast.success(result.message || 'Transferencia recibida exitosamente')
                setDialogOpen(null)
                setCantidadesRecibidas({})
                router.refresh()
            } else {
                toast.error(result.message || 'Error al confirmar recepción')
            }
        } catch (error) {
            toast.error('Error inesperado al confirmar recepción')
        } finally {
            setLoadingId(null)
        }
    }

    const inicializarCantidades = (items: TransferenciaItem[]) => {
        const cantidades: Record<string, number> = {}
        items.forEach(item => {
            cantidades[item.id] = item.cantidad_enviada || item.cantidad_solicitada
        })
        setCantidadesRecibidas(cantidades)
    }

    const verificarDiferencias = (items: TransferenciaItem[]) => {
        const hasDiff = items.some(item => {
            const cantidadRecibida = cantidadesRecibidas[item.id]
            const cantidadEnviada = item.cantidad_enviada || item.cantidad_solicitada
            return cantidadRecibida !== undefined && cantidadRecibida !== cantidadEnviada
        })
        setHayDiferencias(hasDiff)
    }

    const getEstadoBadge = (estado: string) => {
        switch (estado) {
            case 'entregado':
                return <Badge className="bg-orange-500">Entregado - Confirmar Recepción</Badge>
            case 'en_ruta':
                return <Badge className="bg-indigo-500">En Ruta</Badge>
            case 'en_transito':
                return <Badge className="bg-blue-500">En Tránsito</Badge>
            default:
                return <Badge variant="secondary">{estado}</Badge>
        }
    }

    if (!transferencias || transferencias.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                No hay transferencias pendientes de recepción
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {transferencias.map((transferencia) => {
                const totalItems = transferencia.items?.length || 0
                const esEntregado = transferencia.estado === 'entregado'

                return (
                    <Card key={transferencia.id} className={`border-2 transition-shadow hover:shadow-lg ${esEntregado ? 'border-orange-400 bg-orange-50/50' : 'border-blue-200'}`}>
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-semibold">
                                            #{transferencia.numero_transferencia}
                                        </h3>
                                        {getEstadoBadge(transferencia.estado)}
                                    </div>

                                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                                        <MapPin className="h-4 w-4" />
                                        <span>Desde: <strong>{transferencia.sucursal_origen.nombre}</strong></span>
                                    </div>

                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                        <span>📦 {totalItems} productos</span>
                                        <span>📅 {new Date(transferencia.fecha_solicitud).toLocaleDateString('es-AR')}</span>
                                    </div>

                                    {transferencia.motivo && (
                                        <p className="mt-2 text-sm text-muted-foreground italic">
                                            Motivo: {transferencia.motivo}
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    {esEntregado ? (
                                        <>
                                            {/* Botón de confirmación rápida - GRANDE Y PROMINENTE */}
                                            <Button
                                                onClick={() => handleConfirmarRecepcion(transferencia.id)}
                                                disabled={loadingId === transferencia.id}
                                                className="bg-green-600 hover:bg-green-700 h-12 px-6 text-base font-bold"
                                            >
                                                {loadingId === transferencia.id ? (
                                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                ) : (
                                                    <CheckCircle2 className="mr-2 h-5 w-5" />
                                                )}
                                                CONFIRMAR RECEPCIÓN
                                            </Button>

                                            {/* Diálogo para reportar diferencias */}
                                            <Dialog
                                                open={dialogOpen === transferencia.id}
                                                onOpenChange={(open) => {
                                                    if (open) {
                                                        inicializarCantidades(transferencia.items)
                                                        setDialogOpen(transferencia.id)
                                                    } else {
                                                        setDialogOpen(null)
                                                        setCantidadesRecibidas({})
                                                    }
                                                }}
                                            >
                                                <DialogTrigger asChild>
                                                    <Button variant="outline" className="border-orange-300 text-orange-700">
                                                        <AlertTriangle className="mr-2 h-4 w-4" />
                                                        Hay Diferencias
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-2xl">
                                                    <DialogHeader>
                                                        <DialogTitle>Reportar Diferencias en Recepción</DialogTitle>
                                                        <DialogDescription>
                                                            Ajusta las cantidades recibidas si hay diferencias con lo enviado
                                                        </DialogDescription>
                                                    </DialogHeader>

                                                    <div className="space-y-4 max-h-96 overflow-y-auto">
                                                        {transferencia.items.map((item) => {
                                                            const cantidadEnviada = item.cantidad_enviada || item.cantidad_solicitada
                                                            const cantidadRecibida = cantidadesRecibidas[item.id] ?? cantidadEnviada

                                                            return (
                                                                <div key={item.id} className="flex items-center gap-4 p-3 border rounded-lg">
                                                                    <div className="flex-1">
                                                                        <p className="font-medium">{item.producto.nombre}</p>
                                                                        <p className="text-sm text-muted-foreground">
                                                                            Código: {item.producto.codigo} | Enviado: {cantidadEnviada} {item.producto.unidad_medida}
                                                                        </p>
                                                                    </div>
                                                                    <div className="w-32">
                                                                        <Label className="text-xs">Recibido</Label>
                                                                        <Input
                                                                            type="number"
                                                                            step="0.01"
                                                                            min="0"
                                                                            value={cantidadRecibida}
                                                                            onChange={(e) => {
                                                                                const newValue = parseFloat(e.target.value) || 0
                                                                                setCantidadesRecibidas(prev => ({
                                                                                    ...prev,
                                                                                    [item.id]: newValue
                                                                                }))
                                                                                verificarDiferencias(transferencia.items)
                                                                            }}
                                                                            className={cantidadRecibida !== cantidadEnviada ? 'border-orange-400' : ''}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>

                                                    <DialogFooter>
                                                        <Button variant="outline" onClick={() => setDialogOpen(null)}>
                                                            Cancelar
                                                        </Button>
                                                        <Button
                                                            onClick={() => handleConfirmarRecepcion(transferencia.id, true)}
                                                            disabled={loadingId === transferencia.id}
                                                            className="bg-orange-600 hover:bg-orange-700"
                                                        >
                                                            {loadingId === transferencia.id ? (
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <PackageCheck className="mr-2 h-4 w-4" />
                                                            )}
                                                            Confirmar con Diferencias
                                                        </Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>
                                        </>
                                    ) : (
                                        <Badge variant="outline" className="text-muted-foreground">
                                            En camino...
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            {/* Lista de items */}
                            <Accordion type="single" collapsible className="mt-4">
                                <AccordionItem value={`items-${transferencia.id}`}>
                                    <AccordionTrigger className="text-sm">
                                        Ver productos ({transferencia.items.length})
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-2">
                                            {transferencia.items.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="flex items-center justify-between p-2 bg-muted/30 rounded"
                                                >
                                                    <div>
                                                        <p className="font-medium text-sm">{item.producto.nombre}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {item.producto.codigo}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-semibold">
                                                            {item.cantidad_enviada || item.cantidad_solicitada} {item.producto.unidad_medida}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            Solicitado: {item.cantidad_solicitada}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
}

