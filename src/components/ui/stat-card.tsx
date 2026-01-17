import * as React from 'react'
import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'
import {
    TrendingUp,
    TrendingDown,
    Minus,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Info,
    LucideIcon
} from 'lucide-react'

const statCardVariants = cva(
    'relative flex flex-col gap-3 rounded-2xl border p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1',
    {
        variants: {
            variant: {
                default: 'bg-card border-border/60 shadow-lg',
                success: 'bg-gradient-to-br from-success/5 to-success/10 border-success/20 shadow-success/10',
                warning: 'bg-gradient-to-br from-warning/10 to-warning/20 border-warning/30 shadow-warning/10',
                danger: 'bg-gradient-to-br from-destructive/5 to-destructive/10 border-destructive/20 shadow-destructive/10',
                info: 'bg-gradient-to-br from-info/5 to-info/10 border-info/20 shadow-info/10',
                primary: 'bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 shadow-primary/10',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    }
)

const iconContainerVariants = cva(
    'flex h-14 w-14 items-center justify-center rounded-xl transition-all duration-200',
    {
        variants: {
            variant: {
                default: 'bg-muted text-muted-foreground',
                success: 'bg-success/15 text-success',
                warning: 'bg-warning/20 text-warning-foreground',
                danger: 'bg-destructive/15 text-destructive',
                info: 'bg-info/15 text-info-foreground',
                primary: 'bg-primary/15 text-primary',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    }
)

interface StatCardProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statCardVariants> {
    title: string
    value: string | number
    subtitle?: string
    icon?: LucideIcon
    trend?: {
        value: number
        label?: string
    }
    action?: React.ReactNode
}

function StatCard({
    className,
    variant,
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
    action,
    ...props
}: StatCardProps) {
    const TrendIcon = trend?.value && trend.value > 0
        ? TrendingUp
        : trend?.value && trend.value < 0
            ? TrendingDown
            : Minus

    const trendColor = trend?.value && trend.value > 0
        ? 'text-success'
        : trend?.value && trend.value < 0
            ? 'text-destructive'
            : 'text-muted-foreground'

    return (
        <div
            data-slot="stat-card"
            className={cn(statCardVariants({ variant }), className)}
            {...props}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-bold tracking-tight text-foreground">
                            {value}
                        </p>
                        {trend && (
                            <div className={cn('flex items-center gap-0.5 text-sm font-medium', trendColor)}>
                                <TrendIcon className="h-4 w-4" />
                                <span>{trend.value > 0 ? '+' : ''}{trend.value}%</span>
                            </div>
                        )}
                    </div>
                    {subtitle && (
                        <p className="text-xs text-muted-foreground">{subtitle}</p>
                    )}
                    {trend?.label && (
                        <p className="text-xs text-muted-foreground mt-1">{trend.label}</p>
                    )}
                </div>

                {Icon && (
                    <div className={cn(iconContainerVariants({ variant }))}>
                        <Icon className="h-7 w-7" />
                    </div>
                )}
            </div>

            {action && (
                <div className="pt-2 border-t border-border/50">
                    {action}
                </div>
            )}
        </div>
    )
}

// Convenience components for common variants
function StatCardSuccess(props: Omit<StatCardProps, 'variant'>) {
    return <StatCard variant="success" {...props} />
}

function StatCardWarning(props: Omit<StatCardProps, 'variant'>) {
    return <StatCard variant="warning" {...props} />
}

function StatCardDanger(props: Omit<StatCardProps, 'variant'>) {
    return <StatCard variant="danger" {...props} />
}

function StatCardInfo(props: Omit<StatCardProps, 'variant'>) {
    return <StatCard variant="info" {...props} />
}

function StatCardPrimary(props: Omit<StatCardProps, 'variant'>) {
    return <StatCard variant="primary" {...props} />
}

export {
    StatCard,
    StatCardSuccess,
    StatCardWarning,
    StatCardDanger,
    StatCardInfo,
    StatCardPrimary,
    statCardVariants
}
