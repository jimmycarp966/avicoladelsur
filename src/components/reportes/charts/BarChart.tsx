'use client'

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Cell,
} from 'recharts'
import { ChartWrapper } from '../ChartWrapper'
import { formatCurrency, formatNumber } from '@/lib/utils'

interface BarChartData {
  [key: string]: any
}

interface BarChartProps {
  title: string
  description?: string
  data: BarChartData[]
  dataKey: string
  isLoading?: boolean
  error?: string | null
  formatValue?: 'currency' | 'number' | 'percentage'
  height?: number
  showLegend?: boolean
  bars?: Array<{
    key: string
    name: string
    color: string
  }>
  orientation?: 'vertical' | 'horizontal'
}

export function BarChartComponent({
  title,
  description,
  data,
  dataKey,
  isLoading = false,
  error = null,
  formatValue = 'currency',
  height = 300,
  showLegend = false,
  bars = [{ key: 'ventas', name: 'Ventas', color: '#2d6a4f' }],
  orientation = 'vertical',
}: BarChartProps) {
  const formatTooltipValue = (value: number) => {
    if (formatValue === 'currency') return formatCurrency(value)
    if (formatValue === 'percentage') return `${formatNumber(value, 1)}%`
    return formatNumber(value, 0)
  }

  const ChartComponent = orientation === 'horizontal' ? BarChart : BarChart

  return (
    <ChartWrapper title={title} description={description} isLoading={isLoading} error={error}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout={orientation === 'horizontal' ? 'vertical' : undefined}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          {orientation === 'vertical' ? (
            <>
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
            </>
          ) : (
            <>
              <XAxis
                type="number"
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
              <YAxis
                type="category"
                dataKey={dataKey}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                width={100}
              />
            </>
          )}
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                    <p className="font-medium text-gray-900 mb-2">{label}</p>
                    {payload.map((entry: any, index: number) => (
                      <p key={index} style={{ color: entry.color }} className="text-sm">
                        {`${entry.name}: ${formatTooltipValue(entry.value)}`}
                      </p>
                    ))}
                  </div>
                )
              }
              return null
            }}
          />
          {showLegend && <Legend />}
          {bars.map((bar) => (
            <Bar
              key={bar.key}
              dataKey={bar.key}
              name={bar.name}
              fill={bar.color}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}

