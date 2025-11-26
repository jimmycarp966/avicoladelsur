'use client'

'use client'

import React, { useMemo } from 'react'
import { ChartWrapper } from '../ChartWrapper'
import { formatNumber } from '@/lib/utils'

interface HeatmapData {
  dia_semana: number
  hora: number
  ventas: number
  transacciones: number
}

interface HeatmapChartProps {
  title: string
  description?: string
  data: HeatmapData[]
  isLoading?: boolean
  error?: string | null
  height?: number
}

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const HORAS = Array.from({ length: 24 }, (_, i) => i)

export function HeatmapChart({
  title,
  description,
  data,
  isLoading = false,
  error = null,
  height = 400,
}: HeatmapChartProps) {
  // Preparar matriz de datos
  const heatmapData = useMemo(() => {
    const matrix: Record<string, Record<number, number>> = {}
    
    // Inicializar matriz
    DIAS_SEMANA.forEach((_, diaIdx) => {
      matrix[diaIdx] = {}
      HORAS.forEach((hora) => {
        matrix[diaIdx][hora] = 0
      })
    })

    // Llenar con datos reales
    data.forEach((item) => {
      const dia = item.dia_semana
      const hora = item.hora
      if (matrix[dia] && matrix[dia][hora] !== undefined) {
        matrix[dia][hora] = item.ventas
      }
    })

    return matrix
  }, [data])

  // Calcular máximo para normalizar colores
  const maxValue = useMemo(() => {
    return Math.max(
      ...Object.values(heatmapData).flatMap((dia) => Object.values(dia)),
      1
    )
  }, [heatmapData])

  const getColorIntensity = (value: number) => {
    if (value === 0) return 'bg-gray-100'
    const intensity = (value / maxValue) * 100
    if (intensity < 25) return 'bg-green-200'
    if (intensity < 50) return 'bg-green-400'
    if (intensity < 75) return 'bg-green-600'
    return 'bg-green-800'
  }

  return (
    <ChartWrapper title={title} description={description} isLoading={isLoading} error={error}>
      <div className="w-full overflow-x-auto">
        <div style={{ height: `${height}px` }} className="min-w-[800px]">
          <div className="grid gap-1 h-full" style={{ gridTemplateColumns: '80px repeat(24, 1fr)' }}>
            {/* Header con horas */}
            <div></div>
            {HORAS.map((hora) => (
              <div
                key={hora}
                className="text-xs font-medium text-center text-muted-foreground flex items-center justify-center"
              >
                {hora}h
              </div>
            ))}

            {/* Filas por día */}
            {DIAS_SEMANA.map((dia, diaIdx) => (
              <React.Fragment key={diaIdx}>
                <div className="text-xs font-medium text-muted-foreground flex items-center justify-center">
                  {dia}
                </div>
                {HORAS.map((hora) => {
                  const value = heatmapData[diaIdx]?.[hora] || 0
                  return (
                    <div
                      key={`${diaIdx}-${hora}`}
                      className={`${getColorIntensity(value)} rounded-sm flex items-center justify-center text-xs text-white font-medium cursor-pointer hover:opacity-80 transition-opacity`}
                      title={`${dia} ${hora}h: $${formatNumber(value, 2)}`}
                    >
                      {value > 0 && (
                        <span className="text-[10px]">
                          ${formatNumber(value / 1000, 0)}k
                        </span>
                      )}
                    </div>
                  )
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Leyenda */}
        <div className="mt-4 flex items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-100 rounded"></div>
            <span className="text-xs text-muted-foreground">Sin ventas</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-200 rounded"></div>
            <span className="text-xs text-muted-foreground">Bajo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-400 rounded"></div>
            <span className="text-xs text-muted-foreground">Medio</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-600 rounded"></div>
            <span className="text-xs text-muted-foreground">Alto</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-800 rounded"></div>
            <span className="text-xs text-muted-foreground">Muy Alto</span>
          </div>
        </div>
      </div>
    </ChartWrapper>
  )
}

