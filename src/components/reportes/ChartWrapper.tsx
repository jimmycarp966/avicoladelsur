'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ChartWrapperProps {
  title: string
  description?: string
  isLoading?: boolean
  error?: string | null
  className?: string
  children: React.ReactNode
  action?: React.ReactNode
}

export function ChartWrapper({
  title,
  description,
  isLoading = false,
  error = null,
  className,
  children,
  action,
}: ChartWrapperProps) {
  return (
    <Card className={cn('relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-white via-white to-primary/3 hover:shadow-xl transition-all duration-300', className)}>
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/60 to-secondary/60" />
      <div className="absolute top-4 right-4 w-12 h-12 bg-primary/5 rounded-full blur-lg" />
      <CardHeader className="relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-primary">{title}</CardTitle>
            {description && <CardDescription className="text-muted-foreground/80">{description}</CardDescription>}
          </div>
          {action && <div>{action}</div>}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-[300px] w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <div className="w-full">{children}</div>
        )}
      </CardContent>
    </Card>
  )
}

