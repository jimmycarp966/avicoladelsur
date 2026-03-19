'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  Building2,
  DollarSign,
  FileText,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Sparkles,
  Truck,
  UserCheck,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Logo } from '@/components/ui/logo'
import { cn } from '@/lib/utils'
import type { Usuario } from '@/types/domain.types'

interface AdminSidebarProps {
  onClose?: () => void
  user: Usuario | null
}

interface NavigationChild {
  name: string
  href: string
  icon?: LucideIcon
}

interface NavigationItem {
  name: string
  href: string
  icon: LucideIcon
  roles: string[]
  badge?: string
  children?: NavigationChild[]
}

type SidebarBadges = {
  notificaciones_unread?: number
  sucursales_alerts?: number
  bot_mensajes_hoy?: number
}

const navigation: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['admin', 'vendedor', 'almacenista'],
  },
  {
    name: 'Notificaciones',
    href: '/notificaciones',
    icon: Bell,
    roles: ['admin', 'vendedor', 'almacenista', 'repartidor', 'tesorero'],
    badge: 'notificaciones_unread',
    children: [
      { name: 'Todas', href: '/notificaciones' },
      { name: 'Configuración', href: '/notificaciones/configuracion' },
    ],
  },
  {
    name: 'Almacén',
    href: '/almacen/presupuestos-dia',
    icon: Package,
    roles: ['admin', 'almacenista'],
    children: [
      { name: 'En Preparación', href: '/almacen/en-preparacion', icon: Bell },
      { name: 'Productos', href: '/almacen/productos' },
      { name: 'Lotes', href: '/almacen/lotes' },
      { name: 'Producción', href: '/almacen/produccion' },
      { name: 'Control de Stock', href: '/almacen/control-stock' },
      { name: 'Presupuestos del Día', href: '/almacen/presupuestos-dia' },
      { name: 'Pedidos', href: '/almacen/pedidos' },
      { name: 'Transferencias', href: '/sucursales/transferencias' },
      { name: 'Recepción', href: '/almacen/recepcion' },
      { name: 'Documentos IA', href: '/almacen/documentos' },
    ],
  },
  {
    name: 'Ventas',
    href: '/ventas/presupuestos',
    icon: ShoppingCart,
    roles: ['admin', 'vendedor'],
    children: [
      { name: 'Presupuestos', href: '/ventas/presupuestos' },
      { name: 'Clientes', href: '/ventas/clientes' },
      { name: 'Listas de Precios', href: '/ventas/listas-precios' },
      { name: 'Comprobantes', href: '/ventas/comprobantes' },
      { name: 'Reclamos', href: '/ventas/reclamos' },
      { name: 'Bot WhatsApp', href: '/admin/bot-chat' },
    ],
  },
  {
    name: 'Reparto',
    href: '/reparto/rutas',
    icon: Truck,
    roles: ['admin', 'vendedor', 'almacenista'],
    children: [
      { name: 'Rutas', href: '/reparto/rutas' },
      { name: 'Monitor GPS', href: '/reparto/monitor' },
      { name: 'Vehículos', href: '/reparto/vehiculos' },
    ],
  },
  {
    name: 'Tesorería',
    href: '/tesoreria',
    icon: DollarSign,
    roles: ['admin', 'tesorero'],
    children: [
      { name: 'Cajas', href: '/tesoreria/cajas' },
      { name: 'Movimientos', href: '/tesoreria/movimientos' },
      { name: 'Validar rutas', href: '/tesoreria/validar-rutas' },
      { name: 'Conciliación', href: '/tesoreria/conciliacion' },
      { name: 'Cuentas Corrientes', href: '/tesoreria/cuentas-corrientes' },
      { name: 'Proveedores', href: '/tesoreria/proveedores' },
      { name: 'Cierres de Caja', href: '/tesoreria/cierre-caja' },
      { name: 'Tesoro', href: '/tesoreria/tesoro' },
      { name: 'Gastos', href: '/tesoreria/gastos' },
      { name: 'Por Sucursal', href: '/tesoreria/por-sucursal' },
    ],
  },
  {
    name: 'IA',
    href: '/dashboard/predicciones',
    icon: Sparkles,
    roles: ['admin'],
    children: [
      { name: 'Predicciones', href: '/dashboard/predicciones' },
      { name: 'Capacidades IA', href: '/dashboard/ia-capacidades' },
      { name: 'Reportes IA', href: '/reportes/ia' },
      { name: 'Documentos IA', href: '/almacen/documentos' },
    ],
  },
  {
    name: 'Sucursales',
    href: '/sucursales',
    icon: Building2,
    roles: ['admin'],
    badge: 'sucursales_alerts',
    children: [
      { name: 'Gestión de Sucursales', href: '/sucursales' },
      { name: 'Dashboard Sucursal', href: '/sucursal/dashboard' },
      { name: 'Ventas (POS)', href: '/sucursal/ventas' },
      { name: 'Inventario', href: '/sucursal/inventario' },
      { name: 'Alertas de Stock', href: '/sucursal/alerts' },
      { name: 'Reportes', href: '/sucursal/reportes' },
    ],
  },
  {
    name: 'RRHH',
    href: '/rrhh/empleados',
    icon: UserCheck,
    roles: ['admin'],
    children: [
      { name: 'Empleados', href: '/rrhh/empleados' },
      { name: 'Mensajes', href: '/rrhh/mensajes' },
      { name: 'Horarios', href: '/rrhh/horarios' },
      { name: 'Liquidaciones', href: '/rrhh/liquidaciones' },
      { name: 'Adelantos', href: '/rrhh/adelantos' },
      { name: 'Licencias', href: '/rrhh/licencias' },
      { name: 'Evaluaciones', href: '/rrhh/evaluaciones' },
      { name: 'Novedades', href: '/rrhh/novedades' },
      { name: 'Reportes', href: '/rrhh/reportes' },
    ],
  },
  {
    name: 'Reportes',
    href: '/reportes',
    icon: FileText,
    roles: ['admin'],
    children: [
      { name: 'Ventas', href: '/reportes/ventas' },
      { name: 'Pedidos', href: '/reportes/pedidos' },
      { name: 'Stock', href: '/reportes/stock' },
      { name: 'Almacén', href: '/reportes/almacen' },
      { name: 'Reparto', href: '/reportes/reparto' },
      { name: 'Tesorería', href: '/reportes/tesoreria' },
      { name: 'Clientes', href: '/reportes/clientes' },
      { name: 'Empleados', href: '/reportes/empleados' },
      { name: 'Sucursales', href: '/reportes/sucursales' },
      { name: 'Métricas Bot', href: '/reportes/bot' },
    ],
    badge: 'bot_mensajes_hoy',
  },
]

