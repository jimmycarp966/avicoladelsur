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
  { ruta: 'Ruta A', eficiencia: 92, km_optimos: 25, km_reales: 27 },
  { ruta: 'Ruta B', eficiencia: 88, km_optimos: 32, km_reales: 36 },
  { ruta: 'Ruta C', eficiencia: 95, km_optimos: 18, km_reales: 19 },
  { ruta: 'Ruta D', eficiencia: 85, km_optimos: 45, km_reales: 53 },
  { ruta: 'Ruta E', eficiencia: 90, km_optimos: 28, km_reales: 31 },
]

export function EficienciaRutasChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Eficiencia de Rutas</CardTitle>
        <CardDescription>
          Comparación entre rutas optimizadas y recorridas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <XAxis
              dataKey="ruta"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              label={{ value: 'Kilómetros', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload
                  return (
                    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                      <p className="font-medium text-gray-900">{`Ruta: ${label}`}</p>
                      <p className="text-green-600">
                        {`Km óptimos: ${data.km_optimos}`}
                      </p>
                      <p className="text-blue-600">
                        {`Km recorridos: ${data.km_reales}`}
                      </p>
                      <p className="text-gray-600">
                        {`Eficiencia: ${data.eficiencia}%`}
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Bar
              dataKey="km_optimos"
              fill="#2D5A27"
              radius={[4, 4, 0, 0]}
              name="Km Óptimos"
            />
            <Bar
              dataKey="km_reales"
              fill="#F4C430"
              radius={[4, 4, 0, 0]}
              name="Km Recorridos"
            />
          </BarChart>
        </ResponsiveContainer>

        {/* Estadísticas adicionales */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-700">
              {Math.round(data.reduce((acc, curr) => acc + curr.eficiencia, 0) / data.length)}%
            </div>
            <div className="text-sm text-green-600">Eficiencia Promedio</div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-700">
              {data.reduce((acc, curr) => acc + (curr.km_reales - curr.km_optimos), 0)}
            </div>
            <div className="text-sm text-blue-600">Km Extra Totales</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
