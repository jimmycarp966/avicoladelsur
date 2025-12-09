'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
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
  CreditCard,
  ChevronDown,
  ClipboardList,
  FileBarChart,
  Scale,
} from 'lucide-react'

const navigation = [
  {
    name: 'Dashboard',
    href: '/sucursal/dashboard',
    icon: Home,
  },
  {
    name: 'Gestión Local',
    href: '#',
    icon: Package,
    children: [
      { name: 'Inventario', href: '/sucursal/inventario', icon: Package },
      { name: 'Stock Mínimo', href: '/sucursal/inventario/stock-minimo', icon: Scale },
      { name: 'Conteos de Stock', href: '/sucursal/inventario/conteos', icon: ClipboardList },
      { name: 'Ventas (POS)', href: '/sucursal/ventas', icon: ShoppingCart },
      { name: 'Alertas de Stock', href: '/sucursal/alerts', icon: AlertTriangle, badge: 'alerts' },
    ],
  },
  {
    name: 'Operaciones',
    href: '#',
    icon: Truck,
    children: [
      { name: 'Transferencias', href: '/sucursal/transferencias', icon: Truck },
      { name: 'Tesorería', href: '/sucursal/tesoreria', icon: CreditCard },
    ],
  },
  {
    name: 'Comunicación',
    href: '#',
    icon: Megaphone,
    children: [
      { name: 'Novedades', href: '/sucursal/novedades', icon: Megaphone },
    ],
  },
  {
    name: 'Reportes',
    href: '#',
    icon: BarChart3,
    children: [
      { name: 'General', href: '/sucursal/reportes', icon: BarChart3 },
      { name: 'Auditoría Precios', href: '/sucursal/reportes/auditoria', icon: FileBarChart },
    ],
  },
  {
    name: 'Configuración',
    href: '/sucursal/configuracion',
    icon: Settings,
  },
]

interface SucursalSidebarProps {
  className?: string
}

type NavigationItemType = {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  children?: Array<{
    name: string
    href: string
    icon: React.ComponentType<{ className?: string }>
    badge?: string
  }>
  badge?: string
}

interface NavigationItemProps {
  item: NavigationItemType
  pathname: string
}

function NavigationItem({ item, pathname }: NavigationItemProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [alertsCount] = useState(3) // TODO: Obtener dinámicamente
  const searchParams = useSearchParams()
  const sid = searchParams.get('sid')

  const getBadgeCount = (badgeType: string) => {
    switch (badgeType) {
      case 'alerts':
        return alertsCount
      default:
        return 0
    }
  }

  // Función para agregar sid a la URL si existe
  const getHrefWithSid = (href: string) => {
    if (sid && href !== '#') {
      return `${href}${href.includes('?') ? '&' : '?'}sid=${sid}`
    }
    return href
  }

  // Check if current item or any child is active
  const isActive = pathname === item.href ||
    (item.children && item.children.some(child => pathname === child.href))

  // Auto-expand if any child is active
  const shouldBeOpen = isActive || isOpen

  if (item.children) {
    return (
      <div className="space-y-1">
        <Button
          variant="ghost"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'w-full justify-between gap-3 h-10 px-3 font-medium',
            isActive && 'bg-secondary'
          )}
        >
          <div className="flex items-center gap-3">
            <item.icon className="w-4 h-4" />
            <span className="flex-1 text-left">{item.name}</span>
          </div>
          <ChevronDown className={cn(
            "w-4 h-4 transition-transform duration-200",
            shouldBeOpen && "rotate-180"
          )} />
        </Button>

        {shouldBeOpen && (
          <div className="ml-4 pl-4 border-l border-border space-y-1">
            {item.children.map((child) => {
              const childIsActive = pathname === child.href
              const badgeCount = child.badge ? getBadgeCount(child.badge) : 0

              return (
                <Link key={child.href} href={getHrefWithSid(child.href)}>
                  <Button
                    variant={childIsActive ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn(
                      'w-full justify-start gap-3 h-8 px-3',
                      childIsActive && 'bg-secondary'
                    )}
                  >
                    <child.icon className="w-3 h-3" />
                    <span className="flex-1 text-left text-sm">{child.name}</span>
                    {badgeCount > 0 && (
                      <Badge variant="destructive" className="ml-auto h-4 px-1 text-xs">
                        {badgeCount}
                      </Badge>
                    )}
                  </Button>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Regular item without children
  const badgeCount = item.badge ? getBadgeCount(item.badge) : 0

  return (
    <Link href={getHrefWithSid(item.href)}>
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
}

export function SucursalSidebar({ className }: SucursalSidebarProps) {
  const pathname = usePathname()

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
            {navigation.map((item) => (
              <NavigationItem key={item.name} item={item} pathname={pathname} />
            ))}
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
