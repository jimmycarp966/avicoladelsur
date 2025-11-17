'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTable, SortableHeader, StatusBadge } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Edit, Trash2, Eye, AlertTriangle, Package } from 'lucide-react'
import { formatDate } from '@/lib/utils'
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
          <div className="font-medium text-blue-600">
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
        // En producción, aquí se haría una consulta para obtener el producto
        // Por ahora, simulamos con datos conocidos
        const productosMock = {
          '1': { nombre: 'Pollo Entero', codigo: 'POLLO001' },
          '2': { nombre: 'Pechuga de Pollo', codigo: 'POLLO002' },
          '3': { nombre: 'Huevos Blancos', codigo: 'HUEVO001' },
          '4': { nombre: 'Alas de Pollo', codigo: 'POLLO003' },
        }

        const producto = productosMock[productoId as keyof typeof productosMock]
        if (!producto) return <span className="text-muted-foreground">Sin producto</span>

        return (
          <div>
            <div className="font-medium">{producto.nombre}</div>
            <div className="text-sm text-muted-foreground">Código: {producto.codigo}</div>
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
            <div className="font-medium">{cantidad}</div>
            <div className="text-sm text-muted-foreground">
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
          <div className="text-sm text-muted-foreground">
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
          <div className="text-sm">
            {formatDate(fecha)}
            {diasParaVencer <= 7 && diasParaVencer > 0 && (
              <div className="text-xs text-orange-600 font-medium">
                {diasParaVencer} días
              </div>
            )}
            {diasParaVencer <= 0 && (
              <div className="text-xs text-red-600 font-medium">
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
          <Badge variant={config.variant} className={config.color}>
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
          <Badge variant="outline">{ubicacion}</Badge>
        ) : (
          <span className="text-muted-foreground">Sin ubicación</span>
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
      pageSize={15}
    />
  )
}
