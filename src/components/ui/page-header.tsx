'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { ChevronRight, Home, LucideIcon } from 'lucide-react'
import Link from 'next/link'

interface BreadcrumbItem {
    label: string
    href?: string
    icon?: LucideIcon
}

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Page title */
    title: string
    /** Page description */
    description?: string
    /** Breadcrumb items */
    breadcrumbs?: BreadcrumbItem[]
    /** Actions slot (buttons, etc.) */
    actions?: React.ReactNode
    /** Icon to display next to title */
    icon?: LucideIcon
    /** Badge to display next to title */
    badge?: React.ReactNode
}

function PageHeader({
    className,
    title,
    description,
    breadcrumbs,
    actions,
    icon: Icon,
    badge,
    ...props
}: PageHeaderProps) {
    return (
        <div
            data-slot="page-header"
            className={cn('mb-8', className)}
            {...props}
        >
            {/* Breadcrumbs */}
            {breadcrumbs && breadcrumbs.length > 0 && (
                <nav
                    aria-label="Breadcrumb"
                    className="mb-4"
                >
                    <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <li>
                            <Link
                                href="/dashboard"
                                className="flex items-center hover:text-foreground transition-colors"
                            >
                                <Home className="h-4 w-4" />
                            </Link>
                        </li>
                        {breadcrumbs.map((item, index) => (
                            <li key={index} className="flex items-center gap-1.5">
                                <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                                {item.href && index < breadcrumbs.length - 1 ? (
                                    <Link
                                        href={item.href}
                                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                                    >
                                        {item.icon && <item.icon className="h-4 w-4" />}
                                        {item.label}
                                    </Link>
                                ) : (
                                    <span className="flex items-center gap-1 font-medium text-foreground">
                                        {item.icon && <item.icon className="h-4 w-4" />}
                                        {item.label}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ol>
                </nav>
            )}

            {/* Header row */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1.5">
                    {/* Title with optional icon and badge */}
                    <div className="flex items-center gap-3">
                        {Icon && (
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <Icon className="h-5 w-5" />
                            </div>
                        )}
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                                {title}
                            </h1>
                            {badge}
                        </div>
                    </div>

                    {/* Description */}
                    {description && (
                        <p className="text-muted-foreground max-w-2xl">
                            {description}
                        </p>
                    )}
                </div>

                {/* Actions */}
                {actions && (
                    <div className="flex items-center gap-3 shrink-0">
                        {actions}
                    </div>
                )}
            </div>
        </div>
    )
}

export { PageHeader }
export type { PageHeaderProps, BreadcrumbItem }
