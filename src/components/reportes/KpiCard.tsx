import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/utils'

interface KpiCardProps {
  title: string
  value: number | string
  icon?: LucideIcon
  change?: number // Porcentaje de cambio
  changeLabel?: string
  format?: 'currency' | 'number' | 'percentage' | 'text'
  decimals?: number
  trend?: 'up' | 'down' | 'neutral'
  className?: string
  description?: string
}

export function KpiCard({
  title,
  value,
  icon: Icon,
  change,
  changeLabel,
  format = 'number',
  decimals = 2,
  trend,
  className,
  description,
}: KpiCardProps) {
  const formatValue = () => {
    if (typeof value === 'string') return value
    if (format === 'currency') return formatCurrency(value)
    if (format === 'percentage') return `${formatNumber(value, decimals)}%`
    if (format === 'number') return formatNumber(value, decimals)
    return String(value)
  }

  const getTrendColor = () => {
    if (trend === 'up') return 'text-success'
    if (trend === 'down') return 'text-destructive'
    return 'text-muted-foreground'
  }

  const getChangeColor = () => {
    if (!change) return 'text-muted-foreground'
    if (change > 0) return 'text-success'
    if (change < 0) return 'text-destructive'
    return 'text-muted-foreground'
  }

  return (
    <Card className={cn('border-primary/10 hover:shadow-md transition-shadow', className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
            <p className="text-2xl font-bold text-foreground">{formatValue()}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
            {change !== undefined && (
              <div className="flex items-center gap-1 mt-2">
                <span className={cn('text-xs font-medium', getChangeColor())}>
                  {change > 0 ? '↑' : change < 0 ? '↓' : '→'} {Math.abs(change).toFixed(1)}%
                </span>
                {changeLabel && (
                  <span className="text-xs text-muted-foreground">vs {changeLabel}</span>
                )}
              </div>
            )}
          </div>
          {Icon && (
            <div className="ml-4 p-3 rounded-full bg-primary/10">
              <Icon className={cn('h-5 w-5', getTrendColor())} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

