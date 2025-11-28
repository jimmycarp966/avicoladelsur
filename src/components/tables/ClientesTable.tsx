'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTable, SortableHeader, StatusBadge } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Edit, Trash2, Eye, Phone, MessageCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Cliente } from '@/types/domain.types'

interface ClientesTableProps {
  data: Cliente[]
  onView?: (cliente: Cliente) => void
  onEdit?: (cliente: Cliente) => void
  onDelete?: (cliente: Cliente) => void
  onCall?: (cliente: Cliente) => void
  onWhatsApp?: (cliente: Cliente) => void
  onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void
  onSearchChange?: (search: string) => void
  serverPagination?: {
    pageIndex: number
    pageSize: number
    totalCount?: number
  }
}

export function ClientesTable({
  data,
  onView,
  onEdit,
  onDelete,
  onCall,
  onWhatsApp,
  onPaginationChange,
  onSearchChange,
  serverPagination
}: ClientesTableProps) {
  const columns: ColumnDef<Cliente>[] = [
    {
      accessorKey: 'codigo',
      header: ({ column }) => (
        <SortableHeader column={column}>Código</SortableHeader>
      ),
      cell: ({ row }) => (
        <div className="font-semibold text-primary text-base">{row.getValue('codigo')}</div>
      ),
    },
    {
      accessorKey: 'nombre',
      header: ({ column }) => (
        <SortableHeader column={column}>Cliente</SortableHeader>
      ),
      cell: ({ row }) => {
        const nombre = row.getValue('nombre') as string
        const telefono = row.original.telefono
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs bg-green-100 text-green-700">
                {nombre.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-semibold text-foreground text-base">{nombre}</div>
              {telefono && (
                <div className="text-sm text-muted-foreground mt-0.5">{telefono}</div>
              )}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'tipo_cliente',
      header: 'Tipo',
      cell: ({ row }) => {
        const tipo = row.getValue('tipo_cliente') as string
        const tipoConfig = {
          minorista: { label: 'Minorista', variant: 'secondary' as const },
          mayorista: { label: 'Mayorista', variant: 'default' as const },
          distribuidor: { label: 'Distribuidor', variant: 'outline' as const },
        }

        const config = tipoConfig[tipo as keyof typeof tipoConfig] || {
          label: tipo,
          variant: 'outline' as const,
        }

        return (
          <Badge variant={config.variant} className="text-sm font-semibold px-2.5 py-1">
            {config.label}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'zona_entrega',
      header: 'Zona',
      cell: ({ row }) => {
        const zona = row.getValue('zona_entrega') as string
        return zona ? (
          <Badge variant="outline" className="text-sm font-medium">{zona}</Badge>
        ) : (
          <span className="text-muted-foreground text-base">Sin zona</span>
        )
      },
    },
    {
      accessorKey: 'telefono',
      header: 'Contacto',
      cell: ({ row }) => {
        const telefono = row.getValue('telefono') as string
        const whatsapp = row.original.whatsapp
        return (
          <div className="space-y-1">
            {telefono && (
              <div className="flex items-center gap-1 text-sm">
                <Phone className="h-3 w-3" />
                {telefono}
              </div>
            )}
            {whatsapp && (
              <div className="flex items-center gap-1 text-sm text-green-600">
                <MessageCircle className="h-3 w-3" />
                {whatsapp}
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'activo',
      header: 'Estado',
      cell: ({ row }) => {
        const activo = row.getValue('activo') as boolean
        return <StatusBadge status={activo ? 'activo' : 'inactivo'} />
      },
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <SortableHeader column={column}>Registro</SortableHeader>
      ),
      cell: ({ row }) => {
        const fecha = row.getValue('created_at') as string
        return (
          <div className="text-base text-foreground font-medium">
            {formatDate(fecha)}
          </div>
        )
      },
    },
  ]

  const actions = (cliente: Cliente) => (
    <>
      {onView && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onView(cliente)}
          className="w-full justify-start"
        >
          <Eye className="mr-2 h-4 w-4" />
          Ver detalles
        </Button>
      )}
      {onCall && cliente.telefono && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onCall(cliente)}
          className="w-full justify-start"
        >
          <Phone className="mr-2 h-4 w-4" />
          Llamar
        </Button>
      )}
      {onWhatsApp && cliente.whatsapp && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onWhatsApp(cliente)}
          className="w-full justify-start text-green-600 hover:text-green-700 hover:bg-green-50"
        >
          <MessageCircle className="mr-2 h-4 w-4" />
          WhatsApp
        </Button>
      )}
      {onEdit && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(cliente)}
          className="w-full justify-start"
        >
          <Edit className="mr-2 h-4 w-4" />
          Editar
        </Button>
      )}
      {onDelete && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(cliente)}
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar
        </Button>
      )}
    </>
  )

  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey={serverPagination ? undefined : "nombre"} // Deshabilitar búsqueda del lado cliente cuando hay server-side
      searchPlaceholder="Buscar por código, nombre, teléfono, WhatsApp, email..."
      actions={actions}
      enableRowSelection={true}
      enableColumnVisibility={true}
      enablePagination={true}
      pageSize={15}
      onPaginationChange={onPaginationChange}
      onSearchChange={onSearchChange}
      serverPagination={serverPagination}
    />
  )
}
