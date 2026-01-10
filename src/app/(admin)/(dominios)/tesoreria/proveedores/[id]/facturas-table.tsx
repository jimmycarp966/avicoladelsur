'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { FileX, AlertTriangle } from 'lucide-react'
import { anularFacturaProveedorAction } from '@/actions/proveedores.actions'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface Factura {
    id: string
    numero_factura: string
    tipo_comprobante: string
    fecha_emision: string
    fecha_vencimiento: string | null
    monto_total: number
    monto_pagado: number
    estado: string
    descripcion: string | null
}

interface FacturasTableProps {
    facturas: Factura[]
}

const estadoColors: Record<string, string> = {
    pendiente: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    parcial: 'bg-blue-100 text-blue-800 border-blue-200',
    pagada: 'bg-green-100 text-green-800 border-green-200',
    vencida: 'bg-red-100 text-red-800 border-red-200',
    anulada: 'bg-gray-100 text-gray-500 border-gray-200',
}

const tipoLabels: Record<string, string> = {
    factura: 'Factura',
    remito: 'Remito',
    recibo: 'Recibo',
    nota_credito: 'Nota Crédito',
}

export function FacturasTable({ facturas }: FacturasTableProps) {
    const router = useRouter()

    async function handleAnular(id: string) {
        if (!confirm('¿Estás seguro de anular esta factura?')) return

        const result = await anularFacturaProveedorAction(id)
        if (result.success) {
            toast.success(result.message)
            router.refresh()
        } else {
            toast.error(result.error)
        }
    }

    function isVencida(factura: Factura) {
        if (!factura.fecha_vencimiento) return false
        if (factura.estado === 'pagada' || factura.estado === 'anulada') return false
        return new Date(factura.fecha_vencimiento) < new Date()
    }

    if (facturas.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                No hay facturas registradas para este proveedor
            </div>
        )
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Vencimiento</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Pagado</TableHead>
                        <TableHead className="text-right">Pendiente</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {facturas.map((factura) => {
                        const vencida = isVencida(factura)
                        const saldoPendiente = factura.monto_total - factura.monto_pagado

                        return (
                            <TableRow key={factura.id} className={vencida ? 'bg-red-50' : ''}>
                                <TableCell className="font-medium">
                                    {factura.numero_factura}
                                </TableCell>
                                <TableCell>
                                    {tipoLabels[factura.tipo_comprobante] || factura.tipo_comprobante}
                                </TableCell>
                                <TableCell>
                                    {format(new Date(factura.fecha_emision), 'dd/MM/yyyy', { locale: es })}
                                </TableCell>
                                <TableCell>
                                    {factura.fecha_vencimiento ? (
                                        <span className={vencida ? 'text-red-600 font-medium flex items-center gap-1' : ''}>
                                            {vencida && <AlertTriangle className="h-3 w-3" />}
                                            {format(new Date(factura.fecha_vencimiento), 'dd/MM/yyyy', { locale: es })}
                                        </span>
                                    ) : (
                                        <span className="text-muted-foreground">-</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                    {formatCurrency(factura.monto_total)}
                                </TableCell>
                                <TableCell className="text-right text-green-600">
                                    {formatCurrency(factura.monto_pagado)}
                                </TableCell>
                                <TableCell className="text-right font-bold text-red-600">
                                    {saldoPendiente > 0 ? formatCurrency(saldoPendiente) : '-'}
                                </TableCell>
                                <TableCell>
                                    <Badge className={estadoColors[factura.estado] || 'bg-gray-100'}>
                                        {factura.estado}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {factura.estado !== 'anulada' && factura.estado !== 'pagada' && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-500 hover:text-red-700"
                                            onClick={() => handleAnular(factura.id)}
                                            title="Anular factura"
                                        >
                                            <FileX className="h-4 w-4" />
                                        </Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    )
}
