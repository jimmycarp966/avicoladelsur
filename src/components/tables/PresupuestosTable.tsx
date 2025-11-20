'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTable, SortableHeader, StatusBadge } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Edit,
  Eye,
  Package,
  Truck,
  ShoppingCart,
  AlertTriangle,
  Scale
} from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Database } from '@/types/database.types'

type Presupuesto = Database['public']['Tables']['presupuestos']['Row'] & {
  cliente?: { nombre: string; telefono?: string }
  zona?: { nombre: string }
  usuario_vendedor?: { nombre: string }
  items?: any[]
}

interface PresupuestosTableProps {
  data: Presupuesto[]
  onView?: (presupuesto: Presupuesto) => void
  onEdit?: (presupuesto: Presupuesto) => void
  onSendToWarehouse?: (presupuesto: Presupuesto) => void
  onReserveStock?: (presupuesto: Presupuesto) => void
  onConvertToOrder?: (presupuesto: Presupuesto) => void
}

const getEstadoConfig = (estado: string) => {
  const configs = {
    pendiente: { label: 'Pendiente', variant: 'secondary' as const, color: 'bg-yellow-100 text-yellow-800' },
    en_almacen: { label: 'En Almacén', variant: 'outline' as const, color: 'bg-blue-100 text-blue-800' },
    facturado: { label: 'Facturado', variant: 'default' as const, color: 'bg-green-100 text-green-800' },
    anulado: { label: 'Anulado', variant: 'destructive' as const, color: 'bg-red-100 text-red-800' },
  }
  return configs[estado as keyof typeof configs] || { label: estado, variant: 'outline' as const, color: 'bg-gray-100 text-gray-800' }
}

export function PresupuestosTable({
  data,
  onView,
  onEdit,
  onSendToWarehouse,
  onReserveStock,
  onConvertToOrder
}: PresupuestosTableProps) {
  const columns: ColumnDef<Presupuesto>[] = [
    {
      accessorKey: 'numero_presupuesto',
      header: ({ column }) => (
        <SortableHeader column={column}>Presupuesto</SortableHeader>
      ),
      cell: ({ row }) => {
        const numero = row.getValue('numero_presupuesto') as string
        return (
          <div className="font-medium text-blue-600">
            #{numero}
          </div>
        )
      },
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <SortableHeader column={column}>Fecha</SortableHeader>
      ),
      cell: ({ row }) => {
        const fecha = row.getValue('created_at') as string
        return (
          <div className="text-sm text-muted-foreground">
            {formatDate(fecha)}
          </div>
        )
      },
    },
    {
      accessorKey: 'cliente',
      header: 'Cliente',
      cell: ({ row }) => {
        const presupuesto = row.original
        const cliente = presupuesto.cliente
        return (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs">
                {cliente?.nombre?.charAt(0)?.toUpperCase() || 'C'}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{cliente?.nombre || 'Sin nombre'}</span>
              {cliente?.telefono && (
                <span className="text-xs text-muted-foreground">{cliente.telefono}</span>
              )}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'total_estimado',
      header: ({ column }) => (
        <SortableHeader column={column}>Total Est.</SortableHeader>
      ),
      cell: ({ row }) => {
        const total = row.getValue('total_estimado') as number
        return (
          <div className="font-medium">
            {formatCurrency(total || 0)}
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
          <Badge variant={config.variant} className={config.color}>
            {config.label}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'fecha_entrega_estimada',
      header: 'Entrega',
      cell: ({ row }) => {
        const fecha = row.getValue('fecha_entrega_estimada') as string
        if (!fecha) return <span className="text-muted-foreground">-</span>
        return (
          <div className="text-sm">
            {formatDate(fecha)}
          </div>
        )
      },
    },
    {
      accessorKey: 'zona',
      header: 'Zona',
      cell: ({ row }) => {
        const presupuesto = row.original
        const zona = presupuesto.zona
        return (
          <div className="text-sm">
            {zona?.nombre || '-'}
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => {
        const presupuesto = row.original
        const estado = presupuesto.estado

        return (
          <div className="flex items-center gap-1">
            {onView && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onView(presupuesto)}
                className="h-8 w-8 p-0"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}

            {estado === 'pendiente' && onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(presupuesto)}
                className="h-8 w-8 p-0"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}

            {estado === 'pendiente' && onSendToWarehouse && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSendToWarehouse(presupuesto)}
                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                title="Enviar a Almacén"
              >
                <Package className="h-4 w-4" />
              </Button>
            )}

            {estado === 'en_almacen' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(`/almacen/presupuesto/${presupuesto.id}/pesaje`, '_blank')}
                className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700"
                title="Ir a Pesaje"
              >
                <Scale className="h-4 w-4" />
              </Button>
            )}

            {estado === 'en_almacen' && onConvertToOrder && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onConvertToOrder(presupuesto)}
                className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                title="Convertir a Pedido"
              >
                <ShoppingCart className="h-4 w-4" />
              </Button>
            )}

            {/* Badge para items pesables */}
            {presupuesto.items?.some((item: any) => item.pesable) && (
              <Badge variant="outline" className="text-xs">
                <Scale className="h-3 w-3 mr-1" />
                BALANZA
              </Badge>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Buscar presupuestos..."
      searchColumn="numero_presupuesto"
    />
  )
}
