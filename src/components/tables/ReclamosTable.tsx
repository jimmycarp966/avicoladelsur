'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTable, SortableHeader, StatusBadge } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye, Edit, CheckCircle, XCircle, Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Reclamo } from '@/types/domain.types'

interface ReclamoCompleto extends Reclamo {
  cliente?: { nombre: string; telefono?: string; codigo?: string }
  pedido?: { numero_pedido: string }
  usuario_asignado_obj?: { nombre: string; apellido?: string }
}

interface ReclamosTableProps {
  data: ReclamoCompleto[]
  onView?: (reclamo: ReclamoCompleto) => void
  onUpdateStatus?: (reclamo: ReclamoCompleto) => void
}

const tipoReclamoLabels: Record<string, string> = {
  producto_dañado: 'Producto Dañado',
  entrega_tardia: 'Entrega Tardía',
  cantidad_erronea: 'Cantidad Errónea',
  producto_equivocado: 'Producto Equivocado',
  precio_incorrecto: 'Precio Incorrecto',
  calidad_deficiente: 'Calidad Deficiente',
  empaque_dañado: 'Empaque Dañado',
  otro: 'Otro',
}

const prioridadColors: Record<string, string> = {
  baja: 'bg-gray-100 text-gray-800',
  media: 'bg-blue-100 text-blue-800',
  alta: 'bg-orange-100 text-orange-800',
  urgente: 'bg-red-100 text-red-800',
}

const estadoColors: Record<string, { bg: string; text: string }> = {
  abierto: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  investigando: { bg: 'bg-blue-100', text: 'text-blue-800' },
  resuelto: { bg: 'bg-green-100', text: 'text-green-800' },
  cerrado: { bg: 'bg-gray-100', text: 'text-gray-800' },
}

export function ReclamosTable({ data, onView, onUpdateStatus }: ReclamosTableProps) {
  const columns: ColumnDef<ReclamoCompleto>[] = [
    {
      accessorKey: 'numero_reclamo',
      header: ({ column }) => (
        <SortableHeader column={column}>Número</SortableHeader>
      ),
      cell: ({ row }) => (
        <div className="font-semibold text-primary text-base">{row.getValue('numero_reclamo')}</div>
      ),
    },
    {
      accessorKey: 'cliente',
      header: 'Cliente',
      cell: ({ row }) => {
        const cliente = row.original.cliente
        return (
          <div>
            <div className="font-medium">{cliente?.nombre || 'N/A'}</div>
            {cliente?.codigo && (
              <div className="text-xs text-muted-foreground">Código: {cliente.codigo}</div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'tipo_reclamo',
      header: 'Tipo',
      cell: ({ row }) => {
        const tipo = row.getValue('tipo_reclamo') as string
        return (
          <Badge variant="outline" className="text-xs">
            {tipoReclamoLabels[tipo] || tipo}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'descripcion',
      header: 'Descripción',
      cell: ({ row }) => {
        const descripcion = row.getValue('descripcion') as string
        return (
          <div className="max-w-md truncate" title={descripcion}>
            {descripcion}
          </div>
        )
      },
    },
    {
      accessorKey: 'estado',
      header: 'Estado',
      cell: ({ row }) => {
        const estado = row.getValue('estado') as string
        const colors = estadoColors[estado] || { bg: 'bg-gray-100', text: 'text-gray-800' }
        return (
          <Badge className={`${colors.bg} ${colors.text} border-0`}>
            {estado.charAt(0).toUpperCase() + estado.slice(1)}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'prioridad',
      header: 'Prioridad',
      cell: ({ row }) => {
        const prioridad = row.getValue('prioridad') as string
        return (
          <Badge className={prioridadColors[prioridad] || 'bg-gray-100 text-gray-800'}>
            {prioridad.charAt(0).toUpperCase() + prioridad.slice(1)}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'pedido',
      header: 'Pedido',
      cell: ({ row }) => {
        const pedido = row.original.pedido
        return pedido ? (
          <div className="text-sm font-medium">{pedido.numero_pedido}</div>
        ) : (
          <span className="text-muted-foreground text-sm">N/A</span>
        )
      },
    },
    {
      accessorKey: 'usuario_asignado_obj',
      header: 'Asignado a',
      cell: ({ row }) => {
        const usuario = row.original.usuario_asignado_obj
        return usuario ? (
          <div className="text-sm">
            {usuario.nombre} {usuario.apellido}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">Sin asignar</span>
        )
      },
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <SortableHeader column={column}>Fecha</SortableHeader>
      ),
      cell: ({ row }) => {
        const fecha = row.getValue('created_at') as string
        return <div className="text-sm">{formatDate(fecha)}</div>
      },
    },
  ]

  const actions = (reclamo: ReclamoCompleto) => (
    <>
      {onView && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onView(reclamo)}
          className="w-full justify-start"
        >
          <Eye className="mr-2 h-4 w-4" />
          Ver detalles
        </Button>
      )}
      {onUpdateStatus && reclamo.estado !== 'cerrado' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onUpdateStatus(reclamo)}
          className="w-full justify-start"
        >
          <Edit className="mr-2 h-4 w-4" />
          Actualizar estado
        </Button>
      )}
    </>
  )

  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="numero_reclamo"
      searchPlaceholder="Buscar por número, cliente o descripción..."
      actions={actions}
      enableRowSelection={true}
      enableColumnVisibility={true}
      enablePagination={true}
      pageSize={50}
    />
  )
}

