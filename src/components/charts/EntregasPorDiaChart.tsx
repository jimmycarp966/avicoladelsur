'use client'

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Datos de ejemplo - en producción vendrían de la base de datos
const data = [
  { dia: 'Lun', entregas: 12, km: 45 },
  { dia: 'Mar', entregas: 15, km: 52 },
  { dia: 'Mié', entregas: 18, km: 48 },
  { dia: 'Jue', entregas: 14, km: 41 },
  { dia: 'Vie', entregas: 22, km: 67 },
  { dia: 'Sáb', entregas: 8, km: 28 },
  { dia: 'Dom', entregas: 3, km: 12 },
]

export function EntregasPorDiaChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Entregas por Día</CardTitle>
        <CardDescription>
          Rendimiento semanal de entregas y kilometraje
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <XAxis
              dataKey="dia"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
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
                          {`Kilómetros: ${payload[1].value} km`}
                        </p>
                      )}
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar
              dataKey="entregas"
              fill="#2D5A27"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="km"
              fill="#F4C430"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>

        {/* Leyenda */}
        <div className="flex justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#2D5A27' }} />
            <span className="text-sm text-gray-600">Entregas</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: '#F4C430' }} />
            <span className="text-sm text-gray-600">Kilómetros</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
