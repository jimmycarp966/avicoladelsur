'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTable, SortableHeader, StatusBadge } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Edit, Eye, Send, Star, MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDate, formatFixed } from '@/lib/utils'
import type { Evaluacion } from '@/types/domain.types'

interface EvaluacionesTableProps {
  evaluaciones: Evaluacion[]
  onView?: (evaluacion: Evaluacion) => void
  onEdit?: (evaluacion: Evaluacion) => void
  onSend?: (evaluacion: Evaluacion) => void
}

export function EvaluacionesTable({ evaluaciones, onView, onEdit, onSend }: EvaluacionesTableProps) {
  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'borrador':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Borrador</Badge>
      case 'enviada':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Enviada</Badge>
      case 'completada':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Completada</Badge>
      default:
        return <Badge variant="outline">{estado}</Badge>
    }
  }

  const renderStars = (rating: number | null, maxStars: number = 5) => {
    return (
      <div className="flex items-center gap-1">
        {Array.from({ length: maxStars }, (_, i) => (
          <Star
            key={i}
            className={`w-4 h-4 ${
              rating && i < rating
                ? 'text-yellow-400 fill-current'
                : 'text-gray-300'
            }`}
          />
        ))}
        {rating && <span className="ml-1 text-sm text-gray-600">({rating})</span>}
      </div>
    )
  }

  const columns: ColumnDef<Evaluacion>[] = [
    {
      accessorKey: 'empleado.usuario.nombre',
      header: ({ column }) => (
        <SortableHeader column={column}>Empleado</SortableHeader>
      ),
      cell: ({ row }) => {
        const empleado = row.original.empleado
        // Usar nombre/apellido de usuario si existe, sino usar campos directos de empleado
        const nombre = empleado?.usuario?.nombre || empleado?.nombre || ''
        const apellido = empleado?.usuario?.apellido || empleado?.apellido || ''
        const legajo = empleado?.legajo || ''
        const nombreCompleto = `${nombre} ${apellido}`.trim()

        return (
          <div>
            <div className="font-semibold text-foreground text-base">
              {nombreCompleto || 'Sin nombre'}
            </div>
            {legajo && (
              <div className="text-sm text-muted-foreground">Legajo: {legajo}</div>
            )}
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
      accessorKey: 'periodo_mes',
      header: ({ column }) => (
        <SortableHeader column={column}>Período</SortableHeader>
      ),
      cell: ({ row }) => {
        const mes = row.getValue('periodo_mes') as number
        const anio = row.original.periodo_anio
        const meses = [
          'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
          'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
        ]
        return (
          <div className="text-sm">
            {meses[mes - 1]} {anio}
          </div>
        )
      },
    },
    {
      accessorKey: 'promedio',
      header: ({ column }) => (
        <SortableHeader column={column}>Promedio</SortableHeader>
      ),
      cell: ({ row }) => {
        const promedio = row.getValue('promedio') as number
        return (
          <div className="flex items-center gap-2">
            {renderStars(promedio)}
            {promedio && (
              <span className="font-medium text-lg">{formatFixed(promedio, 1, '0.0')}</span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'estado',
      header: ({ column }) => (
        <SortableHeader column={column}>Estado</SortableHeader>
      ),
      cell: ({ row }) => {
        const estado = row.getValue('estado') as string
        return getEstadoBadge(estado)
      },
    },
    {
      accessorKey: 'fecha_evaluacion',
      header: ({ column }) => (
        <SortableHeader column={column}>Fecha</SortableHeader>
      ),
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground">
          {formatDate(row.getValue('fecha_evaluacion'))}
        </div>
      ),
    },
    {
      accessorKey: 'evaluador.nombre',
      header: 'Evaluador',
      cell: ({ row }) => {
        const evaluador = row.original.evaluador
        const nombre = evaluador?.nombre || ''
        const apellido = evaluador?.apellido || ''
        const nombreCompleto = `${nombre} ${apellido}`.trim()

        return (
          <div className="text-sm text-muted-foreground">
            {nombreCompleto || 'Sin asignar'}
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => {
        const evaluacion = row.original
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
                <DropdownMenuItem onClick={() => onView(evaluacion)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Ver detalles
                </DropdownMenuItem>
              )}
              {onEdit && evaluacion.estado === 'borrador' && (
                <DropdownMenuItem onClick={() => onEdit(evaluacion)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
              )}
              {onSend && (evaluacion.estado === 'borrador' || evaluacion.estado === 'enviada') && (
                <DropdownMenuItem onClick={() => onSend(evaluacion)}>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar
                </DropdownMenuItem>
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
      data={evaluaciones}
      searchKey="empleado.usuario.nombre"
      searchPlaceholder="Buscar evaluaciones..."
    />
  )
}
