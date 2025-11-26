'use client'

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts'
import { ChartWrapper } from '../ChartWrapper'
import { formatCurrency, formatNumber } from '@/lib/utils'

interface LineChartData {
  periodo: string
  ventas: number
  transacciones?: number
  ticketPromedio?: number
  [key: string]: any
}

interface LineChartProps {
  title: string
  description?: string
  data: LineChartData[]
  dataKey: string
  isLoading?: boolean
  error?: string | null
  formatValue?: 'currency' | 'number' | 'percentage'
  height?: number
  showLegend?: boolean
  lines?: Array<{
    key: string
    name: string
    color: string
    strokeWidth?: number
  }>
}

export function LineChartComponent({
  title,
  description,
  data,
  dataKey,
  isLoading = false,
  error = null,
  formatValue = 'currency',
  height = 300,
  showLegend = false,
  lines = [{ key: 'ventas', name: 'Ventas', color: '#1a4d2e' }],
}: LineChartProps) {
  const formatTooltipValue = (value: number) => {
    if (formatValue === 'currency') return formatCurrency(value)
    if (formatValue === 'percentage') return `${formatNumber(value, 1)}%`
    return formatNumber(value, 0)
  }

  return (
    <ChartWrapper title={title} description={description} isLoading={isLoading} error={error}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey={dataKey}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickFormatter={(value) => {
              if (formatValue === 'currency') {
                return `$${formatNumber(value, 0)}`
              }
              return formatNumber(value, 0)
            }}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-white/95 backdrop-blur-sm p-4 border border-primary/20 rounded-xl shadow-2xl">
                    <p className="font-semibold text-primary mb-3 text-center border-b border-primary/10 pb-2">{label}</p>
                    {payload.map((entry: any, index: number) => (
                      <div key={index} className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                        <p className="text-sm font-medium" style={{ color: entry.color }}>
                          {`${entry.name}: ${formatTooltipValue(entry.value)}`}
                        </p>
                      </div>
                    ))}
                  </div>
                )
              }
              return null
            }}
          />
          {showLegend && <Legend />}
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.name}
              stroke={line.color}
              strokeWidth={line.strokeWidth || 2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}

