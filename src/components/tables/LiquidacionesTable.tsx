'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTable, SortableHeader, StatusBadge } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Edit, Eye, CheckCircle, DollarSign, MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDate } from '@/lib/utils'
import type { Liquidacion } from '@/types/domain.types'

interface LiquidacionesTableProps {
  liquidaciones: Liquidacion[]
  onView?: (liquidacion: Liquidacion) => void
  onEdit?: (liquidacion: Liquidacion) => void
  onApprove?: (liquidacion: Liquidacion) => void
  onPay?: (liquidacion: Liquidacion) => void
}

export function LiquidacionesTable({ liquidaciones, onView, onEdit, onApprove, onPay }: LiquidacionesTableProps) {
  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'borrador':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Borrador</Badge>
      case 'calculada':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Calculada</Badge>
      case 'aprobada':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Aprobada</Badge>
      case 'pagada':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Pagada</Badge>
      default:
        return <Badge variant="outline">{estado}</Badge>
    }
  }

  const columns: ColumnDef<Liquidacion>[] = [
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
      accessorKey: 'periodo_mes',
      header: ({ column }) => (
        <SortableHeader column={column}>Período</SortableHeader>
      ),
      cell: ({ row }) => {
        const mes = row.getValue('periodo_mes') as number
        const anio = row.original.periodo_anio
        const meses = [
          'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ]
        return (
          <div className="text-sm">
            {meses[mes - 1]} {anio}
          </div>
        )
      },
    },
    {
      accessorKey: 'total_bruto',
      header: ({ column }) => (
        <SortableHeader column={column}>Total Bruto</SortableHeader>
      ),
      cell: ({ row }) => {
        const total = row.getValue('total_bruto') as number
        return (
          <div className="font-medium text-green-600">
            ${total.toLocaleString()}
          </div>
        )
      },
    },
    {
      accessorKey: 'total_neto',
      header: ({ column }) => (
        <SortableHeader column={column}>Total Neto</SortableHeader>
      ),
      cell: ({ row }) => {
        const total = row.getValue('total_neto') as number
        return (
          <div className="font-semibold text-blue-600">
            ${total.toLocaleString()}
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
      accessorKey: 'pagado',
      header: ({ column }) => (
        <SortableHeader column={column}>Pagado</SortableHeader>
      ),
      cell: ({ row }) => {
        const pagado = row.getValue('pagado') as boolean
        const fechaPago = row.original.fecha_pago
        return (
          <div className="flex flex-col items-center">
            <StatusBadge status={pagado ? 'pagada' : 'pendiente'} />
            {pagado && fechaPago && (
              <div className="text-xs text-muted-foreground mt-1">
                {formatDate(fechaPago)}
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'fecha_liquidacion',
      header: ({ column }) => (
        <SortableHeader column={column}>Fecha Liquidación</SortableHeader>
      ),
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground">
          {formatDate(row.getValue('fecha_liquidacion'))}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => {
        const liquidacion = row.original
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
                <DropdownMenuItem onClick={() => onView(liquidacion)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Ver detalles
                </DropdownMenuItem>
              )}
              {onEdit && liquidacion.estado === 'borrador' && (
                <DropdownMenuItem onClick={() => onEdit(liquidacion)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
              )}
              {onApprove && (liquidacion.estado === 'borrador' || liquidacion.estado === 'calculada') && (
                <DropdownMenuItem onClick={() => onApprove(liquidacion)}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Aprobar
                </DropdownMenuItem>
              )}
              {onPay && liquidacion.estado === 'aprobada' && !liquidacion.pagado && (
                <DropdownMenuItem onClick={() => onPay(liquidacion)}>
                  <DollarSign className="mr-2 h-4 w-4" />
                  Marcar como pagada
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
      data={liquidaciones}
      searchKey="empleado.usuario.nombre"
      searchPlaceholder="Buscar liquidaciones..."
    />
  )
}
