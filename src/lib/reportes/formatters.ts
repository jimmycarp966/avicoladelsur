import { formatCurrency, formatNumber } from '@/lib/utils'

/**
 * Formatea un valor numérico según el tipo especificado
 */
export function formatReportValue(
  value: number | string | null | undefined,
  type: 'currency' | 'number' | 'percentage' | 'text' = 'number',
  decimals: number = 2
): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'string') return value
  if (type === 'currency') return formatCurrency(value)
  if (type === 'percentage') return `${formatNumber(value, decimals)}%`
  if (type === 'number') return formatNumber(value, decimals)
  return String(value)
}

/**
 * Calcula el porcentaje de cambio entre dos valores
 */
export function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

/**
 * Determina la tendencia basada en el cambio
 */
export function getTrend(change: number): 'up' | 'down' | 'neutral' {
  if (change > 0) return 'up'
  if (change < 0) return 'down'
  return 'neutral'
}

/**
 * Formatea un número grande con abreviaciones (K, M, B)
 */
export function formatLargeNumber(value: number, decimals: number = 1): string {
  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(decimals)}B`
  }
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(decimals)}M`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(decimals)}K`
  }
  return value.toFixed(decimals)
}

/**
 * Formatea una duración en minutos a formato legible
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`
  }
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`
}

/**
 * Formatea una distancia en km
 */
export function formatDistance(km: number, decimals: number = 2): string {
  return `${formatNumber(km, decimals)} km`
}

/**
 * Formatea un porcentaje con color según el valor
 */
export function formatPercentageWithColor(value: number): {
  text: string
  color: string
} {
  const text = `${formatNumber(value, 1)}%`
  let color = 'text-muted-foreground'
  if (value >= 90) color = 'text-success'
  else if (value >= 70) color = 'text-info'
  else if (value >= 50) color = 'text-warning'
  else color = 'text-destructive'
  return { text, color }
}

