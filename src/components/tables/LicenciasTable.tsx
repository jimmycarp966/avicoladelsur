'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTable, SortableHeader, StatusBadge } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Edit, Eye, CheckCircle, XCircle, Calendar } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Licencia } from '@/types/domain.types'

interface LicenciasTableProps {
  licencias: Licencia[]
  onView?: (licencia: Licencia) => void
  onApprove?: (licencia: Licencia) => void
  onReject?: (licencia: Licencia) => void
}

export function LicenciasTable({ licencias, onView, onApprove, onReject }: LicenciasTableProps) {
  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'vacaciones':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Vacaciones</Badge>
      case 'enfermedad':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Enfermedad</Badge>
      case 'maternidad':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Maternidad</Badge>
      case 'estudio':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Estudio</Badge>
      case 'otro':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Otro</Badge>
      default:
        return <Badge variant="outline">{tipo}</Badge>
    }
  }

  const getEstadoLicencia = (licencia: Licencia) => {
    const hoy = new Date()
    const inicio = new Date(licencia.fecha_inicio)
    const fin = new Date(licencia.fecha_fin)

    if (!licencia.aprobado) {
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pendiente</Badge>
    }

    if (hoy < inicio) {
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Programada</Badge>
    }

    if (hoy >= inicio && hoy <= fin) {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Activa</Badge>
    }

    return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Finalizada</Badge>
  }

  const columns: ColumnDef<Licencia>[] = [
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
      accessorKey: 'fecha_inicio',
      header: ({ column }) => (
        <SortableHeader column={column}>Fecha Inicio</SortableHeader>
      ),
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground">
          {formatDate(row.getValue('fecha_inicio'))}
        </div>
      ),
    },
    {
      accessorKey: 'fecha_fin',
      header: ({ column }) => (
        <SortableHeader column={column}>Fecha Fin</SortableHeader>
      ),
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground">
          {formatDate(row.getValue('fecha_fin'))}
        </div>
      ),
    },
    {
      accessorKey: 'dias_total',
      header: ({ column }) => (
        <SortableHeader column={column}>Días</SortableHeader>
      ),
      cell: ({ row }) => {
        const dias = row.getValue('dias_total') as number
        return (
          <div className="font-medium text-center">
            {dias} día{dias !== 1 ? 's' : ''}
          </div>
        )
      },
    },
    {
      accessorKey: 'aprobado',
      header: ({ column }) => (
        <SortableHeader column={column}>Estado</SortableHeader>
      ),
      cell: ({ row }) => {
        const licencia = row.original
        return getEstadoLicencia(licencia)
      },
    },
    {
      accessorKey: 'aprobado_por',
      header: 'Aprobado Por',
      cell: ({ row }) => {
        const aprobador = row.original.aprobado_por as any
        const nombre = aprobador && typeof aprobador === 'object' ? (aprobador.nombre || '') : ''
        const apellido = aprobador && typeof aprobador === 'object' ? (aprobador.apellido || '') : ''
        const nombreCompleto = `${nombre} ${apellido}`.trim()

        return (
          <div className="text-sm text-muted-foreground">
            {nombreCompleto || (row.original.aprobado ? 'Sistema' : '-')}
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => {
        const licencia = row.original
        return (
          <div className="flex items-center gap-2">
            {onView && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onView(licencia)}
                className="h-8 w-8 p-0"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {!licencia.aprobado && onApprove && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onApprove(licencia)}
                className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            {!licencia.aprobado && onReject && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onReject(licencia)}
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
      data={licencias}
      searchKey="empleado.usuario.nombre"
      searchPlaceholder="Buscar licencias..."
    />
  )
}
