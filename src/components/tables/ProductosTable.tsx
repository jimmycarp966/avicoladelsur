'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTable, SortableHeader, StatusBadge } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Edit, Trash2, Eye } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { Producto } from '@/types/domain.types'

interface ProductosTableProps {
  data: Producto[]
  onView?: (producto: Producto) => void
  onEdit?: (producto: Producto) => void
  onDelete?: (producto: Producto) => void
}

export function ProductosTable({ data, onView, onEdit, onDelete }: ProductosTableProps) {
  const columns: ColumnDef<Producto>[] = [
    {
      accessorKey: 'codigo',
      header: ({ column }) => (
        <SortableHeader column={column}>Código</SortableHeader>
      ),
      cell: ({ row }) => (
        <div className="font-semibold text-primary text-base">{row.getValue('codigo')}</div>
      ),
    },
    {
      accessorKey: 'nombre',
      header: ({ column }) => (
        <SortableHeader column={column}>Nombre</SortableHeader>
      ),
      cell: ({ row }) => (
        <div className="font-semibold text-foreground text-base">{row.getValue('nombre')}</div>
      ),
    },
    {
      accessorKey: 'categoria',
      header: 'Categoría',
      cell: ({ row }) => {
        const categoria = row.getValue('categoria') as string
        return categoria ? (
          <Badge variant="outline" className="text-sm font-medium">{categoria}</Badge>
        ) : (
          <span className="text-muted-foreground text-base">Sin categoría</span>
        )
      },
    },
    {
      accessorKey: 'precio_venta',
      header: ({ column }) => (
        <SortableHeader column={column}>Precio Venta</SortableHeader>
      ),
      cell: ({ row }) => {
        const precio = row.getValue('precio_venta') as number
        return (
          <div className="text-right font-bold text-foreground text-base">
            {formatCurrency(precio)}
          </div>
        )
      },
    },
    {
      accessorKey: 'stock_minimo',
      header: ({ column }) => (
        <SortableHeader column={column}>Stock Mínimo</SortableHeader>
      ),
      cell: ({ row }) => {
        const stock = row.getValue('stock_minimo') as number
        return (
          <div className="text-center font-semibold text-foreground text-base">
            {stock}
          </div>
        )
      },
    },
    {
      accessorKey: 'activo',
      header: 'Estado',
      cell: ({ row }) => {
        const activo = row.getValue('activo') as boolean
        return (
          <StatusBadge status={activo ? 'activo' : 'inactivo'} />
        )
      },
    },
  ]

  const actions = (producto: Producto) => (
    <>
      {onView && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onView(producto)}
          className="w-full justify-start"
        >
          <Eye className="mr-2 h-4 w-4" />
          Ver detalles
        </Button>
      )}
      {onEdit && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(producto)}
          className="w-full justify-start"
        >
          <Edit className="mr-2 h-4 w-4" />
          Editar
        </Button>
      )}
      {onDelete && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(producto)}
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
      searchKey="nombre"
      searchPlaceholder="Buscar productos..."
      actions={actions}
      enableRowSelection={true}
      enableColumnVisibility={true}
      enablePagination={true}
      pageSize={50}
    />
  )
}
