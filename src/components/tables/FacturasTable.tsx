'use client'

import { useEffect, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { DataTable, SortableHeader } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye, FileText, MoreHorizontal, DollarSign } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Factura {
  id: string
  numero_factura: string
  cliente_nombre?: string | null
  cliente_id: string
  pedido_id: string
  fecha_emision: string
  fecha_vencimiento?: string | null
  subtotal: number
  descuento: number
  total: number
  monto_pagado: number
  saldo_pendiente: number
  estado: string
  estado_pago: 'pendiente' | 'parcial' | 'pagada' | 'anulada'
}

interface FacturasTableProps {
  onView?: (factura: Factura) => void
  onPrint?: (factura: Factura) => void
  clienteId?: string
}

export function FacturasTable({ onView, onPrint, clienteId }: FacturasTableProps = {}) {
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const loadFacturas = async () => {
      try {
        setLoading(true)
        setErrorMessage(null)
        const supabase = createClient()

        let query = supabase
          .from('facturas')
          .select(`
            id,
            numero_factura,
            cliente_id,
            pedido_id,
            fecha_emision,
            subtotal,
            descuento,
            total,
            estado,
            cliente:clientes(nombre)
          `)
          .order('fecha_emision', { ascending: false })
          .limit(200)

        if (clienteId) {
          query = query.eq('cliente_id', clienteId)
        }

        const { data, error } = await query

        if (error) {
          console.error('Error cargando comprobantes:', error.message, error.code, error.details)
          setErrorMessage('No se pudieron cargar los comprobantes. Intenta nuevamente.')
          return
        }

        const mapped: Factura[] = (data || []).map((f: any) => ({
          id: f.id,
          numero_factura: f.numero_factura,
          cliente_id: f.cliente_id,
          pedido_id: f.pedido_id,
          fecha_emision: f.fecha_emision,
          fecha_vencimiento: f.fecha_vencimiento || null,
          subtotal: f.subtotal,
          descuento: f.descuento,
          total: f.total,
          monto_pagado: f.monto_pagado || 0,
          saldo_pendiente: f.saldo_pendiente ?? f.total,
          estado: f.estado,
          estado_pago: f.estado_pago || 'pendiente',
          cliente_nombre: f.cliente?.nombre || 'Cliente',
        }))

        setFacturas(mapped)
      } catch (err) {
        console.error('Error inesperado cargando comprobantes:', err)
        setErrorMessage('Error inesperado al cargar comprobantes.')
      } finally {
        setLoading(false)
      }
    }

    loadFacturas()
  }, [clienteId])

  const getEstadoPagoBadge = (estado: string) => {
    switch (estado) {
      case 'pagada':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Pagada</Badge>
      case 'parcial':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Parcial</Badge>
      case 'pendiente':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Pendiente</Badge>
      case 'anulada':
        return <Badge variant="destructive">Anulada</Badge>
      default:
        return <Badge variant="secondary">{estado}</Badge>
    }
  }

  const columns: ColumnDef<Factura>[] = [
    {
      accessorKey: 'numero_factura',
      header: ({ column }) => <SortableHeader column={column}>Comprobante</SortableHeader>,
      cell: ({ row }) => {
        const numero = row.getValue('numero_factura') as string
        return <span className="font-semibold text-primary">{numero}</span>
      },
    },
    {
      accessorKey: 'fecha_emision',
      header: ({ column }) => <SortableHeader column={column}>Fecha</SortableHeader>,
      cell: ({ row }) => {
        const fecha = row.getValue('fecha_emision') as string
        return <span>{formatDate(fecha)}</span>
      },
    },
    {
      accessorKey: 'cliente_nombre',
      header: 'Cliente',
      cell: ({ row }) => {
        const nombre = (row.getValue('cliente_nombre') as string) || 'Cliente'
        const clienteIdValue = row.original.cliente_id
        return (
          <Link href={`/ventas/clientes/${clienteIdValue}`} className="hover:underline text-primary">
            {nombre}
          </Link>
        )
      },
    },
    {
      accessorKey: 'total',
      header: ({ column }) => <SortableHeader column={column}>Total</SortableHeader>,
      cell: ({ row }) => {
        const total = row.getValue('total') as number
        return <span className="font-semibold text-foreground">{formatCurrency(total)}</span>
      },
    },
    {
      accessorKey: 'saldo_pendiente',
      header: ({ column }) => <SortableHeader column={column}>Saldo</SortableHeader>,
      cell: ({ row }) => {
        const saldo = row.original.saldo_pendiente
        const estadoPago = row.original.estado_pago
        if (estadoPago === 'pagada') {
          return <span className="text-green-600">$0</span>
        }
        return (
          <span className={saldo > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
            {formatCurrency(saldo)}
          </span>
        )
      },
    },
    {
      accessorKey: 'estado_pago',
      header: 'Estado Pago',
      cell: ({ row }) => getEstadoPagoBadge(row.original.estado_pago),
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => {
        const factura = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Abrir menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              {onView && (
                <DropdownMenuItem onClick={() => onView(factura)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Ver detalles
                </DropdownMenuItem>
              )}
              {onPrint && (
                <DropdownMenuItem onClick={() => onPrint(factura)}>
                  <FileText className="mr-2 h-4 w-4" />
                  Imprimir
                </DropdownMenuItem>
              )}
              {factura.estado_pago !== 'pagada' && (
                <DropdownMenuItem asChild>
                  <Link href={`/ventas/clientes/${factura.cliente_id}/cuenta-corriente`}>
                    <DollarSign className="mr-2 h-4 w-4" />
                    Registrar pago
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando comprobantes...</div>
  }

  if (errorMessage) {
    return <div className="text-center py-8 text-destructive">{errorMessage}</div>
  }

  if (facturas.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No hay comprobantes para mostrar.</div>
  }

  return (
    <DataTable
      columns={columns}
      data={facturas}
      searchKey="numero_factura"
      searchPlaceholder="Buscar por numero de comprobante..."
      enableRowSelection={false}
      enableColumnVisibility
      enablePagination
      pageSize={15}
    />
  )
}

