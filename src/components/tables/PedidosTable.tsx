'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTable, SortableHeader, StatusBadge } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Edit, Trash2, Eye, Truck, FileText, Phone, Route } from 'lucide-react'
import { formatDate, formatCurrency, cn } from '@/lib/utils'
import type { Pedido } from '@/types/domain.types'

interface PedidosTableProps {
  data: Pedido[]
  onView?: (pedido: Pedido) => void
  onEdit?: (pedido: Pedido) => void
  onDelete?: (pedido: Pedido) => void
  onDeliver?: (pedido: Pedido) => void
  onPrint?: (pedido: Pedido) => void
  onRoute?: (pedido: Pedido) => void
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

export function PedidosTable({ data, onView, onEdit, onDelete, onDeliver, onPrint, onRoute }: PedidosTableProps) {
  const columns: ColumnDef<Pedido>[] = [
    {
      accessorKey: 'numero_pedido',
      header: ({ column }) => (
        <SortableHeader column={column}>Pedido</SortableHeader>
      ),
      cell: ({ row }) => {
        const numero = row.getValue('numero_pedido') as string
        return (
          <div className="font-semibold text-primary text-base">
            #{numero}
          </div>
        )
      },
    },
    {
      accessorKey: 'fecha_pedido',
      header: ({ column }) => (
        <SortableHeader column={column}>Fecha</SortableHeader>
      ),
      cell: ({ row }) => {
        const fecha = row.getValue('fecha_pedido') as string
        return (
          <div className="text-base text-foreground font-medium">
            {formatDate(fecha)}
          </div>
        )
      },
    },
    {
      accessorKey: 'cliente_id',
      header: 'Cliente',
      cell: ({ row }) => {
        const clienteId = row.getValue('cliente_id') as string
        // En producción, aquí haríamos una consulta para obtener el nombre del cliente
        return (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs">C</AvatarFallback>
            </Avatar>
            <span className="text-base font-medium text-foreground">Cliente {clienteId.slice(-4)}</span>
          </div>
        )
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
          <div className="font-bold text-foreground text-base">
            {formatCurrency(total)}
          </div>
        )
      },
    },
    {
      accessorKey: 'estado',
      header: 'Estado',
      cell: ({ row }) => {
        const estado = row.getValue('estado') as string
        const config = getEstadoConfig(estado)
        return (
          <Badge variant={config.variant} className={cn(config.color, "text-sm font-semibold px-2.5 py-1")}>
            {config.label}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'fecha_entrega_estimada',
      header: 'Entrega Estimada',
      cell: ({ row }) => {
        const fecha = row.getValue('fecha_entrega_estimada') as string
        return fecha ? (
          <div className="text-base text-foreground font-medium">
            {formatDate(fecha)}
          </div>
        ) : (
          <span className="text-muted-foreground text-base">Sin fecha</span>
        )
      },
    },
  ]

  const actions = (pedido: Pedido) => (
    <>
      {onView && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onView(pedido)}
          className="w-full justify-start"
        >
          <Eye className="mr-2 h-4 w-4" />
          Ver detalles
        </Button>
      )}
      {onEdit && pedido.estado === 'pendiente' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(pedido)}
          className="w-full justify-start"
        >
          <Edit className="mr-2 h-4 w-4" />
          Editar
        </Button>
      )}
      {onDeliver && (pedido.estado === 'confirmado' || pedido.estado === 'preparando') && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDeliver(pedido)}
          className="w-full justify-start"
        >
          <Truck className="mr-2 h-4 w-4" />
          Marcar entregado
        </Button>
      )}
      {onRoute && pedido.estado === 'preparando' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRoute(pedido)}
          className="w-full justify-start"
        >
          <Route className="mr-2 h-4 w-4" />
          Pasar a ruta
        </Button>
      )}
      {onPrint && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPrint(pedido)}
          className="w-full justify-start"
        >
          <FileText className="mr-2 h-4 w-4" />
          Imprimir
        </Button>
      )}
      {onDelete && pedido.estado === 'pendiente' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(pedido)}
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Cancelar
        </Button>
      )}
    </>
  )

  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="numero_pedido"
      searchPlaceholder="Buscar por número de pedido..."
      actions={actions}
      enableRowSelection={true}
      enableColumnVisibility={true}
      enablePagination={true}
      pageSize={15}
    />
  )
}