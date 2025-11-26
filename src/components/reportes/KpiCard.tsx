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
    <Card className={cn('relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-white via-white to-primary/5 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group', className)}>
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/60 to-primary" />
      <div className="absolute top-4 right-4 w-12 h-12 bg-primary/5 rounded-full blur-lg group-hover:bg-primary/10 transition-colors" />
      <CardContent className="p-6 relative z-10">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-semibold text-muted-foreground mb-2 group-hover:text-primary/70 transition-colors">{title}</p>
            <p className="text-3xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">{formatValue()}</p>
            {description && (
              <p className="text-sm text-muted-foreground group-hover:text-muted-foreground/80 transition-colors">{description}</p>
            )}
            {change !== undefined && (
              <div className="flex items-center gap-2 mt-3">
                <div className={cn('px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1',
                  change > 0 ? 'bg-success/15 text-success' :
                  change < 0 ? 'bg-destructive/15 text-destructive' :
                  'bg-muted/15 text-muted-foreground'
                )}>
                  <span>{change > 0 ? '↗' : change < 0 ? '↘' : '→'}</span>
                  <span>{Math.abs(change).toFixed(1)}%</span>
                </div>
                {changeLabel && (
                  <span className="text-xs text-muted-foreground">vs {changeLabel}</span>
                )}
              </div>
            )}
          </div>
          {Icon && (
            <div className="ml-4 p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 group-hover:from-primary/20 group-hover:to-primary/10 transition-all duration-300 group-hover:scale-110">
              <Icon className={cn('h-6 w-6', getTrendColor())} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

