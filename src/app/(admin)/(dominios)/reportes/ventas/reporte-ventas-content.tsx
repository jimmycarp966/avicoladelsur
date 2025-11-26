'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DollarSign, TrendingUp, Users, ShoppingCart, CreditCard, Package, UserCheck, UserPlus } from 'lucide-react'
import { KpiCard } from '@/components/reportes/KpiCard'
import { ReportFilters } from '@/components/reportes/ReportFilters'
import { ExportButton } from '@/components/reportes/ExportButton'
import { LineChartComponent } from '@/components/reportes/charts/LineChart'
import { BarChartComponent } from '@/components/reportes/charts/BarChart'
import { PieChartComponent } from '@/components/reportes/charts/PieChart'
import { HeatmapChart } from '@/components/reportes/charts/HeatmapChart'
import { VentasDetailTable } from '@/components/reportes/VentasDetailTable'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface ReporteVentasContentProps {
  kpis: any
  ventasPorPeriodo: any[]
  ventasPorZona: any[]
  topProductos: any[]
  topVendedores: any[]
  ventasPorMetodo: any[]
  heatmap: any[]
  clientes: any
  detalleVentas: any[]
  zonas: Array<{ id: string; nombre: string }>
  vendedores: Array<{ id: string; nombre: string; apellido: string }>
  vehiculos: Array<{ id: string; patente: string; modelo: string }>
  filtrosIniciales: {
    fechaDesde: string
    fechaHasta: string
    zonaId: string | null
    vendedorId: string | null
    metodoPago: string | null
    vehiculoId: string | null
    agrupacion: 'dia' | 'semana' | 'mes' | 'trimestre'
  }
}

