'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, Package, TrendingDown, BarChart3, Calendar } from 'lucide-react'
import { KpiCard } from '@/components/reportes/KpiCard'
import { ReportFilters } from '@/components/reportes/ReportFilters'
import { ExportButton } from '@/components/reportes/ExportButton'
import { BarChartComponent } from '@/components/reportes/charts/BarChart'
import { LineChartComponent } from '@/components/reportes/charts/LineChart'
import { formatCurrency, formatNumber } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface ReporteStockContentProps {
  kpis: any
  proyeccion: any[]
  mermas: any[]
  categorias: string[]
  filtrosIniciales: {
    fechaDesde: string
    fechaHasta: string
    categoria: string | null
  }
  diasProyeccion: number
}

export function ReporteStockContent({
  kpis,
  proyeccion,
  mermas,
  categorias,
  filtrosIniciales,
  diasProyeccion: diasProyeccionInicial,
}: ReporteStockContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [filtros, setFiltros] = useState(filtrosIniciales)
  const [diasProyeccion, setDiasProyeccion] = useState(diasProyeccionInicial)

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`?${params.toString()}`)
    setFiltros((prev) => ({ ...prev, [key]: value === 'all' ? null : value }))
  }

  const handleDateChange = (desde: string, hasta: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('fechaDesde', desde)
    params.set('fechaHasta', hasta)
    router.push(`?${params.toString()}`)
    setFiltros((prev) => ({ ...prev, fechaDesde: desde, fechaHasta: hasta }))
  }

  const handleDiasProyeccionChange = (dias: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('diasProyeccion', dias)
    router.push(`?${params.toString()}`)
    setDiasProyeccion(Number(dias))
  }

  const handleClearFilters = () => {
    router.push('/reportes/stock')
    setFiltros(filtrosIniciales)
  }

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    const response = await fetch('/api/reportes/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'stock',
        format,
        filtros,
      }),
    })

    if (!response.ok) throw new Error('Error al exportar')

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `reporte-stock-${Date.now()}.${format === 'excel' ? 'xlsx' : format}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  const productosCriticos = kpis?.productosCriticos || []
  const proyeccionesCriticas = proyeccion.filter((p) => p.necesita_reposicion)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10" />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reporte de Stock y Mermas</h1>
            <p className="text-muted-foreground mt-1">
              Análisis de inventario, rotación, mermas y proyección de demanda
            </p>
          </div>
          <ExportButton onExport={handleExport} />
        </div>
      </div>

      {/* Filtros */}
      <ReportFilters
        fechaDesde={filtros.fechaDesde}
        fechaHasta={filtros.fechaHasta}
        onDateChange={handleDateChange}
        onClear={handleClearFilters}
        filters={{
          categoria: {
            value: filtros.categoria,
            options: categorias.map((c) => ({ value: c, label: c })),
            onChange: (value) => handleFilterChange('categoria', value),
          },
        }}
      />

      {/* Selector de días de proyección */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Label htmlFor="dias-proyeccion" className="whitespace-nowrap">
              Días de Proyección:
            </Label>
            <Select value={String(diasProyeccion)} onValueChange={handleDiasProyeccionChange}>
              <SelectTrigger id="dias-proyeccion" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 días</SelectItem>
                <SelectItem value="15">15 días</SelectItem>
                <SelectItem value="30">30 días</SelectItem>
                <SelectItem value="60">60 días</SelectItem>
                <SelectItem value="90">90 días</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Stock Crítico"
          value={kpis?.stockCritico || 0}
          format="number"
          decimals={0}
          icon={AlertTriangle}
          description="Productos bajo stock mínimo"
        />
        <KpiCard
          title="Mermas (Kg)"
          value={kpis?.mermasKg || 0}
          format="number"
          decimals={2}
          icon={TrendingDown}
        />
        <KpiCard
          title="Mermas ($)"
          value={kpis?.mermasPesos || 0}
          format="currency"
          icon={TrendingDown}
        />
        <KpiCard
          title="Productos Necesitan Reposición"
          value={proyeccionesCriticas.length}
          format="number"
          decimals={0}
          icon={Package}
          description={`En próximos ${diasProyeccion} días`}
        />
      </div>

      {/* Gráficos */}
      <div className="grid gap-6 md:grid-cols-2">
        <LineChartComponent
          title="Movimientos de Stock"
          description="Ingresos y salidas por día"
          data={kpis?.movimientosPorDia || []}
          dataKey="fecha"
          formatValue="number"
          lines={[
            { key: 'ingresos', name: 'Ingresos', color: '#2d6a4f' },
            { key: 'salidas', name: 'Salidas', color: '#8b2635' },
          ]}
          showLegend
        />

        <BarChartComponent
          title="Mermas por Categoría"
          description="Pérdidas en kg por categoría de producto"
          data={mermas}
          dataKey="categoria"
          formatValue="number"
          bars={[{ key: 'kg_perdidos', name: 'Kg Perdidos', color: '#8b2635' }]}
        />
      </div>

      <BarChartComponent
        title="Rotación de Inventario"
        description="Salidas por categoría"
        data={kpis?.rotacionPorCategoria || []}
        dataKey="categoria"
        formatValue="number"
        bars={[{ key: 'salidas', name: 'Salidas', color: '#2d6a4f' }]}
      />

      {/* Productos Críticos */}
      {productosCriticos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Productos con Stock Crítico
            </CardTitle>
            <CardDescription>
              Productos que están por debajo de su stock mínimo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Stock Actual</TableHead>
                    <TableHead>Stock Mínimo</TableHead>
                    <TableHead>Diferencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productosCriticos.map((item: any, index: number) => {
                    const producto = item.productos
                    const stockActual = Number(item.cantidad_disponible || 0)
                    const stockMinimo = Number(producto?.stock_minimo || 0)
                    const diferencia = stockActual - stockMinimo
                    return (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{producto?.nombre}</TableCell>
                        <TableCell>{producto?.categoria || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={stockActual < stockMinimo ? 'destructive' : 'default'}>
                            {formatNumber(stockActual, 2)}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatNumber(stockMinimo, 2)}</TableCell>
                        <TableCell>
                          <span className={diferencia < 0 ? 'text-destructive font-semibold' : ''}>
                            {diferencia < 0 ? '-' : '+'}
                            {formatNumber(Math.abs(diferencia), 2)}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Proyección de Stock */}
      {proyeccionesCriticas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Proyección de Stock (Próximos {diasProyeccion} días)
            </CardTitle>
            <CardDescription>
              Productos que necesitarán reposición según ventas históricas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Stock Actual</TableHead>
                    <TableHead>Venta Diaria Promedio</TableHead>
                    <TableHead>Stock Proyectado</TableHead>
                    <TableHead>Stock Mínimo</TableHead>
                    <TableHead>Cantidad Recomendada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proyeccionesCriticas.slice(0, 20).map((item: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.producto_nombre}</TableCell>
                      <TableCell>{item.producto_categoria || '-'}</TableCell>
                      <TableCell>{formatNumber(item.stock_actual, 2)}</TableCell>
                      <TableCell>{formatNumber(item.promedio_venta_diaria, 2)}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">
                          {formatNumber(item.stock_proyectado, 2)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatNumber(item.stock_minimo, 2)}</TableCell>
                      <TableCell>
                        <Badge variant="warning" className="font-semibold">
                          {formatNumber(item.cantidad_recomendada, 2)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

