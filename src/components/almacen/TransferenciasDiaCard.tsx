'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion'
import {
    ArrowRightLeft,
    MapPin,
    Clock,
    Scale,
    Package,
    CheckCircle2,
    Loader2,
    Building2
} from 'lucide-react'
import { toast } from 'sonner'
import { prepararTransferenciaAction } from '@/actions/sucursales-transferencias.actions'

interface TransferenciaItem {
    id: string
    cantidad_solicitada: number
    cantidad_enviada: number | null
    peso_preparado: number | null
    requiere_pesaje: boolean
    producto: {
        nombre: string
        codigo: string
        unidad_medida: string
        pesable: boolean
    }
}

interface Transferencia {
    id: string
    numero_transferencia: string
    estado: string
    turno: string | null
    fecha_entrega: string
    fecha_solicitud: string
    motivo: string | null
    sucursal_origen: { id: string; nombre: string }
    sucursal_destino: { id: string; nombre: string }
    zona: { id: string; nombre: string } | null
    items: TransferenciaItem[]
}

interface TransferenciasDiaCardProps {
    transferencias: Transferencia[]
}

export function TransferenciasDiaCard({ transferencias }: TransferenciasDiaCardProps) {
    const router = useRouter()
    const [loadingId, setLoadingId] = useState<string | null>(null)

    if (!transferencias || transferencias.length === 0) {
        return null
    }

    const calcularKgItem = (item: TransferenciaItem) => {
        if (item.peso_preparado) return item.peso_preparado
        if (item.cantidad_enviada) return item.cantidad_enviada
        return item.cantidad_solicitada || 0
    }

    const handlePreparar = async (transferenciaId: string) => {
        setLoadingId(transferenciaId)
        try {
            const result = await prepararTransferenciaAction(transferenciaId)
            if (result.success) {
                toast.success(result.message)
                router.refresh()
            } else {
                toast.error(result.message || 'Error al preparar transferencia')
            }
        } catch (error) {
            toast.error('Error inesperado al preparar transferencia')
        } finally {
            setLoadingId(null)
        }
    }

    // Agrupar por zona y turno
    const transferenciasPorZonaTurno = transferencias.reduce((acc: any, t: Transferencia) => {
        const key = `${t.zona?.id || 'sin-zona'}-${t.turno || 'sin-turno'}`
        if (!acc[key]) {
            acc[key] = {
                zona: t.zona,
                turno: t.turno,
                transferencias: [],
                totalKg: 0,
            }
        }
        acc[key].transferencias.push(t)
        acc[key].totalKg += t.items?.reduce((sum: number, item: TransferenciaItem) =>
            sum + calcularKgItem(item), 0) || 0
        return acc
    }, {})

    const totalTransferencias = transferencias.length
    const totalKg = transferencias.reduce((acc, t) =>
        acc + (t.items?.reduce((sum, item) => sum + calcularKgItem(item), 0) || 0), 0
    )
    const itemsPendientesPesaje = transferencias.reduce((acc, t) =>
        acc + (t.items?.filter(item => item.requiere_pesaje && !item.peso_preparado).length || 0), 0
    )

    return (
        <div className="space-y-6">
            {/* Resumen de transferencias */}
            <Card className="border-l-4 border-l-orange-500 bg-orange-50/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-700">
                        <ArrowRightLeft className="h-5 w-5" />
                        Transferencias del Día
                    </CardTitle>
                    <CardDescription>
                        Transferencias pendientes de preparación hacia sucursales
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-lg border border-orange-200 bg-white p-4">
                            <p className="text-xs uppercase text-muted-foreground">Total transferencias</p>
                            <p className="text-3xl font-semibold mt-1">{totalTransferencias}</p>
                        </div>
                        <div className="rounded-lg border border-orange-200 bg-white p-4">
                            <p className="text-xs uppercase text-muted-foreground">Kg estimados</p>
                            <p className="text-3xl font-semibold mt-1">{totalKg.toFixed(1)} kg</p>
                        </div>
                        <div className="rounded-lg border border-orange-200 bg-white p-4">
                            <p className="text-xs uppercase text-muted-foreground">Items por pesar</p>
                            <p className="text-3xl font-semibold mt-1">{itemsPendientesPesaje}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Lista de transferencias agrupadas */}
            {Object.entries(transferenciasPorZonaTurno).map(([key, grupo]: [string, any]) => (
                <Card key={key}>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Building2 className="h-5 w-5 text-orange-600" />
                                    {grupo.zona?.nombre || 'Sin zona'}
                                    {grupo.turno && (
                                        <>
                                            <span className="text-muted-foreground">•</span>
                                            <Clock className="h-4 w-4" />
                                            <span className="capitalize">{grupo.turno}</span>
                                        </>
                                    )}
                                </CardTitle>
                                <CardDescription>
                                    {grupo.transferencias.length} transferencia(s) • {grupo.totalKg.toFixed(1)} kg aproximados
                                </CardDescription>
                            </div>
                            <Badge variant="outline" className="text-lg bg-orange-50 border-orange-200 text-orange-700">
                                {grupo.totalKg.toFixed(1)} kg
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {grupo.transferencias.map((transferencia: Transferencia) => {
                                const itemsPesables = transferencia.items?.filter((item) => item.requiere_pesaje) || []
                                const itemsPesados = itemsPesables.filter((item) => item.peso_preparado)
                                const totalKgTransf = transferencia.items?.reduce((sum, item) =>
                                    sum + calcularKgItem(item), 0) || 0
                                const porcentajePesaje = itemsPesables.length > 0
                                    ? Math.round(itemsPesados.length * 100 / itemsPesables.length)
                                    : 100
                                const estaPreparada = transferencia.estado === 'preparado'

                                return (
                                    <Card key={transferencia.id} className="hover:shadow-md transition-shadow border-orange-100">
                                        <CardContent className="p-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <h3 className="text-lg font-semibold">
                                                            #{transferencia.numero_transferencia}
                                                        </h3>
                                                        <Badge variant={estaPreparada ? 'default' : 'secondary'}>
                                                            {estaPreparada ? 'Preparada' : 'En Almacén'}
                                                        </Badge>
                                                        <Badge variant="outline" className="bg-orange-50 text-orange-700">
                                                            <ArrowRightLeft className="mr-1 h-3 w-3" />
                                                            Transferencia
                                                        </Badge>
                                                    </div>

                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                                                        <MapPin className="h-4 w-4" />
                                                        <span>{transferencia.sucursal_origen.nombre}</span>
                                                        <span>→</span>
                                                        <span className="font-medium text-foreground">
                                                            {transferencia.sucursal_destino.nombre}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                                                        <span>
                                                            📦 {transferencia.items?.length || 0} items
                                                        </span>
                                                        <span>
                                                            ⚖️ {itemsPesables.length} pesables ({itemsPesados.length}/{itemsPesables.length})
                                                        </span>
                                                        <span>
                                                            🏋️ {totalKgTransf.toFixed(1)}kg
                                                        </span>
                                                    </div>

                                                    {transferencia.motivo && (
                                                        <p className="mt-2 text-sm text-muted-foreground italic">
                                                            Motivo: {transferencia.motivo}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <Button variant="outline" size="sm" asChild>
                                                        <Link href={`/sucursales/transferencias/${transferencia.id}`}>
                                                            Ver Detalle
                                                        </Link>
                                                    </Button>
                                                    {!estaPreparada && (
                                                        <>
                                                            {itemsPesables.length > 0 ? (
                                                                <Button asChild className="bg-orange-600 hover:bg-orange-700">
                                                                    <Link href={`/almacen/transferencia/${transferencia.id}/pesaje`}>
                                                                        <Scale className="mr-2 h-4 w-4" />
                                                                        Comenzar Pesaje
                                                                    </Link>
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    onClick={() => handlePreparar(transferencia.id)}
                                                                    disabled={loadingId === transferencia.id}
                                                                    className="bg-green-600 hover:bg-green-700"
                                                                >
                                                                    {loadingId === transferencia.id ? (
                                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                                    ) : (
                                                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                                                    )}
                                                                    Marcar Preparada
                                                                </Button>
                                                            )}
                                                        </>
                                                    )}
                                                    {estaPreparada && (
                                                        <Badge variant="default" className="bg-green-600">
                                                            <CheckCircle2 className="mr-1 h-3 w-3" />
                                                            Lista para ruta
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Barra de progreso de pesaje */}
                                            {itemsPesables.length > 0 && (
                                                <div className="mt-4">
                                                    <div className="flex items-center justify-between text-sm mb-2">
                                                        <span>Progreso de pesaje</span>
                                                        <span>{itemsPesados.length} de {itemsPesables.length} items</span>
                                                    </div>
                                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                                        <div
                                                            className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                                                            style={{ width: `${porcentajePesaje}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Items de la transferencia */}
                                            {transferencia.items?.length > 0 && (
                                                <div className="mt-4">
                                                    <Accordion type="single" collapsible className="rounded-lg border border-orange-100">
                                                        <AccordionItem value={`items-${transferencia.id}`}>
                                                            <AccordionTrigger className="px-4 py-2 text-sm">
                                                                Ver productos ({transferencia.items.length})
                                                            </AccordionTrigger>
                                                            <AccordionContent>
                                                                <div className="space-y-3 px-4 pb-4">
                                                                    {transferencia.items.map((item) => (
                                                                        <div
                                                                            key={item.id}
                                                                            className="flex items-start justify-between gap-4 rounded-md border border-orange-50 bg-white/80 px-3 py-2 text-sm"
                                                                        >
                                                                            <div>
                                                                                <p className="font-medium">
                                                                                    {item.producto?.nombre || 'Producto'}
                                                                                    {item.producto?.codigo && (
                                                                                        <span className="text-xs text-muted-foreground ml-1">
                                                                                            ({item.producto.codigo})
                                                                                        </span>
                                                                                    )}
                                                                                </p>
                                                                                <p className="text-xs text-muted-foreground">
                                                                                    {item.requiere_pesaje ? 'Pesable' : 'Unidad'} • Solicitado:{' '}
                                                                                    {item.cantidad_solicitada ?? 0} {item.producto?.unidad_medida || 'u'}
                                                                                    {item.requiere_pesaje && (
                                                                                        <>
                                                                                            {' '}•{' '}
                                                                                            {item.peso_preparado
                                                                                                ? `Pesado: ${item.peso_preparado} kg`
                                                                                                : 'Pendiente de pesaje'}
                                                                                        </>
                                                                                    )}
                                                                                </p>
                                                                            </div>
                                                                            <Badge
                                                                                variant="outline"
                                                                                className={
                                                                                    item.requiere_pesaje
                                                                                        ? item.peso_preparado
                                                                                            ? 'border-green-200 bg-green-50 text-green-700'
                                                                                            : 'border-yellow-200 bg-yellow-50 text-yellow-700'
                                                                                        : 'border-slate-200 bg-slate-50 text-slate-700'
                                                                                }
                                                                            >
                                                                                {item.requiere_pesaje
                                                                                    ? (item.peso_preparado ? 'Pesado' : 'Pendiente')
                                                                                    : 'Sin balanza'}
                                                                            </Badge>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </AccordionContent>
                                                        </AccordionItem>
                                                    </Accordion>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}

