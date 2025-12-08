'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Check, X, Edit, Package, Building2 } from 'lucide-react'
import { 
    aprobarSolicitudAutomaticaAction, 
    rechazarSolicitudAutomaticaAction 
} from '@/actions/sucursales-transferencias.actions'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface SolicitudTransferenciaCardProps {
    solicitud: {
        id: string
        numero_transferencia: string
        sucursal_origen: { id: string; nombre: string }
        sucursal_destino: { id: string; nombre: string }
        fecha_solicitud: string
        observaciones?: string
        items: Array<{
            id: string
            cantidad_solicitada: number
            cantidad_sugerida?: number
            producto: {
                id: string
                nombre: string
                codigo: string
                unidad_medida: string
                stock_minimo: number
            }
        }>
    }
}

export function SolicitudTransferenciaCard({ solicitud }: SolicitudTransferenciaCardProps) {
    const router = useRouter()
    const [isModifying, setIsModifying] = useState(false)
    const [isApproving, setIsApproving] = useState(false)
    const [isRejecting, setIsRejecting] = useState(false)
    const [cantidades, setCantidades] = useState<Record<string, number>>(
        solicitud.items.reduce((acc, item) => {
            acc[item.id] = item.cantidad_sugerida || item.cantidad_solicitada
            return acc
        }, {} as Record<string, number>)
    )
    const [motivoRechazo, setMotivoRechazo] = useState('')

    const handleAprobar = async () => {
        setIsApproving(true)
        try {
            const itemsModificados = Object.entries(cantidades).map(([item_id, cantidad]) => ({
                item_id,
                cantidad
            }))

            const result = await aprobarSolicitudAutomaticaAction(
                solicitud.id,
                itemsModificados
            )

            if (result.success) {
                toast.success('Solicitud aprobada exitosamente')
                router.refresh()
            } else {
                toast.error(result.error || 'Error al aprobar solicitud')
            }
        } catch (error: any) {
            toast.error(error.message || 'Error al aprobar solicitud')
        } finally {
            setIsApproving(false)
            setIsModifying(false)
        }
    }

    const handleRechazar = async () => {
        if (!motivoRechazo.trim()) {
            toast.error('Debes proporcionar un motivo para rechazar')
            return
        }

        setIsRejecting(true)
        try {
            const result = await rechazarSolicitudAutomaticaAction(
                solicitud.id,
                motivoRechazo
            )

            if (result.success) {
                toast.success('Solicitud rechazada')
                router.refresh()
            } else {
                toast.error(result.error || 'Error al rechazar solicitud')
            }
        } catch (error: any) {
            toast.error(error.message || 'Error al rechazar solicitud')
        } finally {
            setIsRejecting(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Package className="w-5 h-5" />
                            {solicitud.numero_transferencia}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                            Generada automáticamente el {new Date(solicitud.fecha_solicitud).toLocaleString('es-AR')}
                        </p>
                    </div>
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                        Automática
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Información de sucursales */}
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <div>
                            <p className="text-sm font-medium">Desde</p>
                            <p className="text-sm text-muted-foreground">
                                {solicitud.sucursal_origen.nombre}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <div>
                            <p className="text-sm font-medium">Hacia</p>
                            <p className="text-sm text-muted-foreground">
                                {solicitud.sucursal_destino.nombre}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Items de la solicitud */}
                <div className="space-y-2">
                    <Label>Productos Solicitados</Label>
                    <div className="rounded-md border divide-y">
                        {solicitud.items.map((item) => (
                            <div key={item.id} className="p-3 flex items-center justify-between">
                                <div className="flex-1">
                                    <p className="font-medium">{item.producto.nombre}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {item.producto.codigo} • Stock mínimo: {item.producto.stock_minimo} {item.producto.unidad_medida}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isModifying ? (
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.001"
                                            value={cantidades[item.id] || 0}
                                            onChange={(e) => setCantidades({
                                                ...cantidades,
                                                [item.id]: parseFloat(e.target.value) || 0
                                            })}
                                            className="w-24"
                                        />
                                    ) : (
                                        <div className="text-right">
                                            <p className="font-medium">
                                                {item.cantidad_sugerida || item.cantidad_solicitada} {item.producto.unidad_medida}
                                            </p>
                                            {item.cantidad_sugerida && item.cantidad_sugerida !== item.cantidad_solicitada && (
                                                <p className="text-xs text-muted-foreground">
                                                    Sugerida: {item.cantidad_sugerida}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Observaciones */}
                {solicitud.observaciones && (
                    <div>
                        <Label>Observaciones</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                            {solicitud.observaciones}
                        </p>
                    </div>
                )}

                {/* Acciones */}
                <div className="flex gap-2 pt-2">
                    {isModifying ? (
                        <>
                            <Button
                                onClick={handleAprobar}
                                disabled={isApproving}
                                className="flex-1"
                            >
                                {isApproving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Aprobando...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4 mr-2" />
                                        Aprobar con Cambios
                                    </>
                                )}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsModifying(false)
                                    setCantidades(
                                        solicitud.items.reduce((acc, item) => {
                                            acc[item.id] = item.cantidad_sugerida || item.cantidad_solicitada
                                            return acc
                                        }, {} as Record<string, number>)
                                    )
                                }}
                            >
                                Cancelar
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                onClick={() => setIsModifying(true)}
                                variant="outline"
                                className="flex-1"
                            >
                                <Edit className="w-4 h-4 mr-2" />
                                Modificar Cantidades
                            </Button>
                            <Button
                                onClick={handleAprobar}
                                disabled={isApproving}
                                className="flex-1"
                            >
                                {isApproving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Aprobando...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4 mr-2" />
                                        Aprobar
                                    </>
                                )}
                            </Button>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="destructive" disabled={isRejecting}>
                                        <X className="w-4 h-4 mr-2" />
                                        Rechazar
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Rechazar Solicitud</DialogTitle>
                                        <DialogDescription>
                                            ¿Estás seguro de que deseas rechazar esta solicitud automática?
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                        <div>
                                            <Label htmlFor="motivo">Motivo del rechazo</Label>
                                            <Textarea
                                                id="motivo"
                                                value={motivoRechazo}
                                                onChange={(e) => setMotivoRechazo(e.target.value)}
                                                placeholder="Explica por qué rechazas esta solicitud..."
                                                className="mt-2"
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            variant="outline"
                                            onClick={() => setMotivoRechazo('')}
                                        >
                                            Cancelar
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            onClick={handleRechazar}
                                            disabled={isRejecting || !motivoRechazo.trim()}
                                        >
                                            {isRejecting ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    Rechazando...
                                                </>
                                            ) : (
                                                'Rechazar Solicitud'
                                            )}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

