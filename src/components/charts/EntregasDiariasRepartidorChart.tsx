'use client'

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Datos de ejemplo - en producción vendrían de la base de datos
const data = [
  { dia: 'Lun', entregas: 8, tiempo_promedio: 25 },
  { dia: 'Mar', entregas: 12, tiempo_promedio: 22 },
  { dia: 'Mié', entregas: 10, tiempo_promedio: 28 },
  { dia: 'Jue', entregas: 15, tiempo_promedio: 20 },
  { dia: 'Vie', entregas: 18, tiempo_promedio: 24 },
  { dia: 'Sáb', entregas: 6, tiempo_promedio: 30 },
  { dia: 'Dom', entregas: 3, tiempo_promedio: 35 },
]

export function EntregasDiariasRepartidorChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mi Rendimiento Semanal</CardTitle>
        <CardDescription>
          Entregas realizadas y tiempo promedio por día
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <XAxis
              dataKey="dia"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <YAxis
              yAxisId="entregas"
              orientation="left"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              label={{ value: 'Entregas', angle: -90, position: 'insideLeft' }}
            />
            <YAxis
              yAxisId="tiempo"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              label={{ value: 'Minutos', angle: 90, position: 'insideRight' }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                      <p className="font-medium text-gray-900 mb-2">{`Día: ${label}`}</p>
                      {payload[0] && (
                        <p className="text-blue-600">
                          {`Entregas: ${payload[0].value}`}
                        </p>
                      )}
                      {payload[1] && (
                        <p className="text-green-600">
                          {`Tiempo promedio: ${payload[1].value} min`}
                        </p>
                      )}
                    </div>
                  )
                }
                return null
              }}
            />
            <Line
              yAxisId="entregas"
              type="monotone"
              dataKey="entregas"
              stroke="#2D5A27"
              strokeWidth={3}
              dot={{ fill: '#2D5A27', strokeWidth: 2, r: 4 }}
            />
            <Line
              yAxisId="tiempo"
              type="monotone"
              dataKey="tiempo_promedio"
              stroke="#F4C430"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: '#F4C430', strokeWidth: 2, r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Leyenda */}
        <div className="flex justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-green-700" />
            <span className="text-sm text-gray-600">Entregas realizadas</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 border-t-2 border-dashed border-yellow-500" />
            <span className="text-sm text-gray-600">Tiempo promedio</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
