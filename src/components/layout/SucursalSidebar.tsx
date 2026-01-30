'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Home,
  Package,
  ShoppingCart,
  DollarSign,
  Truck,
  ChevronDown,
  Settings,
  MoreHorizontal,
  ClipboardList,
  Scale,
  AlertTriangle,
  BarChart3,
  Megaphone,
} from 'lucide-react'

// ============================================
// ESTRUCTURA SIMPLIFICADA - 3 SECCIONES
// ============================================

// Sección 1: Acciones Principales (siempre visible, destacada)
const accionesPrincipales = [
  {
    name: 'Inicio',
    href: '/sucursal/dashboard',
    icon: Home,
    description: 'Panel principal',
  },
  {
    name: 'Vender',
    href: '/sucursal/ventas',
    icon: ShoppingCart,
    description: 'Registrar venta',
    highlight: true, // Destacar este botón
  },
  {
    name: 'Recibir Mercadería',
    href: '/sucursal/transferencias',
    icon: Truck,
    description: 'Transferencias pendientes',
    badge: 'transferencias', // Badge dinámico
  },
]

// Sección 2: Consultas (siempre visible)
const consultas = [
  {
    name: 'Ver Stock',
    href: '/sucursal/inventario',
    icon: Package,
    description: 'Consultar inventario',
  },
  {
    name: 'Ver Caja',
    href: '/sucursal/tesoreria',
    icon: DollarSign,
    description: 'Saldo y movimientos',
  },
]

// Sección 3: Más Opciones (colapsada por defecto)
const masOpciones = [
  { name: 'Conteos de Stock', href: '/sucursal/inventario/conteos', icon: ClipboardList },
  { name: 'Stock Mínimo', href: '/sucursal/inventario/stock-minimo', icon: Scale },
  { name: 'Alertas de Stock', href: '/sucursal/alerts', icon: AlertTriangle, badge: 'alerts' },
  { name: 'Reportes', href: '/sucursal/reportes', icon: BarChart3 },
  { name: 'Novedades', href: '/sucursal/novedades', icon: Megaphone },
  { name: 'Configuración', href: '/sucursal/configuracion', icon: Settings },
]

interface SucursalSidebarProps {
  className?: string
}

export function SucursalSidebar({ className }: SucursalSidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const sid = searchParams.get('sid')

  const [masOpcionesAbierto, setMasOpcionesAbierto] = useState(false)
  const [alertasCount] = useState(3) // TODO: Obtener dinámicamente
  const [transferenciasCount] = useState(0) // TODO: Obtener dinámicamente

  // Agregar sid a la URL si existe
  const getHrefWithSid = (href: string) => {
    if (sid && href !== '#') {
      return `${href}${href.includes('?') ? '&' : '?'}sid=${sid}`
    }
    return href
  }

  const getBadgeCount = (badgeType: string) => {
    switch (badgeType) {
      case 'alerts':
        return alertasCount
      case 'transferencias':
        return transferenciasCount
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

        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-6">
            {/* SECCIÓN 1: ACCIONES PRINCIPALES */}
            <div className="space-y-1">
              <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Acciones
              </p>
              {accionesPrincipales.map((item) => {
                const isActive = pathname === item.href
                const badgeCount = item.badge ? getBadgeCount(item.badge) : 0

                return (
                  <Link key={item.href} href={getHrefWithSid(item.href)}>
                    <Button
                      variant={item.highlight && !isActive ? 'default' : isActive ? 'secondary' : 'ghost'}
                      className={cn(
                        'w-full justify-start gap-3 h-12 px-3',
                        item.highlight && !isActive && 'bg-primary text-primary-foreground hover:bg-primary/90',
                        isActive && 'bg-secondary'
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      <div className="flex-1 text-left">
                        <span className="font-medium">{item.name}</span>
                      </div>
                      {badgeCount > 0 && (
                        <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-xs animate-pulse">
                          {badgeCount}
                        </Badge>
                      )}
                    </Button>
                  </Link>
                )
              })}
            </div>

            {/* SECCIÓN 2: CONSULTAS */}
            <div className="space-y-1">
              <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Consultas
              </p>
              {consultas.map((item) => {
                const isActive = pathname === item.href

                return (
                  <Link key={item.href} href={getHrefWithSid(item.href)}>
                    <Button
                      variant={isActive ? 'secondary' : 'ghost'}
                      className={cn(
                        'w-full justify-start gap-3 h-10 px-3',
                        isActive && 'bg-secondary'
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                      <span className="flex-1 text-left">{item.name}</span>
                    </Button>
                  </Link>
                )
              })}
            </div>

            {/* SECCIÓN 3: MÁS OPCIONES (colapsada) */}
            <div className="space-y-1">
              <Button
                variant="ghost"
                onClick={() => setMasOpcionesAbierto(!masOpcionesAbierto)}
                className="w-full justify-between gap-3 h-10 px-3 text-muted-foreground"
              >
                <div className="flex items-center gap-3">
                  <MoreHorizontal className="w-4 h-4" />
                  <span className="text-sm">Más opciones</span>
                </div>
                <ChevronDown className={cn(
                  "w-4 h-4 transition-transform duration-200",
                  masOpcionesAbierto && "rotate-180"
                )} />
              </Button>

              {masOpcionesAbierto && (
                <div className="ml-4 pl-4 border-l border-border space-y-1 pt-1">
                  {masOpciones.map((item) => {
                    const isActive = pathname === item.href
                    const badgeCount = item.badge ? getBadgeCount(item.badge) : 0

                    return (
                      <Link key={item.href} href={getHrefWithSid(item.href)}>
                        <Button
                          variant={isActive ? 'secondary' : 'ghost'}
                          size="sm"
                          className={cn(
                            'w-full justify-start gap-3 h-8 px-3',
                            isActive && 'bg-secondary'
                          )}
                        >
                          <item.icon className="w-3 h-3" />
                          <span className="flex-1 text-left text-sm">{item.name}</span>
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
          </nav>
        </ScrollArea>

        {/* Footer simplificado */}
        <div className="border-t p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Panel Sucursal</p>
              <p className="text-xs text-muted-foreground">Versión simplificada</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
