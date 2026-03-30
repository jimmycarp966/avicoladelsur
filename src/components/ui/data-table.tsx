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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  pageSizeOptions?: number[]
  actions?: (row: TData) => React.ReactNode
  initialColumnVisibility?: VisibilityState
  // Server-side pagination callbacks
  onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void
  onSearchChange?: (search: string) => void
  // Server-side pagination state
  serverPagination?: {
    pageIndex: number
    pageSize: number
    totalCount?: number
  }
}

const MIN_PAGE_SIZE = 50

function normalizePageSize(value: number | undefined, fallback = MIN_PAGE_SIZE): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.max(MIN_PAGE_SIZE, Math.trunc(parsed))
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
  pageSize = 50,
  pageSizeOptions = [50, 100, 200],
  actions,
  initialColumnVisibility,
  onPaginationChange,
  onSearchChange,
  serverPagination,
}: DataTableProps<TData, TValue>) {
  const normalizedInitialPageSize = React.useMemo(
    () => normalizePageSize(serverPagination?.pageSize ?? pageSize),
    [serverPagination?.pageSize, pageSize],
  )
  const normalizedPageSizeOptions = React.useMemo(() => {
    const sizes = pageSizeOptions
      .map((size) => normalizePageSize(size))
      .concat([MIN_PAGE_SIZE, normalizedInitialPageSize])
    return Array.from(new Set(sizes)).sort((a, b) => a - b)
  }, [pageSizeOptions, normalizedInitialPageSize])

  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(initialColumnVisibility ?? {})
  const [rowSelection, setRowSelection] = React.useState({})
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [pagination, setPagination] = React.useState({
    pageIndex: serverPagination?.pageIndex ?? 0,
    pageSize: normalizedInitialPageSize,
  })

  // Update pagination when serverPagination changes
  React.useEffect(() => {
    if (serverPagination) {
      const newPagination = {
        pageIndex: serverPagination.pageIndex,
        pageSize: normalizePageSize(serverPagination.pageSize, normalizedInitialPageSize),
      }
      // Only update if different to avoid unnecessary re-renders
      setPagination(prev => {
        if (prev.pageIndex !== newPagination.pageIndex || prev.pageSize !== newPagination.pageSize) {
          return newPagination
        }
        return prev
      })
    }
  }, [serverPagination, serverPagination?.pageIndex, serverPagination?.pageSize, normalizedInitialPageSize])

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
              <Button variant="ghost" className="h-8 w-8 p-0" tabIndex={0}>
                <span className="sr-only">Abrir menú</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => {
                  const rowData = row.original as CopyableRow
                  // Intentar obtener el ID del objeto
                  let idToCopy: unknown = rowData.id

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
    getPaginationRowModel: enablePagination && !serverPagination ? getPaginationRowModel() : undefined,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: serverPagination ? undefined : getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: serverPagination ? (updater) => {
      const newFilter = typeof updater === 'function' ? updater(globalFilter) : updater
      // Only update and call callback if filter actually changed
      if (newFilter !== globalFilter) {
        setGlobalFilter(newFilter)
        onSearchChange?.(newFilter)
      }
    } : setGlobalFilter,
    onPaginationChange: enablePagination ? (updater) => {
      const newPagination = typeof updater === 'function' ? updater(pagination) : updater
      const normalizedPagination = {
        pageIndex: newPagination.pageIndex,
        pageSize: normalizePageSize(newPagination.pageSize, normalizedInitialPageSize),
      }
      setPagination(normalizedPagination)
      onPaginationChange?.(normalizedPagination)
    } : undefined,
    globalFilterFn: 'includesString',
    // Server-side pagination configuration
    manualPagination: !!serverPagination,
    rowCount: serverPagination?.totalCount,
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
      <div className="sticky top-20 z-20 mb-4 flex flex-col gap-4 rounded-2xl border border-border/70 bg-background/90 px-4 py-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full items-center space-x-2 sm:w-auto">
          {searchKey && (
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={globalFilter ?? ''}
                onChange={(event) => table.setGlobalFilter(event.target.value)}
                className="pl-8 w-full sm:max-w-sm"
              />
            </div>
          )}
        </div>

        {enableColumnVisibility && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
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

      {/* Table - Responsive */}
      <div className="overflow-hidden rounded-xl border border-border/80 bg-background shadow-sm">
        {/* Vista móvil - Cards (sin scroll horizontal) */}
        <div className="lg:hidden">
          {table.getRowModel().rows?.length ? (
            <div className="divide-y divide-border">
              {table.getRowModel().rows.map((row) => (
                <div
                  key={row.id}
                  className={`p-4 space-y-3 transition-colors duration-200 ${onRowClick ? 'cursor-pointer hover:bg-primary/5 rounded-lg' : ''}`}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell, index) => {
                    const header = table.getHeaderGroups()[0]?.headers[index]
                    if (!header || cell.column.id === 'select' || cell.column.id === 'actions') return null

                    return (
                      <div key={cell.id} className="flex justify-between items-start">
                        <span className="text-sm font-medium text-muted-foreground min-w-0 flex-shrink-0 mr-2">
                          {flexRender(header.column.columnDef.header, header.getContext())}:
                        </span>
                        <div className="text-sm text-foreground flex-1 text-right">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      </div>
                    )
                  })}
                  {/* Acciones en móvil */}
                  {actions && (
                    <div className="flex justify-end pt-2 border-t border-border/50">
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
                              const rowData = row.original as CopyableRow
                              let idToCopy: unknown = rowData.id

                              if (!idToCopy) {
                                const idFields = Object.keys(rowData).filter(key => key.endsWith('_id'))
                                if (idFields.length > 0) {
                                  idToCopy = rowData[idFields[0]]
                                }
                              }

                              if (!idToCopy) {
                                const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
                                for (const value of Object.values(rowData)) {
                                  if (typeof value === 'string' && uuidPattern.test(value)) {
                                    idToCopy = value
                                    break
                                  }
                                }
                              }

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
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              No se encontraron resultados.
            </div>
          )}
        </div>

        {/* Vista desktop - Table (el componente Table maneja su propio overflow-x-auto) */}
        <div className="hidden lg:block">
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
                    className={onRowClick ? 'cursor-pointer hover:bg-primary/5 transition-colors duration-200' : 'hover:bg-muted/30 transition-colors duration-200'}
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
      </div>

      {/* Pagination */}
      {enablePagination && (
        <div className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground order-2 sm:order-1">
            {(() => {
              const totalRows = serverPagination?.totalCount ?? table.getFilteredRowModel().rows.length
              const pageIndex = pagination.pageIndex
              const pageSizeValue = pagination.pageSize
              const start = totalRows === 0 ? 0 : pageIndex * pageSizeValue + 1
              const end = Math.min((pageIndex + 1) * pageSizeValue, totalRows)
              const selectedRows = table.getFilteredSelectedRowModel().rows.length
              const selectedText = selectedRows > 0 ? ` • ${selectedRows} seleccionada(s)` : ''
              return `Mostrando ${start}-${end} de ${totalRows}${selectedText}`
            })()}
          </div>
          <div className="flex w-full flex-col gap-2 order-1 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:order-2">
            <Select
              value={String(pagination.pageSize)}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger className="h-8 w-full sm:w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {normalizedPageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}/pag
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground min-w-[80px] text-center">
              Pag {pagination.pageIndex + 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="w-full sm:w-auto"
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="w-full sm:w-auto"
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
  column: {
    toggleSorting: (descending: boolean) => void
    getIsSorted: () => false | 'asc' | 'desc'
  }
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
