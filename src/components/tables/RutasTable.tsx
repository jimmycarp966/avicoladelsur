"use client"

import Link from 'next/link'
import { ColumnDef } from '@tanstack/react-table'
import { DataTable, SortableHeader } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Edit, Trash2, Eye, Truck, MapPin, Navigation, CheckCircle } from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'
import type { RutaReparto as Ruta } from '@/types/domain.types'

interface RutasTableProps {
  data: Ruta[]
  onView?: (ruta: Ruta) => void
  onEdit?: (ruta: Ruta) => void
  onDelete?: (ruta: Ruta) => void
  onStart?: (ruta: Ruta) => void
  onComplete?: (ruta: Ruta) => void
}

const getEstadoConfig = (estado: string) => {
  const configs = {
    planificada: { label: 'Planificada', variant: 'secondary' as const, color: 'bg-blue-100 text-blue-800' },
    en_curso: { label: 'En Curso', variant: 'default' as const, color: 'bg-green-100 text-green-800' },
    completada: { label: 'Completada', variant: 'default' as const, color: 'bg-purple-100 text-purple-800' },
    cancelada: { label: 'Cancelada', variant: 'destructive' as const, color: 'bg-red-100 text-red-800' },
  }
  return configs[estado as keyof typeof configs] || { label: estado, variant: 'outline' as const, color: 'bg-gray-100 text-gray-800' }
}

export function RutasTable({ data, onView, onEdit, onDelete, onStart, onComplete }: RutasTableProps) {
  const columns: ColumnDef<Ruta>[] = [
    {
      accessorKey: 'numero_ruta',
      header: ({ column }) => (
        <SortableHeader column={column}>Ruta</SortableHeader>
      ),
      cell: ({ row }) => {
        const numero = row.getValue('numero_ruta') as string
        return (
          <div className="font-semibold text-primary text-base">
            #{numero}
          </div>
        )
      },
    },
    {
      accessorKey: 'fecha_planificada',
      header: ({ column }) => (
        <SortableHeader column={column}>Fecha</SortableHeader>
      ),
      cell: ({ row }) => {
        const ruta = row.original
        const fecha = ruta.fecha_planificada || ruta.fecha_ruta
        return (
          <div className="text-base text-foreground font-medium">
            {formatDate(fecha)}
          </div>
        )
      },
    },
    {
      accessorKey: 'repartidor_id',
      header: 'Repartidor',
      cell: ({ row }) => {
        const ruta = row.original
        const repartidor = ruta.repartidor
        const repartidorId = ruta.repartidor_id
        
        if (repartidor) {
          const nombreCompleto = `${repartidor.nombre}${repartidor.apellido ? ' ' + repartidor.apellido : ''}`
          const iniciales = `${repartidor.nombre.charAt(0)}${repartidor.apellido ? repartidor.apellido.charAt(0) : ''}`.toUpperCase()
          return (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">{iniciales}</AvatarFallback>
              </Avatar>
              <span className="text-base font-medium text-foreground">{nombreCompleto}</span>
            </div>
          )
        }
        
        // Fallback si no hay datos relacionados
        return (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs">R</AvatarFallback>
            </Avatar>
            <span className="text-base font-medium text-muted-foreground">ID: {repartidorId.substring(0, 8)}...</span>
          </div>
        )
      },
    },
    {
      accessorKey: 'vehiculo_id',
      header: 'Vehículo',
      cell: ({ row }) => {
        const ruta = row.original
        const vehiculo = ruta.vehiculo
        const vehiculoId = ruta.vehiculo_id
        
        if (vehiculo) {
          const displayName = vehiculo.patente || `${vehiculo.marca || ''} ${vehiculo.modelo || ''}`.trim() || 'Sin patente'
          return (
            <div className="flex items-center gap-2">
              <div className="p-1 bg-blue-100 rounded">
                <Truck className="h-3 w-3 text-blue-600" />
              </div>
              <span className="text-base font-medium text-foreground">{displayName}</span>
            </div>
          )
        }
        
        // Fallback si no hay datos relacionados
        return (
          <div className="flex items-center gap-2">
            <div className="p-1 bg-blue-100 rounded">
              <Truck className="h-3 w-3 text-blue-600" />
            </div>
            <span className="text-base font-medium text-muted-foreground">ID: {vehiculoId.substring(0, 8)}...</span>
          </div>
        )
      },
    },
    {
      accessorKey: 'peso_total_kg',
      header: 'Peso Total',
      cell: ({ row }) => {
        const peso = row.getValue('peso_total_kg') as number
        return (
          <div className="text-center">
            <div className="font-bold text-foreground text-base">{peso || 0} kg</div>
          </div>
        )
      },
    },
    {
      accessorKey: 'estado',
      header: 'Estado',
      cell: ({ row }) => {
        const estado = row.getValue('estado') as string
        const config = getEstadoConfig(estado)
        return (
          <Badge variant={config.variant} className={cn(config.color, "text-sm font-semibold px-2.5 py-1")}>
            {config.label}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'tiempo_estimado_min',
      header: 'Tiempo Est.',
      cell: ({ row }) => {
        const tiempoMin = row.getValue('tiempo_estimado_min') as number

        if (!tiempoMin) return <span className="text-muted-foreground text-base">Sin estimar</span>

        const horas = Math.floor(tiempoMin / 60)
        const minutos = tiempoMin % 60

        return (
          <div className="text-base text-foreground font-medium">
            {horas > 0 ? `${horas}h ` : ''}{minutos}min
          </div>
        )
      },
    },
  ]

  const actions = (ruta: Ruta) => (
    <>
      <Button
        variant="ghost"
        size="sm"
        asChild
        className="w-full justify-start"
      >
        <Link href={`/reparto/rutas/${ruta.id}?tab=mapa`}>
          <MapPin className="mr-2 h-4 w-4" />
          Ver mapa
        </Link>
      </Button>
      {onView && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onView(ruta)}
          className="w-full justify-start"
        >
          <Eye className="mr-2 h-4 w-4" />
          Ver detalles
        </Button>
      )}
      {onStart && ruta.estado === 'planificada' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onStart(ruta)}
          className="w-full justify-start"
        >
          <Navigation className="mr-2 h-4 w-4" />
          Iniciar ruta
        </Button>
      )}
      {onComplete && ruta.estado === 'en_curso' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onComplete(ruta)}
          className="w-full justify-start"
        >
          <CheckCircle className="mr-2 h-4 w-4" />
          Completar ruta
        </Button>
      )}
      {onEdit && ruta.estado === 'planificada' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(ruta)}
          className="w-full justify-start"
        >
          <Edit className="mr-2 h-4 w-4" />
          Editar
        </Button>
      )}
      {onDelete && ruta.estado === 'planificada' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(ruta)}
          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Cancelar
        </Button>
      )}
    </>
  )

  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="numero_ruta"
      searchPlaceholder="Buscar por número de ruta, repartidor..."
      actions={actions}
      enableRowSelection={true}
      enableColumnVisibility={true}
      enablePagination={true}
      pageSize={15}
    />
  )
}
