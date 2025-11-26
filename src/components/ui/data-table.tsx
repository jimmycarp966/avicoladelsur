'use client'

import * as React from 'react'
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowUpDown, ChevronDown, MoreHorizontal, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchKey?: string
  searchPlaceholder?: string
  onRowClick?: (row: TData) => void
  enableRowSelection?: boolean
  enableColumnVisibility?: boolean
  enablePagination?: boolean
  pageSize?: number
  actions?: (row: TData) => React.ReactNode
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = 'Buscar...',
  onRowClick,
  enableRowSelection = false,
  enableColumnVisibility = true,
  enablePagination = true,
  pageSize = 10,
  actions,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: pageSize,
  })

  // Add row selection column if enabled
  const tableColumns = React.useMemo(() => {
    const cols = [...columns]

    if (enableRowSelection) {
      cols.unshift({
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && 'indeterminate')
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Seleccionar todas las filas"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Seleccionar fila"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      } as ColumnDef<TData, TValue>)
    }

    // Add actions column if provided
    if (actions) {
      cols.push({
        id: 'actions',
        header: 'Acciones',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Abrir menú</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => {
                  const rowData = row.original as any
                  // Intentar obtener el ID del objeto
                  let idToCopy = rowData.id
                  
                  // Si no existe 'id', buscar campos que terminen en '_id'
                  if (!idToCopy) {
                    const idFields = Object.keys(rowData).filter(key => key.endsWith('_id'))
                    if (idFields.length > 0) {
                      idToCopy = rowData[idFields[0]]
                    }
                  }
                  
                  // Si aún no hay ID, buscar cualquier UUID en el objeto
                  if (!idToCopy) {
                    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
                    for (const value of Object.values(rowData)) {
                      if (typeof value === 'string' && uuidPattern.test(value)) {
                        idToCopy = value
                        break
                      }
                    }
                  }
                  
                  // Si no se encuentra ningún ID, usar el primer valor del objeto
                  if (!idToCopy) {
                    idToCopy = Object.values(rowData)[0] || 'N/A'
                  }
                  
                  navigator.clipboard.writeText(String(idToCopy))
                }}
              >
                Copiar ID
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {actions(row.original)}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      } as ColumnDef<TData, TValue>)
    }

    return cols
  }, [columns, enableRowSelection, actions])

  const table = useReactTable({
    data,
    columns: tableColumns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: enablePagination ? setPagination : undefined,
    globalFilterFn: 'includesString',
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      ...(enablePagination && { pagination }),
    },
  })

  return (
    <div className="w-full">
      {/* Search and filters */}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center space-x-2">
          {searchKey && (
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={globalFilter ?? ''}
                onChange={(event) => setGlobalFilter(event.target.value)}
                className="pl-8 max-w-sm"
              />
            </div>
          )}
        </div>

        {enableColumnVisibility && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-auto">
                Columnas <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={tableColumns.length} className="h-24 text-center">
                  No se encontraron resultados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {enablePagination && (
        <div className="flex items-center justify-end space-x-2 py-4">
          <div className="flex-1 text-sm text-muted-foreground">
            {table.getFilteredSelectedRowModel().rows.length} de{' '}
            {table.getFilteredRowModel().rows.length} fila(s) seleccionada(s).
          </div>
          <div className="space-x-2">
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
      )}
    </div>
  )
}

// Helper component for sortable column headers
export function SortableHeader({
  children,
  column,
}: {
  children: React.ReactNode
  column: any
}) {
  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      className="h-auto p-0 font-medium"
    >
      {children}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  )
}

// Helper component for status badges
export function StatusBadge({
  status,
  variant = 'default'
}: {
  status: string
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
}) {
  const statusConfig = {
    pendiente: { label: 'Pendiente', variant: 'secondary' as const },
    aprobado: { label: 'Aprobado', variant: 'default' as const },
    confirmado: { label: 'Confirmado', variant: 'default' as const },
    preparando: { label: 'Preparando', variant: 'default' as const },
    enviado: { label: 'Enviado', variant: 'default' as const },
    entregado: { label: 'Entregado', variant: 'default' as const },
    cancelado: { label: 'Cancelado', variant: 'destructive' as const },
    activo: { label: 'Activo', variant: 'default' as const },
    inactivo: { label: 'Inactivo', variant: 'secondary' as const },
  }

  const config = statusConfig[status as keyof typeof statusConfig] || {
    label: status,
    variant
  }

  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  )
}
