'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTable, SortableHeader, StatusBadge } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Edit, Clock, AlertTriangle, CheckCircle } from 'lucide-react'
import { formatDate, formatTime } from '@/lib/utils'
import type { Asistencia } from '@/types/domain.types'

interface AsistenciaTableProps {
  asistencia: Asistencia[]
  onEdit?: (asistencia: Asistencia) => void
}

export function AsistenciaTable({ asistencia, onEdit }: AsistenciaTableProps) {
  const getEstadoBadge = (estado: string, retrasoMinutos: number, faltaSinAviso: boolean) => {
    if (faltaSinAviso) {
      return <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200"><AlertTriangle className="w-3 h-3 mr-1" />Falta S/A</Badge>
    }

    switch (estado) {
      case 'presente':
        if (retrasoMinutos > 0) {
          return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" />Retraso</Badge>
        }
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Presente</Badge>
      case 'ausente':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Ausente</Badge>
      case 'licencia':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Licencia</Badge>
      case 'tarde':
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Tarde</Badge>
      default:
        return <Badge variant="outline">{estado}</Badge>
    }
  }

  const getTurnoBadge = (turno?: string) => {
    switch (turno) {
      case 'mañana':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">🌅 Mañana</Badge>
      case 'tarde':
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">🌇 Tarde</Badge>
      case 'noche':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">🌙 Noche</Badge>
      default:
        return <Badge variant="outline" className="bg-gray-50 text-gray-700">Sin turno</Badge>
    }
  }

  const columns: ColumnDef<Asistencia>[] = [
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
      accessorKey: 'turno',
      header: ({ column }) => (
        <SortableHeader column={column}>Turno</SortableHeader>
      ),
      cell: ({ row }) => {
        const turno = row.getValue('turno') as string
        return getTurnoBadge(turno)
      },
    },
    {
      accessorKey: 'hora_entrada',
      header: ({ column }) => (
        <SortableHeader column={column}>Entrada</SortableHeader>
      ),
      cell: ({ row }) => {
        const horaEntrada = row.getValue('hora_entrada') as string
        return (
          <div className="text-sm font-mono">
            {horaEntrada ? formatTime(horaEntrada) : '-'}
          </div>
        )
      },
    },
    {
      accessorKey: 'hora_salida',
      header: ({ column }) => (
        <SortableHeader column={column}>Salida</SortableHeader>
      ),
      cell: ({ row }) => {
        const horaSalida = row.getValue('hora_salida') as string
        return (
          <div className="text-sm font-mono">
            {horaSalida ? formatTime(horaSalida) : '-'}
          </div>
        )
      },
    },
    {
      accessorKey: 'horas_trabajadas',
      header: ({ column }) => (
        <SortableHeader column={column}>Horas</SortableHeader>
      ),
      cell: ({ row }) => {
        const horas = row.getValue('horas_trabajadas') as number
        return (
          <div className="font-medium text-center">
            {horas ? `${horas.toFixed(1)}h` : '-'}
          </div>
        )
      },
    },
    {
      accessorKey: 'retraso_minutos',
      header: ({ column }) => (
        <SortableHeader column={column}>Retraso</SortableHeader>
      ),
      cell: ({ row }) => {
        const retrasoMinutos = row.getValue('retraso_minutos') as number
        const faltaSinAviso = row.original.falta_sin_aviso

        if (faltaSinAviso) {
          return <span className="text-red-600 font-medium">Falta S/A</span>
        }

        if (retrasoMinutos > 0) {
          return <span className="text-orange-600 font-medium">{retrasoMinutos} min</span>
        }

        return <span className="text-green-600">✓ Puntual</span>
      },
    },
    {
      accessorKey: 'estado',
      header: ({ column }) => (
        <SortableHeader column={column}>Estado</SortableHeader>
      ),
      cell: ({ row }) => {
        const estado = row.getValue('estado') as string
        const retrasoMinutos = row.original.retraso_minutos
        const faltaSinAviso = row.original.falta_sin_aviso
        return getEstadoBadge(estado, retrasoMinutos, faltaSinAviso)
      },
    },
    {
      accessorKey: 'observaciones',
      header: 'Observaciones',
      cell: ({ row }) => {
        const observaciones = row.getValue('observaciones') as string
        return (
          <div className="text-sm text-muted-foreground max-w-xs truncate">
            {observaciones || '-'}
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => {
        const asistencia = row.original
        return (
          <div className="flex items-center gap-2">
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(asistencia)}
                className="h-8 w-8 p-0"
              >
                <Edit className="h-4 w-4" />
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
      data={asistencia}
      searchKey="empleado.usuario.nombre"
      searchPlaceholder="Buscar asistencia..."
    />
  )
}
