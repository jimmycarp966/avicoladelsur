'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface VentaDetalle {
  id: string
  numero_pedido: string
  fecha_pedido: string
  total: number
  estado: string
  pago_estado: string
  cliente_nombre: string
  cliente_zona: string
  vendedor_nombre: string
  productos_count: number
}

interface VentasDetailTableProps {
  data: VentaDetalle[]
  isLoading?: boolean
}

export function VentasDetailTable({ data, isLoading }: VentasDetailTableProps) {
  const columns: ColumnDef<VentaDetalle>[] = [
    {
      accessorKey: 'numero_pedido',
      header: 'N° Pedido',
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue('numero_pedido')}</span>
      ),
    },
    {
      accessorKey: 'fecha_pedido',
      header: 'Fecha',
      cell: ({ row }) => formatDate(row.getValue('fecha_pedido')),
    },
    {
      accessorKey: 'cliente_nombre',
      header: 'Cliente',
      cell: ({ row }) => row.getValue('cliente_nombre'),
    },
    {
      accessorKey: 'cliente_zona',
      header: 'Zona',
      cell: ({ row }) => (
        <Badge variant="outline">{row.getValue('cliente_zona') || 'Sin zona'}</Badge>
      ),
    },
    {
      accessorKey: 'vendedor_nombre',
      header: 'Vendedor',
      cell: ({ row }) => row.getValue('vendedor_nombre') || '-',
    },
    {
      accessorKey: 'productos_count',
      header: 'Productos',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.getValue('productos_count')}</span>
      ),
    },
    {
      accessorKey: 'total',
      header: 'Total',
      cell: ({ row }) => (
        <span className="font-semibold">{formatCurrency(row.getValue('total'))}</span>
      ),
    },
    {
      accessorKey: 'estado',
      header: 'Estado',
      cell: ({ row }) => {
        const estado = row.getValue('estado') as string
        const variant =
          estado === 'entregado'
            ? 'default'
            : estado === 'cancelado'
              ? 'destructive'
              : 'outline'
        return <Badge variant={variant}>{estado}</Badge>
      },
    },
    {
      accessorKey: 'pago_estado',
      header: 'Pago',
      cell: ({ row }) => {
        const pago = row.getValue('pago_estado') as string
        const variant =
          pago === 'pagado'
            ? 'default'
            : pago === 'parcial'
              ? 'warning'
              : 'outline'
        return <Badge variant={variant}>{pago}</Badge>
      },
    },
  ]

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Detalle de Ventas</CardTitle>
          <CardDescription>Cargando datos...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalle de Ventas</CardTitle>
        <CardDescription>Listado completo de ventas con filtros y ordenamiento</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={data}
          searchKey="numero_pedido"
          searchPlaceholder="Buscar por número de pedido, cliente..."
          enablePagination={true}
          pageSize={50}
        />
      </CardContent>
    </Card>
  )
}

