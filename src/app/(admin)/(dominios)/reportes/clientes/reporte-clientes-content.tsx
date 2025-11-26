'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Users, TrendingUp, Package, MapPin, Star } from 'lucide-react'
import { KpiCard } from '@/components/reportes/KpiCard'
import { ReportFilters } from '@/components/reportes/ReportFilters'
import { ExportButton } from '@/components/reportes/ExportButton'
import { BarChartComponent } from '@/components/reportes/charts/BarChart'
import { ScatterChartComponent } from '@/components/reportes/charts/ScatterChart'
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

interface ReporteClientesContentProps {
  ranking: any[]
  rfm: any[]
  cohortes: any
  preferencias: any[]
  zonas: Array<{ id: string; nombre: string }>
  filtrosIniciales: {
    fechaDesde: string
    fechaHasta: string
    zonaId: string | null
  }
}

export function ReporteClientesContent({
  ranking,
  rfm,
  cohortes,
  preferencias,
  zonas,
  filtrosIniciales,
}: ReporteClientesContentProps) {
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
    router.push('/reportes/clientes')
    setFiltros(filtrosIniciales)
  }

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    const response = await fetch('/api/reportes/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'clientes',
        format,
        filtros,
      }),
    })

    if (!response.ok) throw new Error('Error al exportar')

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `reporte-clientes-${Date.now()}.${format === 'excel' ? 'xlsx' : format}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  // Calcular KPIs
  const clientesNuevos = rfm.filter((c) => c.recencia < 30 && c.frecuencia === 1).length
  const clientesInactivos = rfm.filter((c) => c.recencia > 90).length
  const top20Facturacion = ranking.slice(0, 20).reduce((sum, c) => sum + c.facturacion, 0)
  const totalFacturacion = ranking.reduce((sum, c) => sum + c.facturacion, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10" />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reporte de Clientes</h1>
            <p className="text-muted-foreground mt-1">
              Análisis RFM, cohortes, preferencias y ranking de clientes
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
        }}
      />

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Clientes"
          value={ranking.length}
          format="number"
          decimals={0}
          icon={Users}
        />
        <KpiCard
          title="Clientes Nuevos"
          value={clientesNuevos}
          format="number"
          decimals={0}
          icon={TrendingUp}
          description="Últimos 30 días"
        />
        <KpiCard
          title="Clientes Inactivos"
          value={clientesInactivos}
          format="number"
          decimals={0}
          icon={Package}
          description="Sin comprar >90 días"
        />
        <KpiCard
          title="Top 20 Facturación"
          value={top20Facturacion}
          format="currency"
          icon={Star}
          description={`${totalFacturacion > 0 ? ((top20Facturacion / totalFacturacion) * 100).toFixed(1) : 0}% del total`}
        />
      </div>

      {/* Gráficos */}
      <div className="grid gap-6 md:grid-cols-2">
        <BarChartComponent
          title="Top 20 Clientes por Facturación"
          description="Clientes con mayor facturación en el período"
          data={ranking.slice(0, 20).map((c) => ({
            cliente: c.cliente_nombre,
            facturacion: c.facturacion,
            transacciones: c.transacciones,
          }))}
          dataKey="cliente"
          formatValue="currency"
          orientation="horizontal"
          bars={[{ key: 'facturacion', name: 'Facturación', color: '#2d6a4f' }]}
          height={500}
        />

        <BarChartComponent
          title="Distribución por Segmento RFM"
          description="Clientes clasificados por score RFM"
          data={Object.entries(
            rfm.reduce((acc: any, c) => {
              acc[c.segmento] = (acc[c.segmento] || 0) + 1
              return acc
            }, {})
          ).map(([segmento, cantidad]: [string, any]) => ({
            segmento,
            cantidad,
          }))}
          dataKey="segmento"
          formatValue="number"
          bars={[{ key: 'cantidad', name: 'Clientes', color: '#2d6a4f' }]}
        />
      </div>

      {/* Scatter Plot: Ticket Promedio vs Frecuencia */}
      <ScatterChartComponent
        title="Análisis de Clientes: Ticket Promedio vs Frecuencia"
        description="Relación entre frecuencia de compra y ticket promedio"
        data={ranking.map((c) => ({
          x: c.frecuencia,
          y: c.ticket_promedio,
          name: c.cliente_nombre,
          value: c.facturacion,
        }))}
        xKey="x"
        yKey="y"
        xLabel="Frecuencia de Compra"
        yLabel="Ticket Promedio"
        formatX="number"
        formatY="currency"
        height={400}
      />

      {/* Tablas */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top 20 Clientes</CardTitle>
            <CardDescription>Ranking por facturación</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Zona</TableHead>
                    <TableHead>Facturación</TableHead>
                    <TableHead>Transacciones</TableHead>
                    <TableHead>Ticket Promedio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranking.slice(0, 20).map((cliente, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{cliente.cliente_nombre}</TableCell>
                      <TableCell>{cliente.cliente_zona || '-'}</TableCell>
                      <TableCell>{formatCurrency(cliente.facturacion)}</TableCell>
                      <TableCell>{cliente.transacciones}</TableCell>
                      <TableCell>{formatCurrency(cliente.ticket_promedio)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Análisis RFM</CardTitle>
            <CardDescription>Top clientes por score RFM</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead>Recencia</TableHead>
                    <TableHead>Frecuencia</TableHead>
                    <TableHead>Monetario</TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rfm.slice(0, 20).map((cliente, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{cliente.cliente_nombre}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            cliente.segmento === 'Campeones'
                              ? 'default'
                              : cliente.segmento === 'Clientes Leales'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {cliente.segmento}
                        </Badge>
                      </TableCell>
                      <TableCell>{cliente.recencia} días</TableCell>
                      <TableCell>{cliente.frecuencia}</TableCell>
                      <TableCell>{formatCurrency(cliente.monetario)}</TableCell>
                      <TableCell>{cliente.score_rfm}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

