'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTable, SortableHeader } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye, CheckCircle, XCircle, MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
      if (licencia.estado_revision === 'rechazado') {
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Rechazada</Badge>
      }
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pendiente RRHH</Badge>
    }

    if (hoy < inicio) {
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Programada</Badge>
    }

    if (hoy >= inicio && hoy <= fin) {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Activa</Badge>
    }

    return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Finalizada</Badge>
  }

  const getRevisionBadge = (licencia: Licencia) => {
    switch (licencia.estado_revision) {
      case 'aprobado':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Aprobado RRHH</Badge>
      case 'rechazado':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Rechazado RRHH</Badge>
      default:
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pendiente RRHH</Badge>
    }
  }

  const getIABadge = (licencia: Licencia) => {
    if (licencia.ia_certificado_valido === true) {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">IA valida</Badge>
    }
    if (licencia.ia_certificado_valido === false) {
      return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">IA observar</Badge>
    }
    return <Badge variant="outline">Sin IA</Badge>
  }

  const columns: ColumnDef<Licencia>[] = [
    {
      accessorKey: 'empleado.usuario.nombre',
      header: ({ column }) => <SortableHeader column={column}>Empleado</SortableHeader>,
      cell: ({ row }) => {
        const empleado = row.original.empleado
        const nombre = empleado?.usuario?.nombre || empleado?.nombre || ''
        const apellido = empleado?.usuario?.apellido || empleado?.apellido || ''
        const legajo = empleado?.legajo || ''
        const nombreCompleto = `${nombre} ${apellido}`.trim()

        return (
          <div>
            <div className="font-semibold text-foreground text-base">{nombreCompleto || 'Sin nombre'}</div>
            {legajo && <div className="text-sm text-muted-foreground">Legajo: {legajo}</div>}
          </div>
        )
      },
    },
    {
      accessorKey: 'tipo',
      header: ({ column }) => <SortableHeader column={column}>Tipo</SortableHeader>,
      cell: ({ row }) => getTipoBadge(row.getValue('tipo') as string),
    },
    {
      accessorKey: 'fecha_inicio',
      header: ({ column }) => <SortableHeader column={column}>Fecha Inicio</SortableHeader>,
      cell: ({ row }) => <div className="text-sm text-muted-foreground">{formatDate(row.getValue('fecha_inicio'))}</div>,
    },
    {
      accessorKey: 'fecha_fin',
      header: ({ column }) => <SortableHeader column={column}>Fecha Fin</SortableHeader>,
      cell: ({ row }) => <div className="text-sm text-muted-foreground">{formatDate(row.getValue('fecha_fin'))}</div>,
    },
    {
      accessorKey: 'dias_total',
      header: ({ column }) => <SortableHeader column={column}>Dias</SortableHeader>,
      cell: ({ row }) => {
        const dias = row.getValue('dias_total') as number
        return (
          <div className="font-medium text-center">
            {dias} dia{dias !== 1 ? 's' : ''}
          </div>
        )
      },
    },
    {
      id: 'certificado',
      header: 'Certificado',
      cell: ({ row }) =>
        row.original.certificado_url ? (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Cargado</Badge>
        ) : (
          <Badge variant="destructive">Falta</Badge>
        ),
    },
    {
      id: 'auditoria_ia',
      header: 'Auditoria IA',
      cell: ({ row }) => getIABadge(row.original),
    },
    {
      id: 'revision_rrhh',
      header: 'Revision RRHH',
      cell: ({ row }) => getRevisionBadge(row.original),
    },
    {
      accessorKey: 'aprobado',
      header: ({ column }) => <SortableHeader column={column}>Estado</SortableHeader>,
      cell: ({ row }) => getEstadoLicencia(row.original),
    },
    {
      accessorKey: 'aprobado_por',
      header: 'Aprobado Por',
      cell: ({ row }) => {
        const aprobador = row.original.aprobado_por as any
        const nombre = aprobador && typeof aprobador === 'object' ? aprobador.nombre || '' : ''
        const apellido = aprobador && typeof aprobador === 'object' ? aprobador.apellido || '' : ''
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Abrir menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {onView && (
                <DropdownMenuItem onClick={() => onView(licencia)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Ver detalles
                </DropdownMenuItem>
              )}
              {!licencia.aprobado && onApprove && (
                <DropdownMenuItem onClick={() => onApprove(licencia)}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Aprobar
                </DropdownMenuItem>
              )}
              {!licencia.aprobado && onReject && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onReject(licencia)}
                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Rechazar
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
      data={licencias}
      searchKey="empleado.usuario.nombre"
      searchPlaceholder="Buscar licencias..."
    />
  )
}
