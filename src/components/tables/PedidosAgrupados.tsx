'use client'

import { useMemo } from 'react'
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Pedido } from '@/types/domain.types'
import { Eye, Edit, Truck, Route, FileText, Trash2, Package, Scale } from 'lucide-react'

// Reutilizamos la interfaz del componente de tabla
interface EntregaItem {
    id: string
    cantidad_solicitada: number
    peso_final: number | null
    precio_unitario: number
    subtotal: number
    producto: {
        id: string
        nombre: string
        codigo: string
        unidad_medida: string
    } | null
}

interface Entrega {
    id: string
    cliente: { id: string; nombre: string } | null
    presupuesto_id: string | null
    presupuesto: {
        id: string
        numero_presupuesto: string
        items: EntregaItem[]
    } | null
    subtotal: number
    total: number
    estado_entrega: string
}

interface PedidoConEntregas extends Pedido {
    entregas?: Entrega[]
}

interface PedidosAgrupadosProps {
    data: PedidoConEntregas[]
    onView?: (pedido: PedidoConEntregas) => void
    onEdit?: (pedido: PedidoConEntregas) => void
    onDelete?: (pedido: PedidoConEntregas) => void
    onDeliver?: (pedido: PedidoConEntregas) => void
    onPrint?: (pedido: PedidoConEntregas) => void
    onRoute?: (pedido: PedidoConEntregas) => void
}

const getEstadoConfig = (estado: string) => {
    const configs = {
        pendiente: { label: 'Pendiente', variant: 'secondary' as const, color: 'bg-yellow-100 text-yellow-800' },
        confirmado: { label: 'Confirmado', variant: 'default' as const, color: 'bg-blue-100 text-blue-800' },
        preparando: { label: 'Preparando', variant: 'outline' as const, color: 'bg-purple-100 text-purple-800' },
        enviado: { label: 'Enviado', variant: 'secondary' as const, color: 'bg-orange-100 text-orange-800' },
        entregado: { label: 'Entregado', variant: 'default' as const, color: 'bg-green-100 text-green-800' },
        cancelado: { label: 'Cancelado', variant: 'destructive' as const, color: 'bg-red-100 text-red-800' },
    }
    return configs[estado as keyof typeof configs] || { label: estado, variant: 'outline' as const, color: 'bg-gray-100 text-gray-800' }
}

export function PedidosAgrupados({
    data,
    onView,
    onEdit,
    onDelete,
    onDeliver,
    onPrint,
    onRoute
}: PedidosAgrupadosProps) {

    // Agrupar pedidos por Cliente
    const pedidosPorCliente = useMemo(() => {
        const grupos: Record<string, { cliente: string, pedidos: PedidoConEntregas[] }> = {}

        data.forEach(pedido => {
            const clienteNombre = (pedido.cliente as any)?.nombre || 'Sin Cliente'
            const clienteId = (pedido.cliente as any)?.id || 'sin-id'

            if (!grupos[clienteId]) {
                grupos[clienteId] = {
                    cliente: clienteNombre,
                    pedidos: []
                }
            }
            grupos[clienteId].pedidos.push(pedido)
        })

        // Ordenar clientes alfabéticamente
        return Object.entries(grupos)
            .sort(([, a], [, b]) => a.cliente.localeCompare(b.cliente))
            .map(([id, grupo]) => ({ id, ...grupo }))
    }, [data])

    if (data.length === 0) {
        return (
            <div className="text-center py-10 border rounded-md bg-muted/10">
                <p className="text-muted-foreground">No hay pedidos registrados</p>
            </div>
        )
    }

    return (
        <Accordion type="multiple" className="w-full space-y-4">
            {pedidosPorCliente.map((grupo) => (
                <AccordionItem key={grupo.id} value={grupo.id} className="border rounded-lg px-4 bg-card">
                    <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center justify-between w-full pr-4">
                            <div className="flex items-center gap-3">
                                <span className="font-semibold text-lg">{grupo.cliente}</span>
                                <Badge variant="secondary" className="text-xs">
                                    {grupo.pedidos.length} pedido{grupo.pedidos.length !== 1 ? 's' : ''}
                                </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground font-medium">
                                Total: {formatCurrency(grupo.pedidos.reduce((sum, p) => sum + p.total, 0))}
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-4 space-y-4">
                        {grupo.pedidos.map(pedido => {
                            const estadoConfig = getEstadoConfig(pedido.estado)

                            return (
                                <Card key={pedido.id} className="overflow-hidden border-l-4 border-l-primary">
                                    <CardHeader className="bg-muted/20 py-3 px-4 flex flex-row items-center justify-between space-y-0">
                                        <div className="flex items-center gap-3">
                                            <CardTitle className="text-base">Pedido #{pedido.numero_pedido}</CardTitle>
                                            <Badge variant={estadoConfig.variant} className={estadoConfig.color}>
                                                {estadoConfig.label}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">{formatDate(pedido.fecha_entrega_estimada)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold">{formatCurrency(pedido.total)}</span>

                                            {/* Acciones */}
                                            <div className="flex items-center gap-1 ml-4 border-l pl-4">
                                                {onView && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onView(pedido)} title="Ver detalles">
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                {onPrint && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onPrint(pedido)} title="Imprimir">
                                                        <FileText className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                {onDeliver && (pedido.estado === 'confirmado' || pedido.estado === 'preparando') && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDeliver(pedido)} title="Marcar entregado">
                                                        <Truck className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        {pedido.entregas && pedido.entregas.map((entrega) => (
                                            <div key={entrega.id} className="p-3 border-b last:border-0 bg-white dark:bg-zinc-950">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Package className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-sm font-medium">Presupuesto {entrega.presupuesto?.numero_presupuesto || 'N/A'}</span>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6">
                                                    {entrega.presupuesto?.items?.map((item) => (
                                                        <div key={item.id} className="flex justify-between text-sm py-1 border-b border-dashed last:border-0">
                                                            <span className="text-muted-foreground">{item.producto?.nombre}</span>
                                                            <span className="font-medium">
                                                                {(item.peso_final || item.cantidad_solicitada || 0).toFixed(2)} {item.producto?.unidad_medida}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    )
}
