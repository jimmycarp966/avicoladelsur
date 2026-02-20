import * as React from 'react'
import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'
import {
    TrendingUp,
    TrendingDown,
    Minus,
    LucideIcon
} from 'lucide-react'
import { ClientCountUp } from './client-countup'

const statCardVariants = cva(
    'relative flex flex-col gap-3 rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-card overflow-hidden group',
    {
        variants: {
            variant: {
                default: 'border-border/60 shadow-lg hover:border-border',
                success: 'border-success/20 shadow-success/10 hover:border-success/40 hover:shadow-success/20',
                warning: 'border-warning/30 shadow-warning/10 hover:border-warning/50 hover:shadow-warning/20',
                danger: 'border-destructive/20 shadow-destructive/10 hover:border-destructive/40 hover:shadow-destructive/20',
                info: 'border-info/20 shadow-info/10 hover:border-info/40 hover:shadow-info/20',
                primary: 'border-primary/20 shadow-primary/10 hover:border-primary/40 hover:shadow-primary/20 bg-gradient-to-br from-card to-primary/5',
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
    value: React.ReactNode
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
                        <div className="text-3xl font-bold tracking-tight text-foreground">
                            {typeof value === 'number' ? (
                                <ClientCountUp end={value} separator="," duration={2} />
                            ) : typeof value === 'string' && !isNaN(Number(value)) ? (
                                <ClientCountUp end={Number(value)} separator="," duration={2} />
                            ) : (
                                value
                            )}
                        </div>
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

            {/* Efecto Glow en la esquina superior derecha */}
            <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br from-current/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 blur-2xl" />
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
