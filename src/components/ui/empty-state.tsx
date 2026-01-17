'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import {
    Inbox,
    Search,
    FileQuestion,
    FolderOpen,
    Users,
    Package,
    ShoppingCart,
    FileText,
    Truck,
    LucideIcon
} from 'lucide-react'
import { Button } from './button'

// Preset illustrations for common empty states
const illustrations: Record<string, LucideIcon> = {
    inbox: Inbox,
    search: Search,
    file: FileQuestion,
    folder: FolderOpen,
    users: Users,
    products: Package,
    orders: ShoppingCart,
    documents: FileText,
    delivery: Truck,
}

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Icon type from presets or custom LucideIcon */
    icon?: keyof typeof illustrations | LucideIcon
    /** Main title */
    title: string
    /** Description text */
    description?: string
    /** Call to action button */
    action?: {
        label: string
        onClick?: () => void
        href?: string
    }
    /** Size variant */
    size?: 'sm' | 'md' | 'lg'
}

function EmptyState({
    className,
    icon = 'inbox',
    title,
    description,
    action,
    size = 'md',
    ...props
}: EmptyStateProps) {
    // Resolve icon - either from presets or custom
    const IconComponent = typeof icon === 'string'
        ? illustrations[icon] || Inbox
        : icon

    const sizeClasses = {
        sm: {
            container: 'py-8 px-4',
            icon: 'h-10 w-10',
            iconContainer: 'h-16 w-16',
            title: 'text-base',
            description: 'text-sm',
        },
        md: {
            container: 'py-12 px-6',
            icon: 'h-12 w-12',
            iconContainer: 'h-20 w-20',
            title: 'text-lg',
            description: 'text-sm',
        },
        lg: {
            container: 'py-16 px-8',
            icon: 'h-16 w-16',
            iconContainer: 'h-28 w-28',
            title: 'text-xl',
            description: 'text-base',
        },
    }

    const sizes = sizeClasses[size]

    return (
        <div
            data-slot="empty-state"
            className={cn(
                'flex flex-col items-center justify-center text-center',
                sizes.container,
                className
            )}
            {...props}
        >
            {/* Animated icon container */}
            <div
                className={cn(
                    'flex items-center justify-center rounded-full bg-gradient-to-br from-muted to-muted/50 mb-6 shadow-inner',
                    sizes.iconContainer
                )}
            >
                <IconComponent
                    className={cn(
                        'text-muted-foreground/60',
                        sizes.icon
                    )}
                />
            </div>

            {/* Title */}
            <h3
                className={cn(
                    'font-semibold text-foreground mb-2',
                    sizes.title
                )}
            >
                {title}
            </h3>

            {/* Description */}
            {description && (
                <p
                    className={cn(
                        'text-muted-foreground max-w-sm mb-6',
                        sizes.description
                    )}
                >
                    {description}
                </p>
            )}

            {/* Action button */}
            {action && (
                <Button
                    variant="default"
                    size={size === 'sm' ? 'sm' : 'default'}
                    onClick={action.onClick}
                    asChild={!!action.href}
                >
                    {action.href ? (
                        <a href={action.href}>{action.label}</a>
                    ) : (
                        action.label
                    )}
                </Button>
            )}
        </div>
    )
}

// Convenience presets for common scenarios
function EmptyStateNoResults(props: Omit<EmptyStateProps, 'icon' | 'title'> & { title?: string }) {
    return (
        <EmptyState
            icon="search"
            title={props.title || "No se encontraron resultados"}
            description="Intenta ajustar los filtros o términos de búsqueda"
            {...props}
        />
    )
}

function EmptyStateNoData(props: Omit<EmptyStateProps, 'icon' | 'title'> & { title?: string }) {
    return (
        <EmptyState
            icon="inbox"
            title={props.title || "No hay datos disponibles"}
            description="Aún no hay información para mostrar aquí"
            {...props}
        />
    )
}

function EmptyStateNoProducts(props: Omit<EmptyStateProps, 'icon' | 'title'> & { title?: string }) {
    return (
        <EmptyState
            icon="products"
            title={props.title || "Sin productos"}
            description="No hay productos registrados. Comienza agregando uno nuevo."
            {...props}
        />
    )
}

function EmptyStateNoOrders(props: Omit<EmptyStateProps, 'icon' | 'title'> & { title?: string }) {
    return (
        <EmptyState
            icon="orders"
            title={props.title || "Sin pedidos"}
            description="No hay pedidos para mostrar en este momento"
            {...props}
        />
    )
}

function EmptyStateNoUsers(props: Omit<EmptyStateProps, 'icon' | 'title'> & { title?: string }) {
    return (
        <EmptyState
            icon="users"
            title={props.title || "Sin usuarios"}
            description="No se encontraron usuarios que coincidan con los criterios"
            {...props}
        />
    )
}

export {
    EmptyState,
    EmptyStateNoResults,
    EmptyStateNoData,
    EmptyStateNoProducts,
    EmptyStateNoOrders,
    EmptyStateNoUsers,
}
