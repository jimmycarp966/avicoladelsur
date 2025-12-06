'use client'

import { useEffect, useState } from 'react'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { obtenerProductosPorCategoria } from '@/actions/dashboard.actions'

export function ProductosPorCategoriaChart() {
  const [data, setData] = useState<Array<{ name: string; value: number; color: string }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const result = await obtenerProductosPorCategoria()
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
        <CardTitle>Productos por Categoría</CardTitle>
        <CardDescription>
          Distribución del catálogo por categorías
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
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload
                  return (
                    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                      <p className="font-medium text-gray-900">{data.name}</p>
                      <p className="text-gray-600">{`${data.value}% del catálogo`}</p>
                    </div>
                  )
                }
                return null
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        )}

        {/* Leyenda */}
        {data.length > 0 && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            {data.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-gray-600">
                  {item.name}: {item.value}%
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
