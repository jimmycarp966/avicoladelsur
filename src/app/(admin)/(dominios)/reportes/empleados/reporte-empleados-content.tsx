'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Clock, AlertCircle, TrendingUp, Users, Package } from 'lucide-react'
import { KpiCard } from '@/components/reportes/KpiCard'
import { ReportFilters } from '@/components/reportes/ReportFilters'
import { ExportButton } from '@/components/reportes/ExportButton'
import { BarChartComponent } from '@/components/reportes/charts/BarChart'
import { HeatmapMap } from '@/components/reportes/charts/HeatmapMap'
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

interface ReporteEmpleadosContentProps {
  kpis: any
  eficiencia: any[]
  mapaZonas: any[]
  filtrosIniciales: {
    fechaDesde: string
    fechaHasta: string
    sector: string | null
  }
}

export function ReporteEmpleadosContent({
  kpis,
  eficiencia,
  mapaZonas,
  filtrosIniciales,
}: ReporteEmpleadosContentProps) {
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
    router.push('/reportes/empleados')
    setFiltros(filtrosIniciales)
  }

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    const response = await fetch('/api/reportes/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'empleados',
        format,
        filtros,
      }),
    })

    if (!response.ok) throw new Error('Error al exportar')

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `reporte-empleados-${Date.now()}.${format === 'excel' ? 'xlsx' : format}`
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
            <h1 className="text-3xl font-bold tracking-tight">Reporte de Empleados</h1>
            <p className="text-muted-foreground mt-1">
              Análisis de asistencia, productividad y eficiencia
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
          title="Horas Totales Trabajadas"
          value={kpis?.horasTotales || 0}
          format="number"
          decimals={2}
          icon={Clock}
        />
        <KpiCard
          title="Llegadas Tarde"
          value={kpis?.llegadasTarde || 0}
          format="number"
          decimals={0}
          icon={AlertCircle}
        />
        <KpiCard
          title="Horas Extra"
          value={kpis?.horasExtras || 0}
          format="number"
          decimals={0}
          icon={TrendingUp}
        />
        <KpiCard
          title="Total Asistencias"
          value={kpis?.totalAsistencias || 0}
          format="number"
          decimals={0}
          icon={Users}
        />
      </div>

      {/* Mapa de zonas atendidas */}
      {mapaZonas.length > 0 && (
        <HeatmapMap
          title="Zonas Atendidas por Repartidores"
          description="Distribución geográfica de entregas por zona"
          data={mapaZonas}
          height={500}
        />
      )}

      {/* Gráficos */}
      <div className="grid gap-6 md:grid-cols-2">
        <BarChartComponent
          title="Asistencia por Sector"
          description="Horas trabajadas por categoría de empleado"
          data={kpis?.asistenciaPorSector || []}
          dataKey="sector"
          formatValue="number"
          bars={[{ key: 'horas_totales', name: 'Horas', color: '#2d6a4f' }]}
        />

        <BarChartComponent
          title="Eficiencia de Repartidores"
          description="Entregas por hora de trabajo"
          data={eficiencia.slice(0, 10).map((e) => ({
            repartidor: e.repartidor_nombre,
            entregasPorHora: e.entregasPorHora,
          }))}
          dataKey="repartidor"
          formatValue="number"
          orientation="horizontal"
          bars={[{ key: 'entregasPorHora', name: 'Entregas/Hora', color: '#2d6a4f' }]}
          height={400}
        />
      </div>

      {/* Tabla de eficiencia */}
      {eficiencia.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Eficiencia de Repartidores</CardTitle>
            <CardDescription>Métricas de productividad</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Repartidor</TableHead>
                    <TableHead>Entregas</TableHead>
                    <TableHead>Horas</TableHead>
                    <TableHead>Entregas/Hora</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eficiencia.map((e, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{e.repartidor_nombre}</TableCell>
                      <TableCell>{e.entregas}</TableCell>
                      <TableCell>{formatNumber(e.horas, 2)}</TableCell>
                      <TableCell>{formatNumber(e.entregasPorHora, 2)}</TableCell>
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

