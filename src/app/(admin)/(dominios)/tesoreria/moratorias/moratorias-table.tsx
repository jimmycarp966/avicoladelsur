'use client'

import { useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { DataTable, SortableHeader } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye, Phone, MessageCircle, AlertTriangle, Clock } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'

interface ClienteMoroso {
    cliente_id: string
    cliente_nombre: string
    cliente_telefono: string | null
    cliente_whatsapp: string | null
    bloqueado_por_deuda: boolean
    limite_credito: number
    saldo_cuenta_corriente: number
    total_facturas_pendientes: number
    total_deuda_facturas: number
    factura_mas_antigua_fecha: string | null
    dias_maximos_vencido: number
    total_mora_calculada: number
    dias_gracia: number
    porcentaje_mora: number
    deuda_total: number
}

interface MoratoriasTableProps {
    clientes: ClienteMoroso[]
}

export function MoratoriasTable({ clientes }: MoratoriasTableProps) {
    const getUrgenciaBadge = (dias: number) => {
        if (dias <= 0) {
            return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Al día</Badge>
        } else if (dias <= 7) {
            return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">⚠️ {dias}d</Badge>
        } else if (dias <= 30) {
            return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">⏰ {dias}d</Badge>
        } else if (dias <= 60) {
            return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">🔴 {dias}d</Badge>
        } else {
            return <Badge variant="destructive">🚨 {dias}d</Badge>
        }
    }

    const columns: ColumnDef<ClienteMoroso>[] = [
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
            accessorKey: 'dias_maximos_vencido',
            header: ({ column }) => (
                <SortableHeader column={column}>Días Vencido</SortableHeader>
            ),
            cell: ({ row }) => {
                const dias = row.original.dias_maximos_vencido
                return (
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {getUrgenciaBadge(dias)}
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
                return (
                    <Badge variant="outline">
                        {cantidad} pendiente{cantidad !== 1 ? 's' : ''}
                    </Badge>
                )
            },
        },
        {
            accessorKey: 'saldo_cuenta_corriente',
            header: ({ column }) => (
                <SortableHeader column={column}>Deuda CC</SortableHeader>
            ),
            cell: ({ row }) => {
                const saldo = row.original.saldo_cuenta_corriente
                return (
                    <span className={saldo > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                        {formatCurrency(saldo)}
                    </span>
                )
            },
        },
        {
            accessorKey: 'total_mora_calculada',
            header: ({ column }) => (
                <SortableHeader column={column}>Mora</SortableHeader>
            ),
            cell: ({ row }) => {
                const mora = row.original.total_mora_calculada
                if (mora <= 0) {
                    return <span className="text-muted-foreground">$0</span>
                }
                return (
                    <span className="text-amber-600 font-medium">
                        +{formatCurrency(mora)}
                    </span>
                )
            },
        },
        {
            accessorKey: 'deuda_total',
            header: ({ column }) => (
                <SortableHeader column={column}>Total Deuda</SortableHeader>
            ),
            cell: ({ row }) => {
                const total = row.original.deuda_total
                return (
                    <span className="font-bold text-red-700">
                        {formatCurrency(total)}
                    </span>
                )
            },
        },
        {
            accessorKey: 'limite_credito',
            header: 'Límite',
            cell: ({ row }) => {
                const limite = row.original.limite_credito
                const saldo = row.original.saldo_cuenta_corriente
                const porcentaje = limite > 0 ? (saldo / limite) * 100 : 0
                return (
                    <div className="text-sm">
                        <div>{formatCurrency(limite)}</div>
                        {limite > 0 && (
                            <div className="text-xs text-muted-foreground">
                                {porcentaje.toFixed(0)}% usado
                            </div>
                        )}
                    </div>
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
                                    href={`https://wa.me/${cliente.cliente_whatsapp.replace(/[^\d]/g, '')}?text=Hola, le contactamos de Avícola del Sur respecto a su cuenta pendiente.`}
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
                        <Button variant="outline" size="sm" asChild>
                            <Link href={`/ventas/clientes/${cliente.cliente_id}/cuenta-corriente`}>
                                <Eye className="h-4 w-4 mr-1" />
                                Ver cuenta
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
            pageSize={20}
        />
    )
}
