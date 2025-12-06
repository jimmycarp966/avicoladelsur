'use client'

import { useEffect, useState } from 'react'
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
import { obtenerVentasMensuales } from '@/actions/dashboard.actions'

export function VentasMensualesChart() {
  const [data, setData] = useState<Array<{ mes: string; ventas: number; pedidos: number }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const result = await obtenerVentasMensuales()
      if (result.success && result.data) {
        setData(result.data)
      }
      setLoading(false)
    }
    fetchData()
  }, [])
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ventas Mensuales</CardTitle>
        <CardDescription>
          Evolución de ventas y pedidos en el último año
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-[300px]">
            <p className="text-muted-foreground">Cargando datos...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-[300px]">
            <p className="text-muted-foreground">No hay datos disponibles</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="ventasGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2F7058" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#2F7058" stopOpacity={0}/>
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
                      <p className="text-[#2F7058]">
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
              stroke="#2F7058"
              strokeWidth={2}
              fill="url(#ventasGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
