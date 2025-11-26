'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTable, SortableHeader, StatusBadge } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Edit, Eye, CheckCircle, DollarSign } from 'lucide-react'
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
          <div className="flex items-center gap-2">
            {onView && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onView(liquidacion)}
                className="h-8 w-8 p-0"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {onEdit && liquidacion.estado === 'borrador' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(liquidacion)}
                className="h-8 w-8 p-0"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {onApprove && (liquidacion.estado === 'borrador' || liquidacion.estado === 'calculada') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onApprove(liquidacion)}
                className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            {onPay && liquidacion.estado === 'aprobada' && !liquidacion.pagado && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onPay(liquidacion)}
                className="h-8 w-8 p-0 text-purple-600 hover:text-purple-700"
              >
                <DollarSign className="h-4 w-4" />
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
      data={liquidaciones}
      searchKey="empleado.usuario.nombre"
      searchPlaceholder="Buscar liquidaciones..."
    />
  )
}
