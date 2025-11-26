'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Truck, CheckCircle, XCircle, Clock, MapPin, TrendingUp } from 'lucide-react'
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

interface ReporteRepartoContentProps {
  kpis: any
  ranking: any[]
  mapaZonas: any[]
  zonas: Array<{ id: string; nombre: string }>
  vehiculos: Array<{ id: string; patente: string; modelo: string }>
  filtrosIniciales: {
    fechaDesde: string
    fechaHasta: string
    zonaId: string | null
    vehiculoId: string | null
  }
}

export function ReporteRepartoContent({
  kpis,
  ranking,
  mapaZonas,
  zonas,
  vehiculos,
  filtrosIniciales,
}: ReporteRepartoContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [filtros, setFiltros] = useState(filtrosIniciales)

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

  const handleClearFilters = () => {
    router.push('/reportes/reparto')
    setFiltros(filtrosIniciales)
  }

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    const response = await fetch('/api/reportes/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'reparto',
        format,
        filtros,
      }),
    })

    if (!response.ok) throw new Error('Error al exportar')

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `reporte-reparto-${Date.now()}.${format === 'excel' ? 'xlsx' : format}`
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
            <h1 className="text-3xl font-bold tracking-tight">Reporte de Reparto y Logística</h1>
            <p className="text-muted-foreground mt-1">
              Análisis de eficiencia, entregas y rendimiento de rutas
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
          zona: {
            value: filtros.zonaId,
            options: zonas.map((z) => ({ value: z.id, label: z.nombre })),
            onChange: (value) => handleFilterChange('zonaId', value),
          },
          vehiculo: {
            value: filtros.vehiculoId,
            options: vehiculos.map((v) => ({
              value: v.id,
              label: `${v.patente} - ${v.modelo}`,
            })),
            onChange: (value) => handleFilterChange('vehiculoId', value),
          },
        }}
      />

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Entregas Completadas"
          value={kpis?.entregasCompletadas || 0}
          format="number"
          decimals={0}
          icon={Truck}
        />
        <KpiCard
          title="Entregas Exitosas"
          value={kpis?.entregasExitosas || 0}
          format="number"
          decimals={0}
          icon={CheckCircle}
          description={`Tasa: ${formatNumber(kpis?.tasaExito || 0, 1)}%`}
        />
        <KpiCard
          title="Entregas Fallidas"
          value={kpis?.entregasFallidas || 0}
          format="number"
          decimals={0}
          icon={XCircle}
        />
        <KpiCard
          title="Tiempo Promedio por Entrega"
          value={kpis?.tiempoPromedioEntrega || 0}
          format="text"
          description={formatDuration(kpis?.tiempoPromedioEntrega || 0)}
          icon={Clock}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          title="Km Totales Recorridos"
          value={kpis?.kmTotales || 0}
          format="number"
          decimals={2}
          icon={MapPin}
        />
        <KpiCard
          title="Eficiencia de Ruta"
          value={kpis?.eficienciaRuta || 0}
          format="number"
          decimals={2}
          icon={TrendingUp}
          description="Km por entrega"
        />
      </div>

      {/* Mapa de calor por zona */}
      {mapaZonas.length > 0 && (
        <HeatmapMap
          title="Mapa de Calor por Zona"
          description="Densidad de entregas por zona geográfica"
          data={mapaZonas}
          height={500}
        />
      )}

      {/* Ranking de Repartidores */}
      <BarChartComponent
        title="Ranking de Repartidores"
        description="Eficiencia medida en entregas por hora"
        data={ranking.slice(0, 10).map((r) => ({
          repartidor: r.repartidor_nombre,
          entregasPorHora: r.entregasPorHora,
          entregas: r.entregas,
        }))}
        dataKey="repartidor"
        formatValue="number"
        orientation="horizontal"
        bars={[{ key: 'entregasPorHora', name: 'Entregas/Hora', color: '#2d6a4f' }]}
        height={400}
      />

      {/* Tabla de ranking */}
      {ranking.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ranking Completo de Repartidores</CardTitle>
            <CardDescription>Métricas detalladas de rendimiento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Repartidor</TableHead>
                    <TableHead>Rutas</TableHead>
                    <TableHead>Entregas</TableHead>
                    <TableHead>Tasa Éxito</TableHead>
                    <TableHead>Entregas/Hora</TableHead>
                    <TableHead>Km/Entrega</TableHead>
                    <TableHead>Tiempo Promedio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranking.map((r, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{r.repartidor_nombre}</TableCell>
                      <TableCell>{r.rutas}</TableCell>
                      <TableCell>{r.entregas}</TableCell>
                      <TableCell>{formatNumber(r.tasaExito, 1)}%</TableCell>
                      <TableCell>{formatNumber(r.entregasPorHora, 2)}</TableCell>
                      <TableCell>{formatNumber(r.kmPorEntrega, 2)}</TableCell>
                      <TableCell>{formatDuration(r.tiempoPromedio)}</TableCell>
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