export function ReporteVentasContent({
  kpis,
  ventasPorPeriodo,
  ventasPorZona,
  topProductos,
  topVendedores,
  ventasPorMetodo,
  heatmap,
  clientes,
  detalleVentas,
  zonas,
  vendedores,
  vehiculos,
  filtrosIniciales,
}: ReporteVentasContentProps) {
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

  const handleAgrupacionChange = (value: string) => {
    handleFilterChange('agrupacion', value)
  }

  const handleDateChange = (desde: string, hasta: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('fechaDesde', desde)
    params.set('fechaHasta', hasta)
    router.push(`?${params.toString()}`)
    setFiltros((prev) => ({ ...prev, fechaDesde: desde, fechaHasta: hasta }))
  }

  const handleClearFilters = () => {
    router.push('/reportes/ventas')
    setFiltros(filtrosIniciales)
  }

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    // Implementar exportación
    const response = await fetch('/api/reportes/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'ventas',
        format,
        filtros,
      }),
    })

    if (!response.ok) {
      throw new Error('Error al exportar')
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `reporte-ventas-${Date.now()}.${format === 'excel' ? 'xlsx' : format}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  // Preparar datos para gráficos
  const ventasPorPeriodoData = useMemo(
    () =>
      ventasPorPeriodo.map((item) => ({
        periodo: item.periodo,
        ventas: Number(item.ventas || 0),
        transacciones: Number(item.transacciones || 0),
        ticketPromedio: Number(item.ticket_promedio || 0),
      })),
    [ventasPorPeriodo]
  )

  const ventasPorZonaData = useMemo(
    () =>
      ventasPorZona.map((item) => ({
        zona: item.zona,
        ventas: Number(item.ventas || 0),
        ticketPromedio: Number(item.ticketPromedio || 0),
      })),
    [ventasPorZona]
  )

  const topProductosData = useMemo(
    () =>
      topProductos.map((item) => ({
        nombre: item.producto_nombre || item.nombre,
        ventas: Number(item.ventas || 0),
        unidades: Number(item.unidades_vendidas || 0),
      })),
    [topProductos]
  )

  const ventasPorMetodoData = useMemo(() => {
    const total = ventasPorMetodo.reduce((sum, item) => sum + Number(item.monto || 0), 0)
    return ventasPorMetodo.map((item) => ({
      name: item.metodo_pago || 'efectivo',
      value: Number(item.monto || 0),
      porcentaje: total > 0 ? (Number(item.monto || 0) / total) * 100 : 0,
    }))
  }, [ventasPorMetodo])

  const kpisData = kpis || {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10" />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reporte de Ventas</h1>
            <p className="text-muted-foreground mt-1">
              Análisis completo de ventas con KPIs, gráficos y métricas detalladas
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
          metodoPago: {
            value: filtros.metodoPago,
            options: [
              { value: 'efectivo', label: 'Efectivo' },
              { value: 'transferencia', label: 'Transferencia' },
              { value: 'qr', label: 'QR' },
              { value: 'tarjeta', label: 'Tarjeta' },
              { value: 'cuenta_corriente', label: 'Cuenta Corriente' },
            ],
            onChange: (value) => handleFilterChange('metodoPago', value),
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
        
        {/* Selector de agrupación */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Label htmlFor="agrupacion" className="whitespace-nowrap">
                Agrupar por:
              </Label>
              <Select
                value={filtros.agrupacion}
                onValueChange={handleAgrupacionChange}
              >
                <SelectTrigger id="agrupacion" className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dia">Día</SelectItem>
                  <SelectItem value="semana">Semana</SelectItem>
                  <SelectItem value="mes">Mes</SelectItem>
                  <SelectItem value="trimestre">Trimestre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Ventas Totales"
          value={kpisData.ventas_totales || 0}
          format="currency"
          icon={DollarSign}
          change={kpisData.cambioVsPeriodoAnterior}
          changeLabel="período anterior"
          trend={kpisData.cambioVsPeriodoAnterior > 0 ? 'up' : kpisData.cambioVsPeriodoAnterior < 0 ? 'down' : 'neutral'}
        />
        <KpiCard
          title="Ticket Promedio"
          value={kpisData.ticket_promedio || 0}
          format="currency"
          icon={ShoppingCart}
        />
        <KpiCard
          title="Transacciones"
          value={kpisData.transacciones || 0}
          format="number"
          decimals={0}
          icon={TrendingUp}
        />
        <KpiCard
          title="Clientes Nuevos"
          value={clientes?.nuevos || 0}
          format="number"
          decimals={0}
          icon={UserPlus}
          description={`${clientes?.porcentajeNuevos?.toFixed(1) || 0}% del total`}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Clientes Recurrentes"
          value={clientes?.recurrentes || 0}
          format="number"
          decimals={0}
          icon={UserCheck}
          description={`${clientes?.porcentajeRecurrentes?.toFixed(1) || 0}% del total`}
        />
        <KpiCard
          title="Total Clientes"
          value={clientes?.total || 0}
          format="number"
          decimals={0}
          icon={Users}
        />
        <KpiCard
          title="Ticket Promedio por Cliente"
          value={kpisData.ticket_promedio_por_cliente || 0}
          format="currency"
          icon={Package}
        />
      </div>

      {/* Gráficos */}
      <div className="grid gap-6 md:grid-cols-2">
        <LineChartComponent
          title="Ventas por Período"
          description={`Ventas agrupadas por ${filtros.agrupacion}`}
          data={ventasPorPeriodoData}
          dataKey="periodo"
          formatValue="currency"
          lines={[
            { key: 'ventas', name: 'Ventas', color: '#2d6a4f' },
            { key: 'ticketPromedio', name: 'Ticket Promedio', color: '#8b2635' },
          ]}
          showLegend
        />

        <BarChartComponent
          title="Ventas por Zona"
          description="Distribución de ventas por zona de entrega"
          data={ventasPorZonaData}
          dataKey="zona"
          formatValue="currency"
          bars={[{ key: 'ventas', name: 'Ventas', color: '#2d6a4f' }]}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <PieChartComponent
          title="Ventas por Método de Pago"
          description="Distribución de recaudación por método de pago"
          data={ventasPorMetodoData}
          formatValue="currency"
        />

        <BarChartComponent
          title="Top 10 Productos"
          description="Productos más vendidos por monto"
          data={topProductosData}
          dataKey="nombre"
          formatValue="currency"
          orientation="horizontal"
          bars={[{ key: 'ventas', name: 'Ventas', color: '#2d6a4f' }]}
          height={400}
        />
      </div>

      {/* Heatmap */}
      {heatmap.length > 0 && (
        <HeatmapChart
          title="Heatmap de Ventas"
          description="Ventas por día de la semana y hora del día"
          data={heatmap}
        />
      )}

      <BarChartComponent
        title="Top 10 Vendedores"
        description="Ranking de vendedores por ventas"
        data={topVendedores.map((v) => ({
          nombre: v.vendedor_nombre,
          ventas: Number(v.ventas || 0),
          transacciones: Number(v.transacciones || 0),
        }))}
        dataKey="nombre"
        formatValue="currency"
        orientation="horizontal"
        bars={[{ key: 'ventas', name: 'Ventas', color: '#2d6a4f' }]}
        height={400}
      />

      {/* Tabla de detalle */}
      <VentasDetailTable
        data={detalleVentas.map((v: any) => ({
          id: v.id,
          numero_pedido: v.numero_pedido,
          fecha_pedido: v.fecha_pedido,
          total: Number(v.total || 0),
          estado: v.estado,
          pago_estado: v.pago_estado,
          cliente_nombre: v.clientes?.nombre || '',
          cliente_zona: v.clientes?.zona_entrega || '',
          vendedor_nombre: v.usuarios
            ? `${v.usuarios.nombre || ''} ${v.usuarios.apellido || ''}`.trim()
            : '',
          productos_count: v.detalles_pedido?.length || 0,
        }))}
      />
    </div>
  )
}

