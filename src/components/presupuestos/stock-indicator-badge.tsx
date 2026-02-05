'use client'

import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Package, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StockIndicatorBadgeProps {
  stockDisponible: number
  stockReal?: number
  stockReservado?: number
  unidadMedida: string
  size?: 'sm' | 'default'
  showIcon?: boolean
  className?: string
}

export function StockIndicatorBadge({
  stockDisponible,
  stockReal,
  stockReservado,
  unidadMedida,
  size = 'sm',
  showIcon = true,
  className
}: StockIndicatorBadgeProps) {
  const getVariant = (): 'success' | 'warning' | 'destructive' => {
    if (stockDisponible <= 0) return 'destructive'
    if (stockDisponible <= 10) return 'warning'
    return 'success'
  }

  const getIcon = () => {
    if (stockDisponible <= 0) return AlertTriangle
    if (stockDisponible <= 10) return AlertTriangle
    return Package
  }

  const Icon = showIcon ? getIcon() : null

  return (
    <Badge
      variant={getVariant()}
      size={size}
      className={cn('gap-1.5 font-medium', className)}
    >
      {Icon && <Icon className="h-3 w-3" />}
      <span>{stockDisponible.toFixed(1)} {unidadMedida}</span>
    </Badge>
  )
}
