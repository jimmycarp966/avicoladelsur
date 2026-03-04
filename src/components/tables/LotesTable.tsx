'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTable, SortableHeader, StatusBadge } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Edit, Trash2, Eye, AlertTriangle, Package } from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'
import type { Lote } from '@/types/domain.types'

interface LotesTableProps {
  data: Lote[]
  onView?: (lote: Lote) => void
  onEdit?: (lote: Lote) => void
  onDelete?: (lote: Lote) => void
  onAdjust?: (lote: Lote) => void
}

const getEstadoConfig = (estado: string, vencimiento?: string) => {
  const hoy = new Date()
  const fechaVencimiento = vencimiento ? new Date(vencimiento) : null
  const diasParaVencer = fechaVencimiento ? Math.ceil((fechaVencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)) : null

  if (estado === 'vencido' || (fechaVencimiento && fechaVencimiento < hoy)) {
    return { label: 'Vencido', variant: 'destructive' as const, color: 'bg-red-100 text-red-800' }
  }

  if (diasParaVencer !== null && diasParaVencer <= 7 && diasParaVencer > 0) {
    return { label: 'Próximo a Vencer', variant: 'secondary' as const, color: 'bg-yellow-100 text-yellow-800' }
  }

  if (estado === 'disponible') {
    return { label: 'Disponible', variant: 'default' as const, color: 'bg-green-100 text-green-800' }
  }

  if (estado === 'agotado') {
    return { label: 'Agotado', variant: 'secondary' as const, color: 'bg-gray-100 text-gray-800' }
  }

  return { label: estado, variant: 'outline' as const, color: 'bg-gray-100 text-gray-800' }
}

export function LotesTable({ data, onView, onEdit, onDelete, onAdjust }: LotesTableProps) {
  const columns: ColumnDef<Lote>[] = [
    {
      accessorKey: 'numero_lote',
      header: ({ column }) => (
        <SortableHeader column={column}>Lote</SortableHeader>
      ),
      cell: ({ row }) => {
        const numero = row.getValue('numero_lote') as string
        return (
          <div className="font-semibold text-primary text-base">
            #{numero}
          </div>
        )
      },
    },
    {
      accessorKey: 'producto_id',
      header: 'Producto',
      cell: ({ row }) => {
        const productoId = row.getValue('producto_id') as string
        // TODO: Implementar join con tabla productos para mostrar nombre
        // Por ahora mostramos el ID
        return (
          <div>
            <div className="font-semibold text-foreground text-base">Producto</div>
            <div className="text-sm text-muted-foreground mt-0.5">ID: {productoId?.slice(0, 8)}...</div>
          </div>
        )
      },
    },
    {
      accessorKey: 'cantidad_ingresada',
      header: ({ column }) => (
        <SortableHeader column={column}>Cant. Ingresada</SortableHeader>
      ),
      cell: ({ row }) => {
        const cantidad = row.getValue('cantidad_ingresada') as number
        const lote = row.original
        return (
          <div className="text-center">
            <div className="font-bold text-foreground text-lg">{cantidad}</div>
            <div className="text-sm text-muted-foreground mt-1 font-medium">
              Disponible: {lote.cantidad_disponible}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'fecha_ingreso',
      header: ({ column }) => (
        <SortableHeader column={column}>Ingreso</SortableHeader>
      ),
      cell: ({ row }) => {
        const fecha = row.getValue('fecha_ingreso') as string
        return (
          <div className="text-base text-foreground font-medium">
            {formatDate(fecha)}
          </div>
        )
      },
    },
    {
      accessorKey: 'fecha_vencimiento',
      header: ({ column }) => (
        <SortableHeader column={column}>Vencimiento</SortableHeader>
      ),
      cell: ({ row }) => {
        const fecha = row.getValue('fecha_vencimiento') as string
        const hoy = new Date()
        const fechaVenc = new Date(fecha)
        const diasParaVencer = Math.ceil((fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))

        return (
          <div>
            <div className="text-base text-foreground font-medium">
              {formatDate(fecha)}
            </div>
            {diasParaVencer <= 7 && diasParaVencer > 0 && (
              <div className="text-sm text-warning font-semibold mt-1">
                {diasParaVencer} días
              </div>
            )}
            {diasParaVencer <= 0 && (
              <div className="text-sm text-destructive font-semibold mt-1">
                Vencido
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'estado',
      header: 'Estado',
      cell: ({ row }) => {
        const estado = row.getValue('estado') as string
        const vencimiento = row.original.fecha_vencimiento
        const config = getEstadoConfig(estado, vencimiento)
        return (
          <Badge variant={config.variant} className={cn(config.color, "text-sm font-semibold px-2.5 py-1")}>
            {config.label}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'ubicacion_almacen',
      header: 'Ubicación',
      cell: ({ row }) => {
        const ubicacion = row.getValue('ubicacion_almacen') as string
        return ubicacion ? (
          <Badge variant="outline" className="text-sm font-medium">{ubicacion}</Badge>
        ) : (
          <span className="text-muted-foreground text-base">Sin ubicación</span>
        )
      },
    },
  ]

  const actions = (lote: Lote) => (
    <>
      {onView && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onView(lote)}
          className="w-full justify-start"
        >
          <Eye className="mr-2 h-4 w-4" />
          Ver detalles
        </Button>
      )}
      {onAdjust && lote.estado === 'disponible' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onAdjust(lote)}
          className="w-full justify-start"
        >
          <Package className="mr-2 h-4 w-4" />
          Ajustar stock
        </Button>
      )}
      {onEdit && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(lote)}
          className="w-full justify-start"
        >
          <Edit className="mr-2 h-4 w-4" />
          Editar
        </Button>
      )}
      {onDelete && lote.cantidad_disponible === lote.cantidad_ingresada && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(lote)}
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar
        </Button>
      )}
    </>
  )

  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="numero_lote"
      searchPlaceholder="Buscar por número de lote..."
      actions={actions}
      enableRowSelection={true}
      enableColumnVisibility={true}
      enablePagination={true}
      pageSize={50}
    />
  )
}
