'use client'

import { Package, User, ChevronDown, MapPin, Clock, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion'
import type { Pedido } from '@/types/domain.types'

interface PedidoDetail {
    id: string
    numero_pedido: string
    estado: string
    total_final?: number | null
    fecha_entrega?: string
    turno?: string
    cliente?: {
        id?: string
        nombre?: string
        telefono?: string
        direccion?: string
    }
    zona?: {
        nombre?: string
    }
    items?: Array<{
        id: string
        cantidad_solicitada: number
        peso_final?: number | null
        producto?: {
            nombre?: string
            codigo?: string
        }
    }>
}

interface PedidosPreparadosViewProps {
    pedidos: PedidoDetail[]
    onView?: (pedido: PedidoDetail) => void
}

export function PedidosPreparadosView({ pedidos, onView }: PedidosPreparadosViewProps) {
    // Agrupar pedidos por estado "preparando", "entregado", etc.
    const pedidosPreparados = pedidos.filter(p =>
        ['preparando', 'en_ruta', 'entregado'].includes(p.estado)
    )

    // Agrupar pedidos preparados por zona/turno
    const pedidosPorZonaTurno = pedidosPreparados.reduce((acc, pedido) => {
        const key = `${pedido.zona?.nombre || 'Sin zona'}-${pedido.turno || 'Sin turno'}`
        if (!acc[key]) {
            acc[key] = {
                zona: pedido.zona?.nombre || 'Sin zona',
                turno: pedido.turno || 'Sin turno',
                pedidos: []
            }
        }
        acc[key].pedidos.push(pedido)
        return acc
    }, {} as Record<string, { zona: string; turno: string; pedidos: PedidoDetail[] }>)

    const grupos = Object.values(pedidosPorZonaTurno)

    if (grupos.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No hay pedidos preparados o en proceso</p>
            </div>
        )
    }

    const getEstadoBadge = (estado: string) => {
        switch (estado) {
            case 'preparando':
                return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Preparando</Badge>
            case 'en_ruta':
                return <Badge variant="secondary" className="bg-blue-100 text-blue-800">En Ruta</Badge>
            case 'entregado':
                return <Badge variant="secondary" className="bg-green-100 text-green-800">Entregado</Badge>
            default:
                return <Badge variant="outline">{estado}</Badge>
        }
    }

    return (
        <div className="space-y-6">
            {grupos.map((grupo) => (
                <Card key={`${grupo.zona}-${grupo.turno}`} className="border-l-4 border-l-primary">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-primary" />
                                <CardTitle className="text-lg">{grupo.zona}</CardTitle>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <Badge variant="outline">Turno {grupo.turno}</Badge>
                                <Badge variant="secondary">{grupo.pedidos.length} pedido(s)</Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Accordion type="multiple" className="space-y-2">
                            {grupo.pedidos.map((pedido) => (
                                <AccordionItem
                                    key={pedido.id}
                                    value={pedido.id}
                                    className="border rounded-lg px-4 bg-white hover:bg-slate-50 transition-colors"
                                >
                                    <AccordionTrigger className="py-3 hover:no-underline">
                                        <div className="flex items-center justify-between w-full pr-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-2">
                                                    <User className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-medium">{pedido.cliente?.nombre || 'Cliente desconocido'}</span>
                                                </div>
                                                <span className="text-sm text-muted-foreground">#{pedido.numero_pedido}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {getEstadoBadge(pedido.estado)}
                                                {pedido.total_final && (
                                                    <span className="font-semibold text-green-600">
                                                        ${pedido.total_final.toFixed(2)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pb-4">
                                        <div className="space-y-4">
                                            {/* Info del cliente */}
                                            <div className="flex items-start justify-between bg-slate-50 rounded-md p-3">
                                                <div>
                                                    <p className="text-sm text-muted-foreground">Dirección</p>
                                                    <p className="font-medium">{pedido.cliente?.direccion || 'Sin dirección'}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm text-muted-foreground">Teléfono</p>
                                                    <p className="font-medium">{pedido.cliente?.telefono || '-'}</p>
                                                </div>
                                            </div>

                                            {/* Items del pedido */}
                                            {pedido.items && pedido.items.length > 0 && (
                                                <div>
                                                    <p className="text-sm font-medium mb-2 text-muted-foreground">
                                                        Productos ({pedido.items.length})
                                                    </p>
                                                    <div className="space-y-1">
                                                        {pedido.items.map((item) => (
                                                            <div
                                                                key={item.id}
                                                                className="flex items-center justify-between py-1.5 px-2 rounded bg-white border text-sm"
                                                            >
                                                                <span>{item.producto?.nombre || 'Producto'}</span>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-muted-foreground">
                                                                        {item.cantidad_solicitada} {item.peso_final ? `→ ${item.peso_final.toFixed(2)}kg` : 'u'}
                                                                    </span>
                                                                    {item.peso_final && (
                                                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
