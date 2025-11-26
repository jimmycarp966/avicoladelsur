'use client'

import { useEffect, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { DataTable, SortableHeader } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface Factura {
  id: string
  numero_factura: string
  cliente_nombre?: string | null
  cliente_id: string
  pedido_id: string
  fecha_emision: string
  subtotal: number
  descuento: number
  total: number
  estado: string
}

export function FacturasTable() {
  const [facturas, setFacturas] = useState<Factura[]>([])

  useEffect(() => {
    const loadFacturas = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('facturas')
        .select(
          `
          id,
          numero_factura,
          cliente_id,
          pedido_id,
          fecha_emision,
          subtotal,
          descuento,
          total,
          estado,
          cliente:clientes(razon_social, nombre)
        `
        )
        .order('fecha_emision', { ascending: false })
        .limit(200)

      if (!error && data) {
        const mapped: Factura[] = data.map((f: any) => ({
          id: f.id,
          numero_factura: f.numero_factura,
          cliente_id: f.cliente_id,
          pedido_id: f.pedido_id,
          fecha_emision: f.fecha_emision,
          subtotal: f.subtotal,
          descuento: f.descuento,
          total: f.total,
          estado: f.estado,
          cliente_nombre:
            f.cliente?.razon_social || f.cliente?.nombre || 'Cliente',
        }))
        setFacturas(mapped)
      }
    }

    loadFacturas()
  }, [])

  const columns: ColumnDef<Factura>[] = [
    {
      accessorKey: 'numero_factura',
      header: ({ column }) => (
        <SortableHeader column={column}>Factura</SortableHeader>
      ),
      cell: ({ row }) => {
        const numero = row.getValue('numero_factura') as string
        return <span className="font-semibold text-primary">#{numero}</span>
      },
    },
    {
      accessorKey: 'fecha_emision',
      header: ({ column }) => (
        <SortableHeader column={column}>Fecha</SortableHeader>
      ),
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
        return <span>{nombre}</span>
      },
    },
    {
      accessorKey: 'total',
      header: ({ column }) => (
        <SortableHeader column={column}>Total</SortableHeader>
      ),
      cell: ({ row }) => {
        const total = row.getValue('total') as number
        return (
          <span className="font-semibold text-foreground">
            {formatCurrency(total)}
          </span>
        )
      },
    },
    {
      accessorKey: 'estado',
      header: 'Estado',
      cell: ({ row }) => {
        const estado = row.getValue('estado') as string
        const variant = estado === 'anulada' ? 'destructive' : 'default'
        return <Badge variant={variant}>{estado}</Badge>
      },
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={facturas}
      searchKey="numero_factura"
      searchPlaceholder="Buscar por número de factura..."
      enableRowSelection={false}
      enableColumnVisibility={true}
      enablePagination={true}
      pageSize={15}
    />
  )
}


