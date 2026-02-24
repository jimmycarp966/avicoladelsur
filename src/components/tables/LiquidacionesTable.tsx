'use client'

import { useMemo, useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { DataTable, SortableHeader, StatusBadge } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Edit, Eye, CheckCircle, DollarSign, MoreHorizontal, FileSpreadsheet, Printer } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDate } from '@/lib/utils'
import type { Liquidacion } from '@/types/domain.types'
import Link from 'next/link'

interface LiquidacionesTableProps {
  liquidaciones: Liquidacion[]
  onView?: (liquidacion: Liquidacion) => void
  onEdit?: (liquidacion: Liquidacion) => void
  onApprove?: (liquidacion: Liquidacion) => void
  onPay?: (liquidacion: Liquidacion) => void
}

const MESES = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
]

const ESTADOS_OPTIONS = [
  { value: 'todos', label: 'Todos los estados' },
  { value: 'borrador', label: 'Borrador' },
  { value: 'calculada', label: 'Calculada' },
  { value: 'aprobada', label: 'Aprobada' },
  { value: 'pagada', label: 'Pagada' },
]

export function LiquidacionesTable({ liquidaciones, onView, onEdit, onApprove, onPay }: LiquidacionesTableProps) {
  const [filtroEstado, setFiltroEstado] = useState<string>('todos')

  const liquidacionesFiltradas = useMemo(() => {
    return liquidaciones.filter((l) => {
      if (filtroEstado !== 'todos' && l.estado !== filtroEstado) return false
      return true
    })
  }, [liquidaciones, filtroEstado])

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'borrador':
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
            Borrador
          </Badge>
        )
      case 'calculada':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            Calculada
          </Badge>
        )
      case 'aprobada':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Aprobada
          </Badge>
        )
      case 'pagada':
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            Pagada
          </Badge>
        )
      default:
        return <Badge variant="outline">{estado}</Badge>
    }
  }

  const columns: ColumnDef<Liquidacion>[] = [
    {
      accessorKey: 'empleado.usuario.nombre',
      header: ({ column }) => <SortableHeader column={column}>Empleado</SortableHeader>,
      cell: ({ row }) => {
        const empleado = row.original.empleado
        const nombre = empleado?.usuario?.nombre || empleado?.nombre || ''
        const apellido = empleado?.usuario?.apellido || empleado?.apellido || ''
        const email = empleado?.usuario?.email || ''
        const legajo = empleado?.legajo || ''
        const puesto = row.original.puesto_override?.trim() || empleado?.categoria?.nombre?.trim() || 'Sin puesto'
        const nombreCompleto = `${nombre} ${apellido}`.trim()
        const etiquetaEmpleado = nombreCompleto || email || 'Sin nombre'

        return (
          <div>
            <div className="font-semibold text-foreground text-base">{etiquetaEmpleado}</div>
            {legajo && <div className="text-sm text-muted-foreground">Legajo: {legajo}</div>}
            <div className="text-sm text-muted-foreground">Puesto: {puesto}</div>
          </div>
        )
      },
    },
    {
      accessorKey: 'periodo_mes',
      header: ({ column }) => <SortableHeader column={column}>Período</SortableHeader>,
      cell: ({ row }) => {
        const mes = row.getValue('periodo_mes') as number
        const anio = row.original.periodo_anio
        return (
          <div className="text-sm">
            {MESES[mes - 1]?.label ?? mes} {anio}
          </div>
        )
      },
    },
    {
      accessorKey: 'total_bruto',
      header: ({ column }) => <SortableHeader column={column}>Total Bruto</SortableHeader>,
      cell: ({ row }) => {
        const total = row.getValue('total_bruto') as number
        return <div className="font-medium text-green-600">${total.toLocaleString()}</div>
      },
    },
    {
      accessorKey: 'total_neto',
      header: ({ column }) => <SortableHeader column={column}>Total Neto</SortableHeader>,
      cell: ({ row }) => {
        const total = row.getValue('total_neto') as number
        return <div className="font-semibold text-blue-600">${total.toLocaleString()}</div>
      },
    },
    {
      accessorKey: 'control_30_superado',
      header: ({ column }) => <SortableHeader column={column}>Control 30%</SortableHeader>,
      cell: ({ row }) => {
        const superado = !!row.original.control_30_superado
        const limite = row.original.control_30_limite ?? 0
        const anticipos = row.original.control_30_anticipos ?? 0
        const pct = limite > 0 ? Math.min(Math.round((anticipos / limite) * 100), 100) : 0

        return (
          <div className="space-y-1.5 min-w-[100px]">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">${anticipos.toLocaleString()}</span>
              <span
                className={`font-semibold ${
                  pct >= 100 ? 'text-red-600' : pct >= 70 ? 'text-amber-600' : 'text-green-600'
                }`}
              >
                {pct}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  pct >= 100 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-green-500'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {superado && (
              <Badge variant="destructive" className="text-xs py-0 h-4">
                Superado
              </Badge>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'pago_autorizado',
      header: ({ column }) => <SortableHeader column={column}>Autorización</SortableHeader>,
      cell: ({ row }) => {
        const autorizado = !!row.original.pago_autorizado
        return <StatusBadge status={autorizado ? 'aprobado' : 'pendiente'} />
      },
    },
    {
      accessorKey: 'estado',
      header: ({ column }) => <SortableHeader column={column}>Estado</SortableHeader>,
      cell: ({ row }) => {
        const estado = row.getValue('estado') as string
        return getEstadoBadge(estado)
      },
    },
    {
      accessorKey: 'pagado',
      header: ({ column }) => <SortableHeader column={column}>Pagado</SortableHeader>,
      cell: ({ row }) => {
        const pagado = row.getValue('pagado') as boolean
        const fechaPago = row.original.fecha_pago
        return (
          <div className="flex flex-col items-center">
            <StatusBadge status={pagado ? 'pagada' : 'pendiente'} />
            {pagado && fechaPago && (
              <div className="text-xs text-muted-foreground mt-1">{formatDate(fechaPago)}</div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'fecha_liquidacion',
      header: ({ column }) => <SortableHeader column={column}>Fecha Liquidación</SortableHeader>,
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground">
          {formatDate(row.getValue('fecha_liquidacion'))}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => {
        const liquidacion = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Abrir menú</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href={`/rrhh/liquidaciones/${liquidacion.id}`}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Ver planilla
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/rrhh/liquidaciones/${liquidacion.id}/recibo`}>
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimir recibo
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              {onView && (
                <DropdownMenuItem onClick={() => onView(liquidacion)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Ver detalles
                </DropdownMenuItem>
              )}
              {onEdit && liquidacion.estado === 'borrador' && (
                <DropdownMenuItem onClick={() => onEdit(liquidacion)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
              )}
              {onApprove && (liquidacion.estado === 'borrador' || liquidacion.estado === 'calculada') && (
                <DropdownMenuItem onClick={() => onApprove(liquidacion)}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Aprobar
                </DropdownMenuItem>
              )}
              {onPay && liquidacion.estado === 'aprobada' && !liquidacion.pagado && (
                <DropdownMenuItem onClick={() => onPay(liquidacion)}>
                  <DollarSign className="mr-2 h-4 w-4" />
                  Marcar como pagada
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      {/* Filtro de estado (año/mes vienen del servidor via URL) */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            {ESTADOS_OPTIONS.map((op) => (
              <SelectItem key={op.value} value={op.value}>
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground ml-auto">
          {liquidacionesFiltradas.length} de {liquidaciones.length} liquidaciones
        </span>
      </div>

      <DataTable
        columns={columns}
        data={liquidacionesFiltradas}
        searchKey="empleado.usuario.nombre"
        searchPlaceholder="Buscar por empleado..."
        enablePagination={false}
      />
    </div>
  )
}