function hasAccess(user: Usuario | null, requiredRoles: string[]): boolean {
  if (!user) return false
  return requiredRoles.includes(user.rol)
}

interface NavigationItemProps {
  item: NavigationItem
  pathname: string
  user: Usuario | null
  onClose?: () => void
  badges: Record<string, number>
}

function NavigationItem({ item, pathname, user, onClose, badges }: NavigationItemProps) {
  const hasChildren = item.children && item.children.length > 0
  const hasActiveChild = Boolean(
    item.children?.some((child) => pathname === child.href || pathname.startsWith(child.href + '/')),
  )
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/') || hasActiveChild
  const canAccess = hasAccess(user, item.roles)
  const badgeCount = item.badge ? badges[item.badge] || 0 : 0

  if (!canAccess) return null

  const handleMainClick = () => {
    if (!hasChildren) onClose?.()
  }

  return (
    <div className="space-y-1">
      <Link
        href={item.href}
        onClick={handleMainClick}
        className={cn(
          'group relative flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
          isActive
            ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/20'
            : 'text-white/70 hover:bg-white/5 hover:text-white',
        )}
      >
        <div className="flex items-center gap-3">
          <item.icon
            className={cn(
              'h-5 w-5 shrink-0 transition-colors duration-200',
              isActive ? 'text-white' : 'text-white/50 group-hover:text-white/80',
            )}
          />
          <span>{item.name}</span>
        </div>

        {badgeCount > 0 && (
          <Badge
            variant="destructive"
            className="ml-2 flex h-5 items-center justify-center rounded-full px-1.5 text-xs font-bold animate-pulse"
          >
            {badgeCount}
          </Badge>
        )}
      </Link>

      {hasChildren && isActive && (
        <div className="animate-in slide-in-from-top-2 space-y-1 py-1 pl-10 pr-3 duration-200">
          {item.children!.map((child) => {
            const isChildActive = pathname === child.href || pathname.startsWith(child.href + '/')
            return (
              <Link
                key={child.name}
                href={child.href}
                onClick={() => onClose?.()}
                className={cn(
                  'relative flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-all duration-200',
                  isChildActive
                    ? 'font-medium text-[#FCDE8D]'
                    : 'text-white/60 hover:bg-white/5 hover:text-white',
                )}
              >
                {isChildActive && (
                  <div className="absolute left-0 top-1/2 -ml-6 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#FCDE8D]" />
                )}
                <span>{child.name}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function AdminSidebar({ onClose, user }: AdminSidebarProps) {
  const pathname = usePathname()
  const [badges, setBadges] = useState<Record<string, number>>({})

  useEffect(() => {
    const loadBadges = async () => {
      try {
        const response = await fetch('/api/admin/sidebar-badges', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const result = (await response.json()) as SidebarBadges
        setBadges({
          notificaciones_unread: result.notificaciones_unread || 0,
          sucursales_alerts: result.sucursales_alerts || 0,
          bot_mensajes_hoy: result.bot_mensajes_hoy || 0,
        })
      } catch (error) {
        console.error('[AdminSidebar] Error cargando badges:', error)
      }
    }

    loadBadges()
  }, [])

  return (
    <div className="relative flex h-full grow flex-col overflow-y-auto bg-gradient-sidebar">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-4 sm:h-20 sm:px-6">
        <div className="flex items-center gap-3">
          <Logo size="lg" variant="full" light />
        </div>

        {onClose && (
          <button
            type="button"
            className="rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
            onClick={onClose}
          >
            <X className="h-6 w-6" />
          </button>
        )}
      </div>

      <nav className="flex flex-1 flex-col px-3 py-4 sm:px-4 sm:py-6">
        <ul role="list" className="flex flex-1 flex-col space-y-2">
          <li>
            <ul role="list" className="space-y-1">
              {navigation.map((item) => (
                <li key={item.name}>
                  <NavigationItem
                    item={item}
                    pathname={pathname}
                    user={user}
                    onClose={onClose}
                    badges={badges}
                  />
                </li>
              ))}
            </ul>
          </li>
        </ul>
      </nav>

      {user && (
        <div className="mt-auto border-t border-white/10 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/30">
              <span className="text-sm font-semibold text-white">
                {user.nombre?.charAt(0).toUpperCase()}
                {user.apellido?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {user.nombre} {user.apellido}
              </p>
              <p className="mt-0.5 text-xs capitalize text-white/60">{user.rol}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
