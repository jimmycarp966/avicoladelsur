'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DollarSign, CreditCard, TrendingUp, AlertCircle, Wallet } from 'lucide-react'
import { KpiCard } from '@/components/reportes/KpiCard'
import { ReportFilters } from '@/components/reportes/ReportFilters'
import { ExportButton } from '@/components/reportes/ExportButton'
import { LineChartComponent } from '@/components/reportes/charts/LineChart'
import { PieChartComponent } from '@/components/reportes/charts/PieChart'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ReporteTesoreriaContentProps {
  kpis: any
  recaudacionDiaria: any[]
  filtrosIniciales: {
    fechaDesde: string
    fechaHasta: string
    metodoPago: string | null
  }
}

export function ReporteTesoreriaContent({
  kpis,
  recaudacionDiaria,
  filtrosIniciales,
}: ReporteTesoreriaContentProps) {
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
    router.push('/reportes/tesoreria')
    setFiltros(filtrosIniciales)
  }

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    const response = await fetch('/api/reportes/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'tesoreria',
        format,
        filtros,
      }),
    })

    if (!response.ok) throw new Error('Error al exportar')

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `reporte-tesoreria-${Date.now()}.${format === 'excel' ? 'xlsx' : format}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  const recaudacionDiariaData = useMemo(
    () =>
      recaudacionDiaria.map((item) => ({
        periodo: item.fecha,
        ventas: Number(item.actual || 0),
        actual: Number(item.actual || 0),
        anterior: Number(item.anterior || 0),
      })),
    [recaudacionDiaria]
  )

  const ventasPorMetodoData = useMemo(
    () =>
      (kpis?.totalesPorMetodo || []).map((item: any) => ({
        name: item.metodo,
        value: Number(item.monto || 0),
      })),
    [kpis]
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-6 shadow-sm border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10" />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reporte de Tesorería</h1>
            <p className="text-muted-foreground mt-1">
              Análisis de recaudación, métodos de pago y caja diaria
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
        }}
      />

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Efectivo Total"
          value={kpis?.efectivoTotal || 0}
          format="currency"
          icon={DollarSign}
        />
        <KpiCard
          title="Transferencias"
          value={kpis?.transferenciasTotal || 0}
          format="currency"
          icon={CreditCard}
        />
        <KpiCard
          title="Tarjeta"
          value={kpis?.tarjetaTotal || 0}
          format="currency"
          icon={CreditCard}
        />
        <KpiCard
          title="QR"
          value={kpis?.qrTotal || 0}
          format="currency"
          icon={CreditCard}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          title="Cuenta Corriente"
          value={kpis?.cuentaCorrienteTotal || 0}
          format="currency"
          icon={Wallet}
        />
        <KpiCard
          title="Total Rendido"
          value={kpis?.totalRendido || 0}
          format="currency"
          icon={TrendingUp}
          description="Por camionetas"
        />
        <KpiCard
          title="Diferencias Detectadas"
          value={kpis?.diferencias || 0}
          format="number"
          decimals={0}
          icon={AlertCircle}
          description="Entre entrega y sistema"
        />
      </div>

      {/* Gráficos */}
      <div className="grid gap-6 md:grid-cols-2">
        <LineChartComponent
          title="Recaudación Diaria vs Semana Anterior"
          description="Comparación día a día con el período anterior"
          data={recaudacionDiariaData}
          dataKey="periodo"
          formatValue="currency"
          lines={[
            { key: 'actual', name: 'Período Actual', color: '#2d6a4f' },
            { key: 'anterior', name: 'Semana Anterior', color: '#8b2635' },
          ]}
          showLegend
        />

        <PieChartComponent
          title="Distribución por Método de Pago"
          description="Porcentaje de recaudación por método"
          data={ventasPorMetodoData}
          formatValue="currency"
        />
      </div>

      {/* Cambio vs período anterior */}
      {kpis?.cambioVsAnterior !== undefined && (
        <Card>
          <CardHeader>
            <CardTitle>Comparación con Período Anterior</CardTitle>
            <CardDescription>
              Variación de recaudación respecto al período anterior
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-primary/10 p-4 bg-primary/5">
                <p className="text-sm text-muted-foreground">Período Anterior</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(kpis.recaudacionAnterior || 0)}
                </p>
              </div>
              <div className="rounded-lg border border-primary/10 p-4 bg-primary/5">
                <p className="text-sm text-muted-foreground">Período Actual</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(kpis.recaudacionActual || 0)}
                </p>
              </div>
              <div className="rounded-lg border border-primary/10 p-4 bg-primary/5">
                <p className="text-sm text-muted-foreground">Cambio</p>
                <p
                  className={`text-2xl font-bold ${
                    kpis.cambioVsAnterior > 0 ? 'text-success' : 'text-destructive'
                  }`}
                >
                  {kpis.cambioVsAnterior > 0 ? '+' : ''}
                  {formatNumber(kpis.cambioVsAnterior || 0, 2)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

