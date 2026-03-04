'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTable, SortableHeader, StatusBadge } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Edit, Trash2, Eye, Phone, Mail, MoreHorizontal } from 'lucide-react'
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
        // Usar nombre/apellido de usuario si existe, sino usar campos directos de empleado
        const nombre = empleado.usuario?.nombre || empleado.nombre || ''
        const apellido = empleado.usuario?.apellido || empleado.apellido || ''
        const nombreCompleto = `${nombre} ${apellido}`.trim()
        const email = empleado.usuario?.email || ''

        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                {nombreCompleto.charAt(0).toUpperCase() || '?'}
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
        <SortableHeader column={column}>Puesto</SortableHeader>
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Abrir menú</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {onView && (
                <DropdownMenuItem onClick={() => onView(empleado)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Legajo
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(empleado)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
              )}
              {(onCall || onEmail) && <DropdownMenuSeparator />}
              {onCall && empleado.telefono_personal && (
                <DropdownMenuItem onClick={() => onCall(empleado)}>
                  <Phone className="mr-2 h-4 w-4" />
                  Llamar
                </DropdownMenuItem>
              )}
              {onEmail && empleado.usuario?.email && (
                <DropdownMenuItem onClick={() => onEmail(empleado)}>
                  <Mail className="mr-2 h-4 w-4" />
                  Enviar email
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(empleado)}
                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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
