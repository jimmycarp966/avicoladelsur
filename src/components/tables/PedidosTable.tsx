'use client'

import { useState } from 'react'
import { ColumnDef, Row, flexRender, getCoreRowModel, getExpandedRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, SortingState } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Edit, Trash2, Eye, Truck, FileText, Route, ChevronDown, ChevronRight, Scale, Package } from 'lucide-react'
import { formatDate, formatCurrency, cn } from '@/lib/utils'
import type { Pedido } from '@/types/domain.types'

interface EntregaItem {
  id: string
  cantidad_solicitada: number
  peso_final: number | null
  precio_unitario: number
  subtotal: number
  producto: {
    id: string
    nombre: string
    codigo: string
    unidad_medida: string
  } | null
}

interface Entrega {
  id: string
  cliente: { id: string; nombre: string } | null
  presupuesto_id: string | null
  presupuesto: {
    id: string
    numero_presupuesto: string
    items: EntregaItem[]
  } | null
  subtotal: number
  total: number
  estado_entrega: string
}

interface PedidoConEntregas extends Pedido {
  entregas?: Entrega[]
}

interface PedidosTableProps {
  data: PedidoConEntregas[]
  onView?: (pedido: PedidoConEntregas) => void
  onEdit?: (pedido: PedidoConEntregas) => void
  onDelete?: (pedido: PedidoConEntregas) => void
  onDeliver?: (pedido: PedidoConEntregas) => void
  onPrint?: (pedido: PedidoConEntregas) => void
  onRoute?: (pedido: PedidoConEntregas) => void
}

const getEstadoConfig = (estado: string) => {
  const configs = {
    pendiente: { label: 'Pendiente', variant: 'secondary' as const, color: 'bg-yellow-100 text-yellow-800' },
    confirmado: { label: 'Confirmado', variant: 'default' as const, color: 'bg-blue-100 text-blue-800' },
    preparando: { label: 'Preparando', variant: 'outline' as const, color: 'bg-purple-100 text-purple-800' },
    enviado: { label: 'Enviado', variant: 'secondary' as const, color: 'bg-orange-100 text-orange-800' },
    entregado: { label: 'Entregado', variant: 'default' as const, color: 'bg-green-100 text-green-800' },
    cancelado: { label: 'Cancelado', variant: 'destructive' as const, color: 'bg-red-100 text-red-800' },
  }
  return configs[estado as keyof typeof configs] || { label: estado, variant: 'outline' as const, color: 'bg-gray-100 text-gray-800' }
}

// Calcular resumen de productos (totales por producto)
function calcularResumenProductos(entregas: Entrega[] | undefined) {
  if (!entregas || entregas.length === 0) return []

  const resumen: Record<string, {
    productoId: string
    nombre: string
    codigo: string
    unidadMedida: string
    cantidadTotal: number
    pesoTotal: number
    subtotal: number
  }> = {}

  for (const entrega of entregas) {
    if (!entrega.presupuesto?.items) continue

    for (const item of entrega.presupuesto.items) {
      if (!item.producto) continue

      const key = item.producto.id
      if (!resumen[key]) {
        resumen[key] = {
          productoId: item.producto.id,
          nombre: item.producto.nombre,
          codigo: item.producto.codigo,
          unidadMedida: item.producto.unidad_medida,
          cantidadTotal: 0,
          pesoTotal: 0,
          subtotal: 0
        }
      }

      resumen[key].cantidadTotal += item.cantidad_solicitada || 0
      resumen[key].pesoTotal += item.peso_final || item.cantidad_solicitada || 0
      resumen[key].subtotal += item.subtotal || 0
    }
  }

  return Object.values(resumen).sort((a, b) => a.nombre.localeCompare(b.nombre))
}

