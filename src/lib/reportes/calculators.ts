/**
 * Calcula el crecimiento porcentual entre dos períodos
 */
export function calculateGrowth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

/**
 * Calcula el promedio de un array de números
 */
export function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0
  const sum = values.reduce((acc, val) => acc + val, 0)
  return sum / values.length
}

/**
 * Calcula la mediana de un array de números
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

/**
 * Calcula la desviación estándar
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0
  const avg = calculateAverage(values)
  const squareDiffs = values.map((value) => Math.pow(value - avg, 2))
  const avgSquareDiff = calculateAverage(squareDiffs)
  return Math.sqrt(avgSquareDiff)
}

/**
 * Calcula el coeficiente de variación (CV)
 */
export function calculateCoefficientOfVariation(values: number[]): number {
  const avg = calculateAverage(values)
  if (avg === 0) return 0
  const stdDev = calculateStandardDeviation(values)
  return (stdDev / avg) * 100
}

/**
 * Calcula días de inventario (DIO - Days of Inventory Outstanding)
 */
export function calculateDIO(
  averageInventory: number,
  dailyCOGS: number
): number {
  if (dailyCOGS === 0) return 0
  return averageInventory / dailyCOGS
}

/**
 * Calcula el reorder point básico
 */
export function calculateReorderPoint(
  averageDailyDemand: number,
  leadTimeDays: number,
  safetyStock: number = 0
): number {
  return averageDailyDemand * leadTimeDays + safetyStock
}

/**
 * Calcula el safety stock básico
 */
export function calculateSafetyStock(
  averageDemand: number,
  stdDevDemand: number,
  leadTimeDays: number,
  serviceLevel: number = 1.65 // 95% service level
): number {
  return serviceLevel * stdDevDemand * Math.sqrt(leadTimeDays)
}

/**
 * Calcula el EOQ (Economic Order Quantity)
 */
export function calculateEOQ(
  annualDemand: number,
  orderingCost: number,
  holdingCost: number
): number {
  if (holdingCost === 0) return 0
  return Math.sqrt((2 * annualDemand * orderingCost) / holdingCost)
}

/**
 * Calcula el margen bruto
 */
export function calculateGrossMargin(revenue: number, cost: number): number {
  if (revenue === 0) return 0
  return ((revenue - cost) / revenue) * 100
}

/**
 * Calcula el ticket promedio
 */
export function calculateAverageTicket(totalRevenue: number, numberOfTransactions: number): number {
  if (numberOfTransactions === 0) return 0
  return totalRevenue / numberOfTransactions
}

/**
 * Agrupa valores por período (día, semana, mes)
 */
export function groupByPeriod<T>(
  data: T[],
  dateField: keyof T,
  period: 'day' | 'week' | 'month'
): Record<string, T[]> {
  const grouped: Record<string, T[]> = {}
  
  data.forEach((item) => {
    const date = new Date(item[dateField] as any)
    let key: string
    
    if (period === 'day') {
      key = date.toISOString().split('T')[0]
    } else if (period === 'week') {
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      key = weekStart.toISOString().split('T')[0]
    } else {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    }
    
    if (!grouped[key]) {
      grouped[key] = []
    }
    grouped[key].push(item)
  })
  
  return grouped
}

