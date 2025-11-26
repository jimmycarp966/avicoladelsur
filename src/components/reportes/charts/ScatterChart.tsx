'use client'

import {
  Scatter,
  ScatterChart,
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

interface ScatterData {
  x: number
  y: number
  name?: string
  value?: number
  [key: string]: any
}

interface ScatterChartProps {
  title: string
  description?: string
  data: ScatterData[]
  xKey: string
  yKey: string
  xLabel?: string
  yLabel?: string
  isLoading?: boolean
  error?: string | null
  height?: number
  formatX?: 'currency' | 'number' | 'percentage'
  formatY?: 'currency' | 'number' | 'percentage'
}

export function ScatterChartComponent({
  title,
  description,
  data,
  xKey,
  yKey,
  xLabel,
  yLabel,
  isLoading = false,
  error = null,
  height = 400,
  formatX = 'number',
  formatY = 'number',
}: ScatterChartProps) {
  const formatTooltipValue = (value: number, format: string) => {
    if (format === 'currency') return formatCurrency(value)
    if (format === 'percentage') return `${formatNumber(value, 1)}%`
    return formatNumber(value, 0)
  }

  return (
    <ChartWrapper title={title} description={description} isLoading={isLoading} error={error}>
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            type="number"
            dataKey={xKey}
            name={xLabel || xKey}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickFormatter={(value) => {
              if (formatX === 'currency') {
                return `$${formatNumber(value, 0)}`
              }
              return formatNumber(value, 0)
            }}
            label={{ value: xLabel || xKey, position: 'insideBottom', offset: -5 }}
          />
          <YAxis
            type="number"
            dataKey={yKey}
            name={yLabel || yKey}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickFormatter={(value) => {
              if (formatY === 'currency') {
                return `$${formatNumber(value, 0)}`
              }
              return formatNumber(value, 0)
            }}
            label={{ value: yLabel || yKey, angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload
                return (
                  <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                    {data.name && (
                      <p className="font-medium text-gray-900 mb-2">{data.name}</p>
                    )}
                    <p className="text-sm text-gray-600">
                      {xLabel || xKey}: {formatTooltipValue(data[xKey], formatX)}
                    </p>
                    <p className="text-sm text-gray-600">
                      {yLabel || yKey}: {formatTooltipValue(data[yKey], formatY)}
                    </p>
                    {data.value && (
                      <p className="text-sm font-semibold text-primary mt-1">
                        Valor: {formatCurrency(data.value)}
                      </p>
                    )}
                  </div>
                )
              }
              return null
            }}
          />
          <Legend />
          <Scatter
            name={title}
            data={data}
            fill="#2d6a4f"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill="#2d6a4f" />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}

