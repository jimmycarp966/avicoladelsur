'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTable, SortableHeader, StatusBadge } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Edit, Trash2, Eye, Phone, Mail } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Empleado } from '@/types/domain.types'

interface EmpleadosTableProps {
  empleados: Empleado[]
  onView?: (empleado: Empleado) => void
  onEdit?: (empleado: Empleado) => void
  onDelete?: (empleado: Empleado) => void
  onCall?: (empleado: Empleado) => void
  onEmail?: (empleado: Empleado) => void
}

export function EmpleadosTable({ empleados, onView, onEdit, onDelete, onCall, onEmail }: EmpleadosTableProps) {
  const columns: ColumnDef<Empleado>[] = [
    {
      accessorKey: 'legajo',
      header: ({ column }) => (
        <SortableHeader column={column}>Legajo</SortableHeader>
      ),
      cell: ({ row }) => (
        <div className="font-semibold text-primary text-base">
          {row.getValue('legajo') || '-'}
        </div>
      ),
    },
    {
      accessorKey: 'usuario.nombre',
      header: ({ column }) => (
        <SortableHeader column={column}>Empleado</SortableHeader>
      ),
      cell: ({ row }) => {
        const empleado = row.original
        const nombre = empleado.usuario?.nombre || ''
        const apellido = empleado.usuario?.apellido || ''
        const nombreCompleto = `${nombre} ${apellido}`.trim()
        const email = empleado.usuario?.email || ''

        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                {nombreCompleto.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-semibold text-foreground text-base">
                {nombreCompleto || 'Sin nombre'}
              </div>
              {email && (
                <div className="text-sm text-muted-foreground mt-0.5">{email}</div>
              )}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'sucursal.nombre',
      header: ({ column }) => (
        <SortableHeader column={column}>Sucursal</SortableHeader>
      ),
      cell: ({ row }) => {
        const sucursal = row.original.sucursal
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            {sucursal?.nombre || 'Sin asignar'}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'categoria.nombre',
      header: ({ column }) => (
        <SortableHeader column={column}>Categoría</SortableHeader>
      ),
      cell: ({ row }) => {
        const categoria = row.original.categoria
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            {categoria?.nombre || 'Sin asignar'}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'sueldo_actual',
      header: ({ column }) => (
        <SortableHeader column={column}>Sueldo</SortableHeader>
      ),
      cell: ({ row }) => {
        const sueldo = row.getValue('sueldo_actual') as number
        return (
          <div className="font-medium text-green-600">
            {sueldo ? `$${sueldo.toLocaleString()}` : '-'}
          </div>
        )
      },
    },
    {
      accessorKey: 'fecha_ingreso',
      header: ({ column }) => (
        <SortableHeader column={column}>Fecha Ingreso</SortableHeader>
      ),
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground">
          {formatDate(row.getValue('fecha_ingreso'))}
        </div>
      ),
    },
    {
      accessorKey: 'activo',
      header: ({ column }) => (
        <SortableHeader column={column}>Estado</SortableHeader>
      ),
      cell: ({ row }) => {
        const activo = row.getValue('activo') as boolean
        return (
          <StatusBadge status={activo ? 'activo' : 'inactivo'} />
        )
      },
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => {
        const empleado = row.original
        return (
          <div className="flex items-center gap-2">
            {onView && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onView(empleado)}
                className="h-8 w-8 p-0"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(empleado)}
                className="h-8 w-8 p-0"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {onCall && empleado.telefono_personal && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCall(empleado)}
                className="h-8 w-8 p-0"
              >
                <Phone className="h-4 w-4" />
              </Button>
            )}
            {onEmail && empleado.usuario?.email && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEmail(empleado)}
                className="h-8 w-8 p-0"
              >
                <Mail className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(empleado)}
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={empleados}
      searchKey="usuario.nombre"
      searchPlaceholder="Buscar empleados..."
    />
  )
}
