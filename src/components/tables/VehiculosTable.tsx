'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTable, SortableHeader, StatusBadge } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Edit, Trash2, Eye, Truck, Wrench, FileCheck } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Vehiculo } from '@/types/domain.types'

interface VehiculosTableProps {
  data: Vehiculo[]
  onView?: (vehiculo: Vehiculo) => void
  onEdit?: (vehiculo: Vehiculo) => void
  onDelete?: (vehiculo: Vehiculo) => void
  onMaintenance?: (vehiculo: Vehiculo) => void
  onInspection?: (vehiculo: Vehiculo) => void
}

const getEstadoConfig = (estado: string) => {
  const configs = {
    activo: { label: 'Activo', variant: 'default' as const, color: 'bg-green-100 text-green-800' },
    mantenimiento: { label: 'En Mantenimiento', variant: 'secondary' as const, color: 'bg-yellow-100 text-yellow-800' },
    inactivo: { label: 'Inactivo', variant: 'secondary' as const, color: 'bg-gray-100 text-gray-800' },
    averiado: { label: 'Averiado', variant: 'destructive' as const, color: 'bg-red-100 text-red-800' },
  }
  return configs[estado as keyof typeof configs] || { label: estado, variant: 'outline' as const, color: 'bg-gray-100 text-gray-800' }
}

export function VehiculosTable({ data, onView, onEdit, onDelete, onMaintenance, onInspection }: VehiculosTableProps) {
  const columns: ColumnDef<Vehiculo>[] = [
    {
      accessorKey: 'patente',
      header: ({ column }) => (
        <SortableHeader column={column}>Vehículo</SortableHeader>
      ),
      cell: ({ row }) => {
        const patente = row.getValue('patente') as string
        const vehiculo = row.original
        return (
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Truck className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <div className="font-medium">{patente}</div>
              <div className="text-sm text-muted-foreground">
                {vehiculo.marca} {vehiculo.modelo}
              </div>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'tipo_vehiculo',
      header: 'Tipo',
      cell: ({ row }) => {
        const tipo = row.getValue('tipo_vehiculo') as string
        const tipoConfig = {
          camioneta: { label: 'Camioneta', color: 'bg-blue-100 text-blue-800' },
          furgon: { label: 'Furgón', color: 'bg-green-100 text-green-800' },
          moto: { label: 'Moto', color: 'bg-purple-100 text-purple-800' },
          bicicleta: { label: 'Bicicleta', color: 'bg-orange-100 text-orange-800' },
        }

        const config = tipoConfig[tipo as keyof typeof tipoConfig] || {
          label: tipo,
          color: 'bg-gray-100 text-gray-800',
        }

        return (
          <Badge variant="outline" className={config.color}>
            {config.label}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'capacidad_kg',
      header: ({ column }) => (
        <SortableHeader column={column}>Capacidad</SortableHeader>
      ),
      cell: ({ row }) => {
        const capacidad = row.getValue('capacidad_kg') as number
        return (
          <div className="text-center">
            <div className="font-medium">{capacidad}kg</div>
          </div>
        )
      },
    },
    {
      accessorKey: 'seguro_vigente',
      header: 'Seguro',
      cell: ({ row }) => {
        const vigente = row.getValue('seguro_vigente') as boolean
        const fechaVto = row.original.fecha_vto_seguro
        return (
          <div className="text-center">
            <Badge variant={vigente ? "default" : "destructive"}>
              {vigente ? "Vigente" : "Vencido"}
            </Badge>
            {fechaVto && (
              <div className="text-xs text-muted-foreground mt-1">
                Vence: {formatDate(fechaVto)}
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'estado',
      header: 'Estado',
      cell: ({ row }) => {
        const estado = row.getValue('estado') as string
        const estadoConfig = {
          activo: { label: 'Activo', variant: 'default' as const },
          mantenimiento: { label: 'Mantenimiento', variant: 'secondary' as const },
          inactivo: { label: 'Inactivo', variant: 'secondary' as const },
          averiado: { label: 'Averiado', variant: 'destructive' as const },
        }
        const config = estadoConfig[estado as keyof typeof estadoConfig] || { label: estado, variant: 'outline' as const }
        return (
          <Badge variant={config.variant}>
            {config.label}
          </Badge>
        )
      },
    },
  ]

  const actions = (vehiculo: Vehiculo) => (
    <>
      {onView && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onView(vehiculo)}
          className="w-full justify-start"
        >
          <Eye className="mr-2 h-4 w-4" />
          Ver detalles
        </Button>
      )}
      {onInspection && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onInspection(vehiculo)}
          className="w-full justify-start"
        >
          <FileCheck className="mr-2 h-4 w-4" />
          Checklist diario
        </Button>
      )}
      {onMaintenance && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onMaintenance(vehiculo)}
          className="w-full justify-start"
        >
          <Wrench className="mr-2 h-4 w-4" />
          Programar mantenimiento
        </Button>
      )}
      {onEdit && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(vehiculo)}
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
          onClick={() => onDelete(vehiculo)}
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
      searchKey="patente"
      searchPlaceholder="Buscar por patente, marca, modelo..."
      actions={actions}
      enableRowSelection={true}
      enableColumnVisibility={true}
      enablePagination={true}
      pageSize={15}
    />
  )
}
