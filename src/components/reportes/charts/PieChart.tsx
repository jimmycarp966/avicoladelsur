'use client'

import {
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Cell,
  Legend,
} from 'recharts'
import { ChartWrapper } from '../ChartWrapper'
import { formatCurrency, formatNumber } from '@/lib/utils'

interface PieChartData {
  name: string
  value: number
  color?: string
  [key: string]: any
}

interface PieChartProps {
  title: string
  description?: string
  data: PieChartData[]
  isLoading?: boolean
  error?: string | null
  formatValue?: 'currency' | 'number' | 'percentage'
  height?: number
  innerRadius?: number
  outerRadius?: number
  showLegend?: boolean
  colors?: string[]
}

const DEFAULT_COLORS = ['#2d6a4f', '#8b2635', '#d4a574', '#3b7c8f', '#f5e6d3', '#1a4d2e']

export function PieChartComponent({
  title,
  description,
  data,
  isLoading = false,
  error = null,
  formatValue = 'number',
  height = 300,
  innerRadius = 0,
  outerRadius = 100,
  showLegend = true,
  colors = DEFAULT_COLORS,
}: PieChartProps) {
  const formatTooltipValue = (value: number) => {
    if (formatValue === 'currency') return formatCurrency(value)
    if (formatValue === 'percentage') return `${formatNumber(value, 1)}%`
    return formatNumber(value, 0)
  }

  // Calcular total para porcentajes
  const total = data.reduce((sum, item) => sum + item.value, 0)

  return (
    <ChartWrapper title={title} description={description} isLoading={isLoading} error={error}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) => `${name}: ${(percent as number * 100).toFixed(0)}%`}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || colors[index % colors.length]}
              />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload
                const percentage = total > 0 ? (data.value / total) * 100 : 0
                return (
                  <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                    <p className="font-medium text-gray-900">{data.name}</p>
                    <p className="text-gray-600">
                      {formatTooltipValue(data.value)} ({formatNumber(percentage, 1)}%)
                    </p>
                  </div>
                )
              }
              return null
            }}
          />
          {showLegend && (
            <Legend
              formatter={(value, entry: any) => (
                <span style={{ color: entry.color }}>{value}</span>
              )}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    </ChartWrapper>
  )
}

