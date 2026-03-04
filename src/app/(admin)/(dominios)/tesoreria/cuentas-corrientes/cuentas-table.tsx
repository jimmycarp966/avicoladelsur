'use client'

import { useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { DataTable, SortableHeader } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye, Phone, MessageCircle, AlertTriangle, Clock, Wallet, CheckCircle2, AlertCircle } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { RecordatoriosDialog } from './recordatorios-dialog'

interface ClienteCuenta {
    cliente_id: string
    cliente_nombre: string
    cliente_telefono: string | null
    cliente_whatsapp: string | null
    bloqueado_por_deuda: boolean
    limite_credito: number
    saldo_cuenta_corriente: number
    total_facturas_pendientes: number
    ultimo_movimiento_fecha: string
    estado_cuenta: 'deudor' | 'favor' | 'al_dia'
    dias_gracia: number
    porcentaje_mora: number
}

interface CuentasTableProps {
    clientes: ClienteCuenta[]
}

export function CuentasCorrientesTable({ clientes }: CuentasTableProps) {
    const getEstadoBadge = (estado: string) => {
        switch (estado) {
            case 'deudor':
                return <Badge variant="destructive">🔴 Deudor</Badge>
            case 'favor':
                return <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200">🟢 A Favor</Badge>
            case 'al_dia':
                return <Badge variant="outline" className="text-gray-600">⚪ Al día</Badge>
            default:
                return <Badge variant="outline">{estado}</Badge>
        }
    }

    const columns: ColumnDef<ClienteCuenta>[] = [
        {
            accessorKey: 'cliente_nombre',
            header: ({ column }) => (
                <SortableHeader column={column}>Cliente</SortableHeader>
            ),
            cell: ({ row }) => {
                const cliente = row.original
                return (
                    <div className="flex flex-col">
                        <Link
                            href={`/ventas/clientes/${cliente.cliente_id}`}
                            className="font-medium text-primary hover:underline"
                        >
                            {cliente.cliente_nombre}
                        </Link>
                        <div className="flex items-center gap-2 mt-1">
                            {cliente.bloqueado_por_deuda && (
                                <Badge variant="destructive" className="text-xs">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Bloqueado
                                </Badge>
                            )}
                        </div>
                    </div>
                )
            },
        },
        {
            accessorKey: 'estado_cuenta',
            header: ({ column }) => (
                <SortableHeader column={column}>Estado</SortableHeader>
            ),
            cell: ({ row }) => getEstadoBadge(row.getValue('estado_cuenta')),
            filterFn: (row, id, value) => {
                return value.includes(row.getValue(id))
            },
        },
        {
            accessorKey: 'saldo_cuenta_corriente',
            header: ({ column }) => (
                <SortableHeader column={column}>Saldo</SortableHeader>
            ),
            cell: ({ row }) => {
                const saldo = row.original.saldo_cuenta_corriente
                if (saldo === 0) return <span className="text-muted-foreground">$0.00</span>

                return (
                    <span className={`font-bold ${saldo > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(saldo)}
                    </span>
                )
            },
        },
        {
            accessorKey: 'limite_credito',
            header: 'Límite / Disponible',
            cell: ({ row }) => {
                const limite = row.original.limite_credito
                const saldo = row.original.saldo_cuenta_corriente
                const disponible = limite - saldo

                return (
                    <div className="text-sm">
                        <div className="text-muted-foreground">Lím: {formatCurrency(limite)}</div>
                        <div className={`font-medium ${disponible < 0 ? 'text-red-500' : 'text-blue-600'}`}>
                            Disp: {formatCurrency(disponible)}
                        </div>
                    </div>
                )
            },
        },
        {
            accessorKey: 'total_facturas_pendientes',
            header: ({ column }) => (
                <SortableHeader column={column}>Facturas</SortableHeader>
            ),
            cell: ({ row }) => {
                const cantidad = row.original.total_facturas_pendientes
                if (cantidad === 0) return <span className="text-muted-foreground">-</span>
                return (
                    <Badge variant="outline">
                        {cantidad} pendiente{cantidad !== 1 ? 's' : ''}
                    </Badge>
                )
            },
        },
        {
            id: 'contacto',
            header: 'Contacto',
            cell: ({ row }) => {
                const cliente = row.original
                return (
                    <div className="flex items-center gap-1">
                        {cliente.cliente_telefono && (
                            <Button variant="ghost" size="sm" asChild>
                                <a href={`tel:${cliente.cliente_telefono}`} title="Llamar">
                                    <Phone className="h-4 w-4" />
                                </a>
                            </Button>
                        )}
                        {cliente.cliente_whatsapp && (
                            <Button variant="ghost" size="sm" asChild className="text-green-600">
                                <a
                                    href={`https://wa.me/${cliente.cliente_whatsapp.replace(/[^\d]/g, '')}?text=Hola, le contactamos de Avícola del Sur.`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="WhatsApp"
                                >
                                    <MessageCircle className="h-4 w-4" />
                                </a>
                            </Button>
                        )}
                    </div>
                )
            },
        },
        {
            id: 'actions',
            header: 'Acciones',
            cell: ({ row }) => {
                const cliente = row.original
                return (
                    <div className="flex items-center gap-1">
                        <RecordatoriosDialog
                            clienteId={cliente.cliente_id}
                            clienteNombre={cliente.cliente_nombre}
                        />
                        <Button variant="outline" size="sm" asChild>
                            <Link href={`/ventas/clientes/${cliente.cliente_id}/cuenta-corriente`}>
                                <Eye className="h-4 w-4 mr-1" />
                                Gestionar
                            </Link>
                        </Button>
                    </div>
                )
            },
        },
    ]

    return (
        <DataTable
            columns={columns}
            data={clientes}
            searchKey="cliente_nombre"
            searchPlaceholder="Buscar cliente..."
            enableRowSelection={false}
            enableColumnVisibility={true}
            enablePagination={true}
            pageSize={50}
        />
    )
}
