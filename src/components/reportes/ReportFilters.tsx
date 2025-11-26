'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Filter, X } from 'lucide-react'
import { DateRangePicker } from './DateRangePicker'

interface FilterOption {
  value: string
  label: string
}

interface ReportFiltersProps {
  fechaDesde: string
  fechaHasta: string
  onDateChange: (desde: string, hasta: string) => void
  filters?: {
    zona?: {
      value: string | null
      options: FilterOption[]
      onChange: (value: string) => void
    }
    vendedor?: {
      value: string | null
      options: FilterOption[]
      onChange: (value: string) => void
    }
    metodoPago?: {
      value: string | null
      options: FilterOption[]
      onChange: (value: string) => void
    }
    vehiculo?: {
      value: string | null
      options: FilterOption[]
      onChange: (value: string) => void
    }
    turno?: {
      value: string | null
      options: FilterOption[]
      onChange: (value: string) => void
    }
    estado?: {
      value: string | null
      options: FilterOption[]
      onChange: (value: string) => void
    }
    cliente?: {
      value: string | null
      options: FilterOption[]
      onChange: (value: string) => void
    }
    categoria?: {
      value: string | null
      options: FilterOption[]
      onChange: (value: string) => void
    }
  }
  onClear?: () => void
  className?: string
}

export function ReportFilters({
  fechaDesde,
  fechaHasta,
  onDateChange,
  filters,
  onClear,
  className,
}: ReportFiltersProps) {
  const hasActiveFilters = filters && Object.values(filters).some(f => f?.value && f.value !== 'all')

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
            <CardDescription>
              Filtra los datos del reporte según tus necesidades
            </CardDescription>
          </div>
          {hasActiveFilters && onClear && (
            <Button variant="ghost" size="sm" onClick={onClear}>
              <X className="h-4 w-4 mr-2" />
              Limpiar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Rango de fechas */}
          <div className="space-y-2">
            <Label>Rango de fechas</Label>
            <DateRangePicker
              fechaDesde={fechaDesde}
              fechaHasta={fechaHasta}
              onDateChange={onDateChange}
            />
          </div>

          {/* Filtros adicionales */}
          {filters && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filters.zona && (
                <div className="space-y-2">
                  <Label htmlFor="filtro-zona">Zona</Label>
                  <Select
                    value={filters.zona.value || 'all'}
                    onValueChange={filters.zona.onChange}
                  >
                    <SelectTrigger id="filtro-zona">
                      <SelectValue placeholder="Todas las zonas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las zonas</SelectItem>
                      {filters.zona.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {filters.vendedor && (
                <div className="space-y-2">
                  <Label htmlFor="filtro-vendedor">Vendedor</Label>
                  <Select
                    value={filters.vendedor.value || 'all'}
                    onValueChange={filters.vendedor.onChange}
                  >
                    <SelectTrigger id="filtro-vendedor">
                      <SelectValue placeholder="Todos los vendedores" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los vendedores</SelectItem>
                      {filters.vendedor.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {filters.metodoPago && (
                <div className="space-y-2">
                  <Label htmlFor="filtro-metodo-pago">Método de pago</Label>
                  <Select
                    value={filters.metodoPago.value || 'all'}
                    onValueChange={filters.metodoPago.onChange}
                  >
                    <SelectTrigger id="filtro-metodo-pago">
                      <SelectValue placeholder="Todos los métodos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los métodos</SelectItem>
                      {filters.metodoPago.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {filters.vehiculo && (
                <div className="space-y-2">
                  <Label htmlFor="filtro-vehiculo">Vehículo</Label>
                  <Select
                    value={filters.vehiculo.value || 'all'}
                    onValueChange={filters.vehiculo.onChange}
                  >
                    <SelectTrigger id="filtro-vehiculo">
                      <SelectValue placeholder="Todos los vehículos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los vehículos</SelectItem>
                      {filters.vehiculo.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {filters.turno && (
                <div className="space-y-2">
                  <Label htmlFor="filtro-turno">Turno</Label>
                  <Select
                    value={filters.turno.value || 'all'}
                    onValueChange={filters.turno.onChange}
                  >
                    <SelectTrigger id="filtro-turno">
                      <SelectValue placeholder="Todos los turnos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los turnos</SelectItem>
                      {filters.turno.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {filters.estado && (
                <div className="space-y-2">
                  <Label htmlFor="filtro-estado">Estado</Label>
                  <Select
                    value={filters.estado.value || 'all'}
                    onValueChange={filters.estado.onChange}
                  >
                    <SelectTrigger id="filtro-estado">
                      <SelectValue placeholder="Todos los estados" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      {filters.estado.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {filters.cliente && (
                <div className="space-y-2">
                  <Label htmlFor="filtro-cliente">Cliente</Label>
                  <Select
                    value={filters.cliente.value || 'all'}
                    onValueChange={filters.cliente.onChange}
                  >
                    <SelectTrigger id="filtro-cliente">
                      <SelectValue placeholder="Todos los clientes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los clientes</SelectItem>
                      {filters.cliente.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {filters.categoria && (
                <div className="space-y-2">
                  <Label htmlFor="filtro-categoria">Categoría</Label>
                  <Select
                    value={filters.categoria.value || 'all'}
                    onValueChange={filters.categoria.onChange}
                  >
                    <SelectTrigger id="filtro-categoria">
                      <SelectValue placeholder="Todas las categorías" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las categorías</SelectItem>
                      {filters.categoria.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

