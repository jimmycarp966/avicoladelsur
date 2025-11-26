'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Package, CheckCircle, XCircle, Clock, TrendingDown, Users } from 'lucide-react'
import { KpiCard } from '@/components/reportes/KpiCard'
import { ReportFilters } from '@/components/reportes/ReportFilters'
import { ExportButton } from '@/components/reportes/ExportButton'
import { BarChartComponent } from '@/components/reportes/charts/BarChart'
import { formatNumber, formatDuration } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface ReportePedidosContentProps {
  kpis: any
  funnel: any[]
  clientesSinComprar: any[]
  zonas: Array<{ id: string; nombre: string }>
  vendedores: Array<{ id: string; nombre: string; apellido: string }>
  filtrosIniciales: {
    fechaDesde: string
    fechaHasta: string
    zonaId: string | null
    vendedorId: string | null
    estado: string | null
  }
}

export function ReportePedidosContent({
  kpis,
  funnel,
  clientesSinComprar,
  zonas,
  vendedores,
  filtrosIniciales,
}: ReportePedidosContentProps) {
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
    router.push('/reportes/pedidos')
    setFiltros(filtrosIniciales)
  }

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    const response = await fetch('/api/reportes/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'pedidos',
        format,
        filtros,
      }),
    })

    if (!response.ok) throw new Error('Error al exportar')

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `reporte-pedidos-${Date.now()}.${format === 'excel' ? 'xlsx' : format}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  // Calcular conversión entre etapas del funnel
  const funnelData = funnel.map((item, index) => {
    const prev = index > 0 ? funnel[index - 1].cantidad : item.cantidad
    const conversion = prev > 0 ? (item.cantidad / prev) * 100 : 0
    return {
      ...item,
      conversion,
      perdida: prev - item.cantidad,
    }
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10" />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reporte de Pedidos y Cotizaciones</h1>
            <p className="text-muted-foreground mt-1">
              Análisis del funnel de conversión y eficiencia del proceso
            </p>
          </div>
          <ExportButton onExport={handleExport} />
        </div>
      </div>

      {/* Filtros */}
      <div className="space-y-4">
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
          vendedor: {
            value: filtros.vendedorId,
            options: vendedores.map((v) => ({
              value: v.id,
              label: `${v.nombre} ${v.apellido}`,
            })),
            onChange: (value) => handleFilterChange('vendedorId', value),
          },
          estado: {
            value: filtros.estado,
            options: [
              { value: 'pendiente', label: 'Pendiente' },
              { value: 'preparando', label: 'Preparando' },
              { value: 'en_ruta', label: 'En Ruta' },
              { value: 'entregado', label: 'Entregado' },
              { value: 'cancelado', label: 'Cancelado' },
            ],
            onChange: (value) => handleFilterChange('estado', value),
          },
        }}
        />
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Pedidos Totales"
          value={kpis?.pedidosTotales || 0}
          format="number"
          decimals={0}
          icon={Package}
        />
        <KpiCard
          title="Pedidos Aprobados"
          value={kpis?.pedidosAprobados || 0}
          format="number"
          decimals={0}
          icon={CheckCircle}
          description={`Tasa: ${formatNumber(kpis?.tasaAprobacion || 0, 1)}%`}
        />
        <KpiCard
          title="Pedidos Rechazados"
          value={kpis?.pedidosRechazados || 0}
          format="number"
          decimals={0}
          icon={XCircle}
        />
        <KpiCard
          title="Tiempo Promedio Aprobación"
          value={kpis?.tiempoPromedioAprobacion || 0}
          format="text"
          description={formatDuration((kpis?.tiempoPromedioAprobacion || 0) * 60)}
          icon={Clock}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          title="Tiempo Promedio Entrega"
          value={kpis?.tiempoPromedioEntrega || 0}
          format="text"
          description={formatDuration((kpis?.tiempoPromedioEntrega || 0) * 60)}
          icon={Clock}
        />
        <KpiCard
          title="% Productos Pesables"
          value={kpis?.porcentajePesables || 0}
          format="percentage"
          icon={Package}
        />
      </div>

      {/* Funnel */}
      <BarChartComponent
        title="Funnel de Conversión"
        description="Pedido → Revisión → Almacén → Reparto → Entregado → Cobrado"
        data={funnelData}
        dataKey="etapa"
        formatValue="number"
        bars={[
          { key: 'cantidad', name: 'Cantidad', color: '#2d6a4f' },
          { key: 'perdida', name: 'Pérdida', color: '#8b2635' },
        ]}
        showLegend
        height={400}
      />

      {/* Clientes sin comprar */}
      {clientesSinComprar.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              Clientes que Piden pero No Compran (Lead Scoring)
            </CardTitle>
            <CardDescription>
              Clientes con presupuestos que no se convirtieron en pedidos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Zona</TableHead>
                    <TableHead>Presupuestos</TableHead>
                    <TableHead>Total Estimado</TableHead>
                    <TableHead>Último Presupuesto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientesSinComprar.slice(0, 20).map((cliente: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{cliente.cliente_nombre}</TableCell>
                      <TableCell>{cliente.cliente_telefono || '-'}</TableCell>
                      <TableCell>{cliente.cliente_zona || '-'}</TableCell>
                      <TableCell>{cliente.presupuestos_count}</TableCell>
                      <TableCell>${formatNumber(cliente.total_estimado, 2)}</TableCell>
                      <TableCell>
                        {new Date(cliente.ultimo_presupuesto).toLocaleDateString('es-AR')}
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

