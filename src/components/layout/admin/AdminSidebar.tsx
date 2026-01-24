'use client'

import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/ui/logo'
import { Badge } from '@/components/ui/badge'
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
  UserCheck,
  Tag,
  Receipt,
  Building2,
  Sparkles,
  Brain,
  FileSearch,
  Bell,
  MessageSquare,
} from 'lucide-react'
import type { Usuario } from '@/types/domain.types'

interface AdminSidebarProps {
  onClose?: () => void
  user: Usuario | null
}

// Función para obtener badges dinámicos - versión cliente
async function getBadges(): Promise<{ [key: string]: number }> {
  // En producción, esto debería venir de una API route
  // Por ahora, solo traemos mensajes de hoy del bot
  try {
    const { obtenerMensajesHoyAction } = await import('@/actions/bot-mensajes.actions')
    const result = await obtenerMensajesHoyAction()
    return {
      bot_mensajes_hoy: result.data || 0
    }
  } catch {
    return {}
  }
}

const navigation = [
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
    href: '/almacen',
    icon: Package,
    roles: ['admin', 'almacenista'],
    children: [
      { name: 'Productos', href: '/almacen/productos' },
      { name: 'Lotes', href: '/almacen/lotes' },
      { name: 'Producción', href: '/almacen/produccion' },
      { name: 'Presupuestos del Día', href: '/almacen/presupuestos-dia' },
      { name: 'Pedidos', href: '/almacen/pedidos' },
      { name: 'Transferencias', href: '/sucursales/transferencias' },
      { name: 'Recepción', href: '/almacen/recepcion' },
      { name: 'Documentos IA', href: '/almacen/documentos' },
    ],
  },
  {
    name: 'Ventas',
    href: '/ventas',
    icon: ShoppingCart,
    roles: ['admin', 'vendedor'],
    children: [
      { name: 'Presupuestos', href: '/ventas/presupuestos' },
      { name: 'Clientes', href: '/ventas/clientes' },
      { name: 'Listas de Precios', href: '/ventas/listas-precios' },
      { name: 'Facturas', href: '/ventas/facturas' },
      { name: 'Reclamos', href: '/ventas/reclamos' },
      { name: 'Bot WhatsApp', href: '/admin/bot-chat' },
    ],
  },
  {
    name: 'Reparto',
    href: '/reparto',
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
      { name: 'Por Sucursal', href: '/tesoreria/sucursales' },
    ],
  },
  {
    name: 'IA',
    href: '/dashboard/predicciones',
    icon: Sparkles,
    roles: ['admin'],
    children: [
      { name: 'Predicciones', href: '/dashboard/predicciones' },
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
    href: '/rrhh',
    icon: UserCheck,
    roles: ['admin'],
    children: [
      { name: 'Empleados', href: '/rrhh/empleados' },
      { name: 'Mensajes', href: '/rrhh/mensajes' },
      { name: 'Asistencia', href: '/rrhh/asistencia' },
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
      { name: 'Métricas Bot', href: '/reportes/bot', badge: 'bot_mensajes_hoy' },
    ],
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
  badges: { [key: string]: number }
}

function NavigationItem({ item, pathname, user, onClose, badges }: NavigationItemProps) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
  const canAccess = hasAccess(user, item.roles)
  const badgeCount = item.badge ? badges[item.badge] || 0 : 0
  const hasChildren = item.children && item.children.length > 0

  if (!canAccess) return null

  // Solo cerrar menú si NO tiene hijos (es enlace final)
  const handleMainClick = (e: React.MouseEvent) => {
    if (hasChildren) {
      // Si tiene hijos, solo navegar pero no cerrar el menú móvil
      // El submenú se mostrará automáticamente por isActive
      return
    }
    // Si no tiene hijos, cerrar el menú
    onClose?.()
  }

  return (
    <div>
      <Link
        href={item.href}
        onClick={handleMainClick}
        className={cn(
          'group relative flex items-center rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200',
          isActive
            ? 'bg-[#FCDE8D] text-[#2F7058] shadow-md'
            : 'text-white hover:bg-white/10 hover:text-white'
        )}
      >
        {/* Barra lateral amarillo/crema para item activo */}
        {isActive && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#FCDE8D] rounded-r-full"></div>
        )}
        <item.icon
          className={cn(
            'mr-3 h-5 w-5 flex-shrink-0 transition-all duration-200',
            isActive ? 'text-[#2F7058]' : 'text-white/80 group-hover:text-white'
          )}
        />
        <span className={cn(isActive && 'font-semibold', 'flex-1')}>{item.name}</span>
        {badgeCount > 0 && (
          <Badge
            variant="destructive"
            className="ml-2 h-5 px-1.5 text-xs bg-red-500 hover:bg-red-600"
          >
            {badgeCount > 99 ? '99+' : badgeCount}
          </Badge>
        )}
      </Link>

      {/* Submenú */}
      {item.children && isActive && (
        <div className="mt-2 ml-4 space-y-1 border-l-2 border-white/20 pl-4 animate-in fade-in slide-in-from-top-2 duration-200">
          {item.children.map((child) => {
            const childIsActive = pathname === child.href
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onClose}
                className={cn(
                  'group relative flex items-center rounded-lg py-2 px-3 text-sm font-medium transition-all duration-200',
                  childIsActive
                    ? 'bg-white/15 text-white font-semibold'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                )}
              >
                {/* Punto amarillo/crema para submenu activo */}
                {childIsActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-[#FCDE8D] rounded-full -ml-6"></div>
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


export function AdminSidebar({ onClose, user }: AdminSidebarProps) {
  const pathname = usePathname()
  const [badges, setBadges] = useState<{ [key: string]: number }>({})

  useEffect(() => {
    const loadBadges = async () => {
      try {
        const { obtenerMensajesHoyAction } = await import('@/actions/bot-mensajes.actions')
        const result = await obtenerMensajesHoyAction()
        const botHoy = result.data || 0
        setBadges({
          notificaciones_unread: 0, // En producción esto vendrá de la API
          sucursales_alerts: 0, // En producción esto vendrá de la API
          bot_mensajes_hoy: botHoy,
        })
      } catch (error) {
        console.error('[AdminSidebar] Error cargando badges:', error)
      }
    }
    loadBadges()
  }, [])

  return (
    <div className="relative flex grow flex-col overflow-y-auto bg-gradient-sidebar">
      {/* Logo y título - Destacado */}
      <div className="flex h-20 shrink-0 items-center justify-between px-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Logo size="lg" variant="full" light />
        </div>

        {/* Botón cerrar (móvil) */}
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

      {/* Navegación */}
      <nav className="flex flex-1 flex-col px-4 py-6">
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

      {/* Información del usuario */}
      {user && (
        <div className="mt-auto border-t border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/30">
              <span className="text-sm font-semibold text-white">
                {user.nombre?.charAt(0).toUpperCase()}
                {user.apellido?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {user.nombre} {user.apellido}
              </p>
              <p className="text-xs text-white/60 capitalize mt-0.5">{user.rol}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
