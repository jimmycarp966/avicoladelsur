'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTable, SortableHeader, StatusBadge } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Edit, Eye, Trash2, Megaphone, AlertTriangle, Info, CheckCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { NovedadRRHH } from '@/types/domain.types'

interface NovedadesTableProps {
  novedades: NovedadRRHH[]
  onView?: (novedad: NovedadRRHH) => void
  onEdit?: (novedad: NovedadRRHH) => void
  onDelete?: (novedad: NovedadRRHH) => void
}

export function NovedadesTable({ novedades, onView, onEdit, onDelete }: NovedadesTableProps) {
  const getPrioridadBadge = (prioridad: string) => {
    switch (prioridad) {
      case 'urgente':
        return <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200"><AlertTriangle className="w-3 h-3 mr-1" />Urgente</Badge>
      case 'alta':
        return <Badge variant="destructive" className="bg-orange-100 text-orange-800 border-orange-200">Alta</Badge>
      case 'normal':
        return <Badge variant="default" className="bg-blue-100 text-blue-800 border-blue-200">Normal</Badge>
      case 'baja':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800 border-gray-200">Baja</Badge>
      default:
        return <Badge variant="outline">{prioridad}</Badge>
    }
  }

  const getTipoBadge = (tipo: string, sucursal?: string, categoria?: string) => {
    switch (tipo) {
      case 'general':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><Megaphone className="w-3 h-3 mr-1" />General</Badge>
      case 'sucursal':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />{sucursal}</Badge>
      case 'categoria':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200"><Info className="w-3 h-3 mr-1" />{categoria}</Badge>
      default:
        return <Badge variant="outline">{tipo}</Badge>
    }
  }

  const columns: ColumnDef<NovedadRRHH>[] = [
    {
      accessorKey: 'titulo',
      header: ({ column }) => (
        <SortableHeader column={column}>Título</SortableHeader>
      ),
      cell: ({ row }) => {
        const titulo = row.getValue('titulo') as string
        const prioridad = row.original.prioridad
        return (
          <div className="flex items-center gap-2">
            <div>
              <div className="font-semibold text-foreground text-base max-w-xs truncate">
                {titulo}
              </div>
              <div className="mt-1">
                {getPrioridadBadge(prioridad)}
              </div>
            </div>
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
        const sucursal = row.original.sucursal?.nombre
        const categoria = row.original.categoria?.nombre
        return getTipoBadge(tipo, sucursal, categoria)
      },
    },
    {
      accessorKey: 'fecha_publicacion',
      header: ({ column }) => (
        <SortableHeader column={column}>Publicación</SortableHeader>
      ),
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground">
          {formatDate(row.getValue('fecha_publicacion'))}
        </div>
      ),
    },
    {
      accessorKey: 'fecha_expiracion',
      header: ({ column }) => (
        <SortableHeader column={column}>Expiración</SortableHeader>
      ),
      cell: ({ row }) => {
        const fechaExpiracion = row.getValue('fecha_expiracion') as string
        if (!fechaExpiracion) return <span className="text-muted-foreground">-</span>

        const hoy = new Date()
        const expiracion = new Date(fechaExpiracion)
        const isExpirado = expiracion < hoy

        return (
          <div className={`text-sm ${isExpirado ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
            {formatDate(fechaExpiracion)}
            {isExpirado && ' (Expirado)'}
          </div>
        )
      },
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
      accessorKey: 'created_by.nombre',
      header: 'Creador',
      cell: ({ row }) => {
        const creador = row.original.created_by as any
        const nombre = creador && typeof creador === 'object' ? (creador.nombre || '') : ''
        const apellido = creador && typeof creador === 'object' ? (creador.apellido || '') : ''
        const nombreCompleto = `${nombre} ${apellido}`.trim()

        return (
          <div className="text-sm text-muted-foreground">
            {nombreCompleto || 'Sistema'}
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => {
        const novedad = row.original
        return (
          <div className="flex items-center gap-2">
            {onView && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onView(novedad)}
                className="h-8 w-8 p-0"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(novedad)}
                className="h-8 w-8 p-0"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(novedad)}
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
      data={novedades}
      searchKey="titulo"
      searchPlaceholder="Buscar novedades..."
    />
  )
}
