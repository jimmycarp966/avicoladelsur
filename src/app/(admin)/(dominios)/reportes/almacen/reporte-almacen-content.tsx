'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Clock, Scale, Package, TrendingUp, AlertCircle } from 'lucide-react'
import { KpiCard } from '@/components/reportes/KpiCard'
import { ReportFilters } from '@/components/reportes/ReportFilters'
import { ExportButton } from '@/components/reportes/ExportButton'
import { BarChartComponent } from '@/components/reportes/charts/BarChart'
import { formatNumber, formatDuration } from '@/lib/utils'
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

interface ReporteAlmacenContentProps {
  kpis: any
  variacionPeso: any[]
  filtrosIniciales: {
    fechaDesde: string
    fechaHasta: string
  }
}

export function ReporteAlmacenContent({
  kpis,
  variacionPeso,
  filtrosIniciales,
}: ReporteAlmacenContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [filtros, setFiltros] = useState(filtrosIniciales)

  const handleDateChange = (desde: string, hasta: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('fechaDesde', desde)
    params.set('fechaHasta', hasta)
    router.push(`?${params.toString()}`)
    setFiltros((prev) => ({ ...prev, fechaDesde: desde, fechaHasta: hasta }))
  }

  const handleClearFilters = () => {
    router.push('/reportes/almacen')
    setFiltros(filtrosIniciales)
  }

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    const response = await fetch('/api/reportes/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'almacen',
        format,
        filtros,
      }),
    })

    if (!response.ok) throw new Error('Error al exportar')

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `reporte-almacen-${Date.now()}.${format === 'excel' ? 'xlsx' : format}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10" />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reporte de Almacén</h1>
            <p className="text-muted-foreground mt-1">
              Análisis de preparación, pesaje y eficiencia operativa
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
      />

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Tiempo Promedio Preparación"
          value={kpis?.tiempoPromedioPreparacion || 0}
          format="text"
          description={formatDuration(kpis?.tiempoPromedioPreparacion || 0)}
          icon={Clock}
        />
        <KpiCard
          title="Variación Promedio Peso"
          value={kpis?.variacionPromedio || 0}
          format="percentage"
          icon={Scale}
          description="Diferencia estimado vs real"
        />
        <KpiCard
          title="Kg Despachados"
          value={kpis?.totalKgDespachados || 0}
          format="number"
          decimals={2}
          icon={Package}
        />
        <KpiCard
          title="Presupuestos Procesados"
          value={kpis?.presupuestosProcesados || 0}
          format="number"
          decimals={0}
          icon={TrendingUp}
        />
      </div>

      {/* Gráficos */}
      <div className="grid gap-6 md:grid-cols-2">
        <BarChartComponent
          title="Variación de Peso por Producto"
          description="Top productos con mayor variación (estimado vs real)"
          data={variacionPeso.slice(0, 10).map((v) => ({
            producto: v.producto_nombre,
            variacion: Math.abs(v.variacion_promedio),
          }))}
          dataKey="producto"
          formatValue="percentage"
          orientation="horizontal"
          bars={[{ key: 'variacion', name: 'Variación %', color: '#8b2635' }]}
          height={400}
        />

        <BarChartComponent
          title="Rendimiento por Operario"
          description="Presupuestos procesados por operario"
          data={kpis?.rendimientoPorOperario?.map((op: any) => ({
            operario: op.operario_id.substring(0, 8),
            presupuestos: op.presupuestos,
          })) || []}
          dataKey="operario"
          formatValue="number"
          bars={[{ key: 'presupuestos', name: 'Presupuestos', color: '#2d6a4f' }]}
        />
      </div>

      {/* Tabla de variaciones */}
      {variacionPeso.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Ranking de Variación de Peso
            </CardTitle>
            <CardDescription>
              Productos con mayor diferencia entre peso estimado y peso real
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Variación Promedio</TableHead>
                    <TableHead>Cantidad Items</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variacionPeso.slice(0, 20).map((item: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.producto_nombre}</TableCell>
                      <TableCell>{item.producto_categoria || '-'}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            Math.abs(item.variacion_promedio) > 10
                              ? 'destructive'
                              : Math.abs(item.variacion_promedio) > 5
                                ? 'warning'
                                : 'default'
                          }
                        >
                          {item.variacion_promedio > 0 ? '+' : ''}
                          {formatNumber(item.variacion_promedio, 2)}%
                        </Badge>
                      </TableCell>
                      <TableCell>{item.cantidad_items}</TableCell>
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