export function PedidosTable({ data, onView, onEdit, onDelete, onDeliver, onPrint, onRoute }: PedidosTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const columns: ColumnDef<PedidoConEntregas>[] = [
    // Columna de expansión
    {
      id: 'expander',
      header: () => null,
      cell: ({ row }) => {
        const hasEntregas = row.original.entregas && row.original.entregas.length > 0
        if (!hasEntregas) return null

        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => row.toggleExpanded()}
            className="p-1 h-6 w-6"
          >
            {row.getIsExpanded() ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        )
      },
      size: 40,
    },
    {
      accessorKey: 'numero_pedido',
      header: 'Pedido',
      cell: ({ row }) => {
        const numero = row.getValue('numero_pedido') as string
        const entregasCount = row.original.entregas?.length || 0
        return (
          <div>
            <div className="font-semibold text-primary text-base">#{numero}</div>
            {entregasCount > 0 && (
              <div className="text-xs text-muted-foreground">{entregasCount} presupuesto(s)</div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'fecha_pedido',
      header: 'Fecha',
      cell: ({ row }) => {
        const fecha = row.getValue('fecha_pedido') as string
        return (
          <div className="text-base text-foreground font-medium">
            {formatDate(fecha)}
          </div>
        )
      },
    },
    {
      accessorKey: 'cliente',
      header: 'Cliente',
      cell: ({ row }) => {
        const cliente = row.original.cliente as any
        const clienteNombre = cliente?.nombre || 'Pedido agrupado'
        const iniciales = clienteNombre.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
        return (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs">{iniciales || 'P'}</AvatarFallback>
            </Avatar>
            <span className="text-base font-medium text-foreground">{clienteNombre}</span>
          </div>
        )
      },
    },
    {
      accessorKey: 'total',
      header: 'Total',
      cell: ({ row }) => {
        const total = row.getValue('total') as number
        return (
          <div className="font-bold text-foreground text-base">
            {formatCurrency(total)}
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
      accessorKey: 'fecha_entrega_estimada',
      header: 'Entrega',
      cell: ({ row }) => {
        const fecha = row.getValue('fecha_entrega_estimada') as string
        return fecha ? (
          <div className="text-base text-foreground font-medium">
            {formatDate(fecha)}
          </div>
        ) : (
          <span className="text-muted-foreground text-base">Sin fecha</span>
        )
      },
    },
    // Columna de acciones
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => {
        const pedido = row.original
        return (
          <div className="flex gap-1">
            {onView && (
              <Button variant="ghost" size="sm" onClick={() => onView(pedido)} title="Ver detalles">
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {onEdit && pedido.estado === 'pendiente' && (
              <Button variant="ghost" size="sm" onClick={() => onEdit(pedido)} title="Editar">
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {onDeliver && (pedido.estado === 'confirmado' || pedido.estado === 'preparando') && (
              <Button variant="ghost" size="sm" onClick={() => onDeliver(pedido)} title="Marcar entregado">
                <Truck className="h-4 w-4" />
              </Button>
            )}
            {onRoute && pedido.estado === 'preparando' && (
              <Button variant="ghost" size="sm" onClick={() => onRoute(pedido)} title="Pasar a ruta">
                <Route className="h-4 w-4" />
              </Button>
            )}
            {onPrint && (
              <Button variant="ghost" size="sm" onClick={() => onPrint(pedido)} title="Imprimir">
                <FileText className="h-4 w-4" />
              </Button>
            )}
            {onDelete && pedido.estado === 'pendiente' && (
              <Button variant="ghost" size="sm" onClick={() => onDelete(pedido)} className="text-red-600" title="Cancelar">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data,
    columns,
    state: { sorting, expanded },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowCanExpand: (row) => (row.original.entregas?.length || 0) > 0,
    initialState: {
      pagination: { pageSize: 15 },
    },
  })

  // Renderiza la fila expandida con el desglose
  const renderExpandedRow = (row: Row<PedidoConEntregas>) => {
    const entregas = row.original.entregas || []
    const resumen = calcularResumenProductos(entregas)
    const pesoTotal = resumen.reduce((sum, p) => sum + p.pesoTotal, 0)

    return (
      <TableRow className="bg-muted/30">
        <TableCell colSpan={columns.length} className="p-4">
          <div className="space-y-4">
            {/* Desglose por presupuesto */}
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Package className="h-4 w-4" /> Desglose por Presupuesto
              </h4>
              <div className="grid gap-2">
                {entregas.map((entrega) => (
                  <div key={entrega.id} className="bg-white border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium text-sm">
                        {entrega.cliente?.nombre || 'Cliente'} -
                        <span className="text-muted-foreground ml-1">
                          {entrega.presupuesto?.numero_presupuesto || 'Sin presupuesto'}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {formatCurrency(entrega.total)}
                      </Badge>
                    </div>
                    {entrega.presupuesto?.items && entrega.presupuesto.items.length > 0 && (
                      <div className="text-xs text-muted-foreground space-y-1">
                        {entrega.presupuesto.items.map((item) => (
                          <div key={item.id} className="flex justify-between">
                            <span>{item.producto?.nombre || 'Producto'}</span>
                            <span className="font-medium">
                              {(item.peso_final || item.cantidad_solicitada || 0).toFixed(2)} {item.producto?.unidad_medida || 'kg'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Resumen total por producto */}
            {resumen.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Scale className="h-4 w-4" /> Total por Producto (Concreto)
                </h4>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-blue-50">
                      <TableHead className="text-xs">Producto</TableHead>
                      <TableHead className="text-xs text-center">Código</TableHead>
                      <TableHead className="text-xs text-right">Peso/Cantidad</TableHead>
                      <TableHead className="text-xs text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resumen.map((producto) => (
                      <TableRow key={producto.productoId}>
                        <TableCell className="text-sm font-medium">{producto.nombre}</TableCell>
                        <TableCell className="text-sm text-center text-muted-foreground">{producto.codigo}</TableCell>
                        <TableCell className="text-sm text-right font-semibold text-blue-600">
                          {producto.pesoTotal.toFixed(2)} {producto.unidadMedida}
                        </TableCell>
                        <TableCell className="text-sm text-right">{formatCurrency(producto.subtotal)}</TableCell>
                      </TableRow>
                    ))}
                    {/* Fila de totales */}
                    <TableRow className="bg-blue-100 font-bold">
                      <TableCell colSpan={2} className="text-sm text-right">TOTAL:</TableCell>
                      <TableCell className="text-sm text-right text-blue-700">{pesoTotal.toFixed(2)} kg</TableCell>
                      <TableCell className="text-sm text-right">{formatCurrency(row.original.total)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <>
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(row.getIsExpanded() && "bg-muted/50")}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  {row.getIsExpanded() && renderExpandedRow(row)}
                </>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No hay pedidos registrados
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Mostrando {table.getRowModel().rows.length} de {data.length} pedidos
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  )
}