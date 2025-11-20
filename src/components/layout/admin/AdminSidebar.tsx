'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/providers/AuthProvider'
import { Logo } from '@/components/ui/logo'
import { cn } from '@/lib/utils'
import { colors } from '@/lib/config'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Truck,
  FileText,
  DollarSign,
  Settings,
  X,
} from 'lucide-react'
import type { Usuario } from '@/types/domain.types'

interface AdminSidebarProps {
  onClose?: () => void
}

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['admin', 'vendedor', 'almacenista'],
  },
  {
    name: 'Almacén',
    href: '/almacen',
    icon: Package,
    roles: ['admin', 'almacenista'],
    children: [
      { name: 'Productos', href: '/almacen/productos' },
      { name: 'Lotes', href: '/almacen/lotes' },
      { name: 'Presupuestos del Día', href: '/almacen/presupuestos-dia' },
      { name: 'Recepción', href: '/almacen/recepcion' },
    ],
  },
  {
    name: 'Ventas',
    href: '/ventas',
    icon: ShoppingCart,
    roles: ['admin', 'vendedor'],
    children: [
      { name: 'Presupuestos', href: '/ventas/presupuestos' },
      { name: 'Pedidos', href: '/ventas/pedidos' },
      { name: 'Clientes', href: '/ventas/clientes' },
    ],
  },
  {
    name: 'Reparto',
    href: '/reparto',
    icon: Truck,
    roles: ['admin'],
    children: [
      { name: 'Rutas', href: '/reparto/rutas' },
      { name: 'Vehículos', href: '/reparto/vehiculos' },
    ],
  },
  {
    name: 'Tesorería',
    href: '/tesoreria',
    icon: DollarSign,
    roles: ['admin'],
    children: [
      { name: 'Cajas', href: '/tesoreria/cajas' },
      { name: 'Movimientos', href: '/tesoreria/movimientos' },
      { name: 'Cierres de Caja', href: '/tesoreria/cierre-caja' },
      { name: 'Tesoro', href: '/tesoreria/tesoro' },
      { name: 'Gastos', href: '/tesoreria/gastos' },
    ],
  },
  {
    name: 'Reportes',
    href: '/reportes',
    icon: FileText,
    roles: ['admin'],
  },
]

function hasAccess(user: Usuario | null, requiredRoles: string[]): boolean {
  if (!user) return false
  return requiredRoles.includes(user.rol)
}

interface NavigationItemProps {
  item: typeof navigation[0]
  pathname: string
  user: Usuario | null
  onClose?: () => void
}

function NavigationItem({ item, pathname, user, onClose }: NavigationItemProps) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
  const canAccess = hasAccess(user, item.roles)

  if (!canAccess) return null

  return (
    <div>
      <Link
        href={item.href}
        onClick={onClose}
        className={cn(
          'group relative flex items-center rounded-md px-3 py-2 text-sm font-medium transition-all duration-200',
          isActive
            ? 'bg-primary/10 text-primary shadow-sm'
            : 'text-gray-700 hover:bg-primary/5 hover:text-primary hover:translate-x-1'
        )}
      >
        {/* Indicador verde para item activo */}
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-primary rounded-r-full"></div>
        )}
        <item.icon
          className={cn(
            'mr-3 h-5 w-5 flex-shrink-0 transition-all duration-200',
            isActive ? 'text-primary scale-110' : 'text-gray-400 group-hover:text-primary group-hover:scale-105'
          )}
        />
        {item.name}
      </Link>

      {/* Submenú */}
      {item.children && isActive && (
        <div className="mt-1 space-y-1">
          {item.children.map((child) => {
            const childIsActive = pathname === child.href
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onClose}
                className={cn(
                  'group relative flex items-center rounded-md py-2 pl-9 pr-3 text-sm font-medium transition-all duration-200',
                  childIsActive
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-gray-600 hover:bg-primary/5 hover:text-primary hover:translate-x-1'
                )}
              >
                {/* Punto verde para submenu activo */}
                {childIsActive && (
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-primary rounded-full"></div>
                )}
                {child.name}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function AdminSidebar({ onClose }: AdminSidebarProps) {
  const pathname = usePathname()
  const { user } = useAuth()

  return (
    <div className="relative flex grow flex-col gap-y-5 overflow-y-auto bg-gradient-sidebar px-6 pb-4 shadow-sm border-r border-gray-200">
      {/* Barra de acento verde */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-secondary to-primary"></div>
      {/* Logo y título */}
      <div className="flex h-16 shrink-0 items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo size="lg" variant="full" />
        </div>

        {/* Botón cerrar (móvil) */}
        {onClose && (
          <button
            type="button"
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-500 lg:hidden"
            onClick={onClose}
          >
            <X className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Navegación */}
      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <ul role="list" className="-mx-2 space-y-1">
              {navigation.map((item) => (
                <li key={item.name}>
                  <NavigationItem
                    item={item}
                    pathname={pathname}
                    user={user}
                    onClose={onClose}
                  />
                </li>
              ))}
            </ul>
          </li>
        </ul>
      </nav>

      {/* Información del usuario */}
      {user && (
        <div className="mt-auto border-t border-gray-200 pt-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
              <span className="text-sm font-medium text-gray-600">
                {user.nombre?.charAt(0).toUpperCase()}
                {user.apellido?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user.nombre} {user.apellido}
              </p>
              <p className="text-xs text-gray-500 capitalize">{user.rol}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
