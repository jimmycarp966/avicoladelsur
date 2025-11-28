'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Home,
  Package,
  ShoppingCart,
  AlertTriangle,
  Settings,
  BarChart3,
  Megaphone,
  Truck,
  CreditCard
} from 'lucide-react'

const navigation = [
  {
    name: 'Dashboard',
    href: '/sucursal/dashboard',
    icon: Home,
  },
  {
    name: 'Inventario',
    href: '/sucursal/inventario',
    icon: Package,
  },
  {
    name: 'Ventas',
    href: '/sucursal/ventas',
    icon: ShoppingCart,
  },
  {
    name: 'Alertas Stock',
    href: '/sucursal/alerts',
    icon: AlertTriangle,
    badge: 'alerts', // Indicador dinámico
  },
  {
    name: 'Novedades',
    href: '/sucursal/novedades',
    icon: Megaphone,
  },
  {
    name: 'Transferencias',
    href: '/sucursal/transferencias',
    icon: Truck,
  },
  {
    name: 'Tesorería',
    href: '/sucursal/tesoreria',
    icon: CreditCard,
  },
  {
    name: 'Reportes',
    href: '/sucursal/reportes',
    icon: BarChart3,
  },
]

interface SucursalSidebarProps {
  className?: string
}

export function SucursalSidebar({ className }: SucursalSidebarProps) {
  const pathname = usePathname()
  const [alertsCount] = useState(3) // TODO: Obtener dinámicamente

  const getBadgeCount = (badgeType: string) => {
    switch (badgeType) {
      case 'alerts':
        return alertsCount
      default:
        return 0
    }
  }

  return (
    <div className={cn('fixed inset-y-0 left-0 z-50 w-64 bg-card border-r', className)}>
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/sucursal/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Sucursal</span>
              <span className="text-xs text-muted-foreground">Avícola del Sur</span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              const badgeCount = item.badge ? getBadgeCount(item.badge) : 0

              return (
                <Link key={item.name} href={item.href}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    className={cn(
                      'w-full justify-start gap-3 h-10 px-3',
                      isActive && 'bg-secondary'
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="flex-1 text-left">{item.name}</span>
                    {badgeCount > 0 && (
                      <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-xs">
                        {badgeCount}
                      </Badge>
                    )}
                  </Button>
                </Link>
              )
            })}
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Sucursal Manager</p>
              <p className="text-xs text-muted-foreground">v1.0.0</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
