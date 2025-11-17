'use client'

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

// Datos de ejemplo - en producción vendrían de la base de datos
const data = [
  { mes: 'Ene', ventas: 45000, pedidos: 120 },
  { mes: 'Feb', ventas: 52000, pedidos: 135 },
  { mes: 'Mar', ventas: 48000, pedidos: 128 },
  { mes: 'Abr', ventas: 61000, pedidos: 156 },
  { mes: 'May', ventas: 55000, pedidos: 142 },
  { mes: 'Jun', ventas: 67000, pedidos: 168 },
  { mes: 'Jul', ventas: 72000, pedidos: 178 },
  { mes: 'Ago', ventas: 69000, pedidos: 172 },
  { mes: 'Sep', ventas: 75000, pedidos: 185 },
  { mes: 'Oct', ventas: 78000, pedidos: 192 },
  { mes: 'Nov', ventas: 82000, pedidos: 201 },
  { mes: 'Dic', ventas: 85000, pedidos: 210 },
]

export function VentasMensualesChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ventas Mensuales</CardTitle>
        <CardDescription>
          Evolución de ventas y pedidos en el último año
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="ventasGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2D5A27" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#2D5A27" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis
              dataKey="mes"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const ventasData = payload[0]?.payload
                  return (
                    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                      <p className="font-medium text-gray-900 mb-2">{`Mes: ${label}`}</p>
                      <p className="text-green-600">
                        {`Ventas: ${formatCurrency(payload[0]?.value as number)}`}
                      </p>
                      {ventasData?.pedidos && (
                        <p className="text-blue-600">
                          {`Pedidos: ${ventasData.pedidos} unidades`}
                        </p>
                      )}
                    </div>
                  )
                }
                return null
              }}
            />
            <Area
              type="monotone"
              dataKey="ventas"
              stroke="#2D5A27"
              strokeWidth={2}
              fill="url(#ventasGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
