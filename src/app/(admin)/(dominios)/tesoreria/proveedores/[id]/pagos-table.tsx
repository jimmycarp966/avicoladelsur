'use client'

import { Badge } from '@/components/ui/badge'
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

interface Pago {
    id: string
    monto: number
    metodo_pago: string
    numero_transaccion: string | null
    descripcion: string | null
    fecha: string
    created_at: string
    factura: { numero_factura: string } | null
    caja: { nombre: string } | null
}

interface PagosTableProps {
    pagos: Pago[]
}

const metodoLabels: Record<string, string> = {
    transferencia: 'Transferencia',
    efectivo: 'Efectivo',
}

export function PagosTable({ pagos }: PagosTableProps) {
    if (pagos.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                No hay pagos registrados para este proveedor
            </div>
        )
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Factura</TableHead>
                        <TableHead>Caja</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Nº Transacción</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead>Descripción</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {pagos.map((pago) => (
                        <TableRow key={pago.id}>
                            <TableCell>
                                {format(new Date(pago.fecha), 'dd/MM/yyyy', { locale: es })}
                            </TableCell>
                            <TableCell>
                                {pago.factura?.numero_factura || (
                                    <Badge variant="outline" className="text-xs">
                                        A cuenta
                                    </Badge>
                                )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {pago.caja?.nombre || '-'}
                            </TableCell>
                            <TableCell>
                                <Badge variant="secondary">
                                    {metodoLabels[pago.metodo_pago] || pago.metodo_pago}
                                </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                                {pago.numero_transaccion || '-'}
                            </TableCell>
                            <TableCell className="text-right font-bold text-green-600">
                                {formatCurrency(pago.monto)}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-muted-foreground">
                                {pago.descripcion || '-'}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}
