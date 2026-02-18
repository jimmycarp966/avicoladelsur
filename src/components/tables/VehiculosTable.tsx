'use client'

import { ColumnDef } from '@tanstack/react-table'
import { DataTable, SortableHeader } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Edit, Trash2, Eye, Truck, Wrench, FileCheck } from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'
import type { Vehiculo } from '@/types/domain.types'

interface VehiculosTableProps {
  data: Vehiculo[]
  onView?: (vehiculo: Vehiculo) => void
  onEdit?: (vehiculo: Vehiculo) => void
  onDelete?: (vehiculo: Vehiculo) => void
  onMaintenance?: (vehiculo: Vehiculo) => void
  onInspection?: (vehiculo: Vehiculo) => void
}

function documentoVigente(fecha?: string | null) {
  if (!fecha) return true
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const venc = new Date(fecha)
  venc.setHours(0, 0, 0, 0)
  return venc >= hoy
}

function DocumentoBadge({ label, fecha }: { label: string; fecha?: string | null }) {
  const vigente = documentoVigente(fecha)
  return (
    <div className="space-y-1">
      <Badge variant={vigente ? 'default' : 'destructive'} className="text-xs">
        {label}: {vigente ? 'VIGENTE' : 'VENCIDO'}
      </Badge>
      {fecha && <p className="text-[11px] text-muted-foreground">Vence: {formatDate(fecha)}</p>}
    </div>
  )
}

export function VehiculosTable({ data, onView, onEdit, onDelete, onMaintenance, onInspection }: VehiculosTableProps) {
  const columns: ColumnDef<Vehiculo>[] = [
    {
      accessorKey: 'patente',
      header: ({ column }) => <SortableHeader column={column}>Vehiculo</SortableHeader>,
      cell: ({ row }) => {
        const patente = row.getValue('patente') as string
        const vehiculo = row.original
        return (
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Truck className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <div className="font-semibold text-primary text-base">{patente}</div>
              <div className="text-sm text-muted-foreground mt-0.5">
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
        const tipoConfig: Record<string, { label: string; color: string }> = {
          Camion: { label: 'Camion', color: 'bg-blue-100 text-blue-800' },
          Furgon: { label: 'Furgon', color: 'bg-green-100 text-green-800' },
          Camioneta: { label: 'Camioneta', color: 'bg-yellow-100 text-yellow-900' },
          Moto: { label: 'Moto', color: 'bg-orange-100 text-orange-800' },
          Pickup: { label: 'Pickup', color: 'bg-indigo-100 text-indigo-800' },
        }
        const config = tipoConfig[tipo] || { label: tipo, color: 'bg-gray-100 text-gray-800' }
        return (
          <Badge variant="outline" className={cn(config.color, 'text-sm font-semibold px-2.5 py-1')}>
            {config.label}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'capacidad_kg',
      header: ({ column }) => <SortableHeader column={column}>Capacidad</SortableHeader>,
      cell: ({ row }) => {
        const capacidad = row.getValue('capacidad_kg') as number
        return <div className="font-bold text-foreground text-base">{capacidad} kg</div>
      },
    },
    {
      id: 'documentacion',
      header: 'Documentacion',
      cell: ({ row }) => {
        const vehiculo = row.original
        return (
          <div className="space-y-2 min-w-[180px]">
            <DocumentoBadge label="Seguro" fecha={vehiculo.fecha_vto_seguro} />
            <DocumentoBadge label="SENASA" fecha={vehiculo.fecha_vto_senasa} />
            <DocumentoBadge label="VTV" fecha={vehiculo.fecha_vto_vtv} />
          </div>
        )
      },
    },
    {
      id: 'combustible',
      header: 'Combustible',
      cell: ({ row }) => {
        const v = row.original
        if (v.combustible_actual_litros === undefined || v.capacidad_tanque_litros === undefined) {
          return <span className="text-sm text-muted-foreground">Sin datos</span>
        }
        const pct = v.capacidad_tanque_litros > 0
          ? (v.combustible_actual_litros / v.capacidad_tanque_litros) * 100
          : 0
        return (
          <div className="text-sm">
            <p className="font-semibold">{v.combustible_actual_litros.toFixed(1)} / {v.capacidad_tanque_litros.toFixed(1)} L</p>
            <p className="text-muted-foreground">{pct.toFixed(0)}%</p>
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
          <Badge variant={config.variant} className="text-sm font-semibold px-2.5 py-1">
            {config.label}
          </Badge>
        )
      },
    },
  ]

  const actions = (vehiculo: Vehiculo) => (
    <>
      {onView && (
        <Button variant="ghost" size="sm" onClick={() => onView(vehiculo)} className="w-full justify-start">
          <Eye className="mr-2 h-4 w-4" />
          Ver detalles
        </Button>
      )}
      {onInspection && (
        <Button variant="ghost" size="sm" onClick={() => onInspection(vehiculo)} className="w-full justify-start">
          <FileCheck className="mr-2 h-4 w-4" />
          Checklist diario
        </Button>
      )}
      {onMaintenance && (
        <Button variant="ghost" size="sm" onClick={() => onMaintenance(vehiculo)} className="w-full justify-start">
          <Wrench className="mr-2 h-4 w-4" />
          Programar mantenimiento
        </Button>
      )}
      {onEdit && (
        <Button variant="ghost" size="sm" onClick={() => onEdit(vehiculo)} className="w-full justify-start">
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
