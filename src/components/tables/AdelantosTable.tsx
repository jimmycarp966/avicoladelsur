'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTable, SortableHeader, StatusBadge } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye, CheckCircle, XCircle, DollarSign, Package } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Adelanto } from '@/types/domain.types'

interface AdelantosTableProps {
  adelantos: Adelanto[]
  onView?: (adelanto: Adelanto) => void
  onApprove?: (adelanto: Adelanto) => void
  onReject?: (adelanto: Adelanto) => void
}

export function AdelantosTable({ adelantos, onView, onApprove, onReject }: AdelantosTableProps) {
  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'dinero':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <DollarSign className="w-3 h-3 mr-1" />
            Dinero
          </Badge>
        )
      case 'producto':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Package className="w-3 h-3 mr-1" />
            Producto
          </Badge>
        )
      default:
        return <Badge variant="outline">{tipo}</Badge>
    }
  }

  const columns: ColumnDef<Adelanto>[] = [
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
      accessorKey: 'tipo',
      header: ({ column }) => (
        <SortableHeader column={column}>Tipo</SortableHeader>
      ),
      cell: ({ row }) => {
        const tipo = row.getValue('tipo') as string
        return getTipoBadge(tipo)
      },
    },
    {
      accessorKey: 'monto',
      header: ({ column }) => (
        <SortableHeader column={column}>Monto/Valor</SortableHeader>
      ),
      cell: ({ row }) => {
        const adelanto = row.original
        if (adelanto.tipo === 'dinero') {
          return (
            <div className="font-medium text-green-600">
              ${adelanto.monto?.toLocaleString() || '0'}
            </div>
          )
        } else {
          const cantidad = adelanto.cantidad || 0
          const precio = adelanto.precio_unitario || 0
          const total = cantidad * precio
          return (
            <div>
              <div className="font-medium text-blue-600">
                ${total.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">
                {cantidad} x ${precio.toLocaleString()}
              </div>
            </div>
          )
        }
      },
    },
    {
      accessorKey: 'producto.nombre',
      header: 'Producto',
      cell: ({ row }) => {
        const adelanto = row.original
        if (adelanto.tipo === 'producto' && adelanto.producto) {
          return (
            <div>
              <div className="font-medium">{adelanto.producto.nombre}</div>
              {adelanto.producto.codigo && (
                <div className="text-xs text-muted-foreground">
                  {adelanto.producto.codigo}
                </div>
              )}
            </div>
          )
        }
        return <span className="text-muted-foreground">-</span>
      },
    },
    {
      accessorKey: 'porcentaje_sueldo',
      header: ({ column }) => (
        <SortableHeader column={column}>% Sueldo</SortableHeader>
      ),
      cell: ({ row }) => {
        const porcentaje = row.getValue('porcentaje_sueldo') as number | null
        if (porcentaje) {
          return (
            <div className="text-sm">
              {porcentaje.toFixed(2)}%
            </div>
          )
        }
        return <span className="text-muted-foreground">-</span>
      },
    },
    {
      accessorKey: 'fecha_solicitud',
      header: ({ column }) => (
        <SortableHeader column={column}>Fecha Solicitud</SortableHeader>
      ),
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground">
          {formatDate(row.getValue('fecha_solicitud'))}
        </div>
      ),
    },
    {
      accessorKey: 'aprobado',
      header: ({ column }) => (
        <SortableHeader column={column}>Estado</SortableHeader>
      ),
      cell: ({ row }) => {
        const aprobado = row.getValue('aprobado') as boolean
        const fechaAprobacion = row.original.fecha_aprobacion
        return (
          <div className="flex flex-col items-center">
            <StatusBadge status={aprobado ? 'aprobado' : 'pendiente'} />
            {aprobado && fechaAprobacion && (
              <div className="text-xs text-muted-foreground mt-1">
                {formatDate(fechaAprobacion)}
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'aprobador.nombre',
      header: 'Aprobado Por',
      cell: ({ row }) => {
        const aprobador = row.original.aprobador
        if (aprobador) {
          return (
            <div className="text-sm">
              {aprobador.nombre} {aprobador.apellido}
            </div>
          )
        }
        return <span className="text-muted-foreground">-</span>
      },
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => {
        const adelanto = row.original
        return (
          <div className="flex items-center gap-2">
            {onView && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onView(adelanto)}
                className="h-8 w-8 p-0"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {onApprove && !adelanto.aprobado && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onApprove(adelanto)}
                className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            {onReject && !adelanto.aprobado && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onReject(adelanto)}
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
              >
                <XCircle className="h-4 w-4" />
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
      data={adelantos}
      searchKey="empleado.usuario.nombre"
      searchPlaceholder="Buscar adelantos..."
    />
  )
}

