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
  // SECCIÓN 1: ACCIONES PRINCIPALES (Para sucursales)
  {
    category: 'Acciones Principales',
    items: [
      {
        name: 'Vender',
        href: '/sucursal/ventas',
        icon: ShoppingCart,
        roles: ['vendedor', 'encargado_sucursal', 'admin'],
        highlight: true
      },
      {
        name: 'Recibir Mercadería',
        href: '/sucursal/transferencias',
        icon: Truck,
        roles: ['vendedor', 'encargado_sucursal', 'admin'],
      },
      {
        name: 'Ver Stock',
        href: '/sucursal/inventario',
        icon: Package,
        roles: ['vendedor', 'encargado_sucursal', 'admin'],
      },
    ]
  },
  // SECCIÓN 2: CONSULTAS
  {
    category: 'Consultas',
    items: [
      {
        name: 'Dashboard',
        href: '/sucursal/dashboard',
        icon: LayoutDashboard,
        roles: ['vendedor', 'encargado_sucursal', 'admin'],
      },
      {
        name: 'Caja y Tesorería',
        href: '/sucursal/tesoreria',
        icon: DollarSign,
        roles: ['vendedor', 'encargado_sucursal', 'admin'],
      },
      {
        name: 'Alertas',
        href: '/sucursal/alerts',
        icon: Bell,
        roles: ['vendedor', 'encargado_sucursal', 'admin'],
        badge: 'sucursales_alerts'
      },
    ]
  },
  // SECCIÓN 3: MÁS OPCIONES (Colapsada por defecto para no marear)
  {
    category: 'Más Opciones',
    collapsible: true,
    items: [
      {
        name: 'Reportes',
        href: '/sucursal/reportes',
        icon: FileText,
        roles: ['vendedor', 'encargado_sucursal', 'admin'],
      },
      {
        name: 'Novedades',
        href: '/sucursal/novedades',
        icon: MessageSquare,
        roles: ['vendedor', 'encargado_sucursal', 'admin'],
      },
      {
        name: 'Configuración',
        href: '/sucursal/configuracion',
        icon: Settings,
        roles: ['vendedor', 'encargado_sucursal', 'admin'],
      },
    ]
  },
  // SECCIONES DE ADMIN (Solo visibles para admin)
  {
    category: 'Panel de Control (Admin)',
    roles: ['admin'],
    items: [
      {
        name: 'Almacén Central',
        href: '/almacen',
        icon: Building2,
        roles: ['admin', 'almacenista'],
      },
      {
        name: 'Reparto / Logística',
        href: '/reparto',
        icon: Truck,
        roles: ['admin'],
      },
      {
        name: 'RRHH',
        href: '/rrhh',
        icon: UserCheck,
        roles: ['admin'],
      },
      {
        name: 'IA y Analítica',
        href: '/dashboard/predicciones',
        icon: Sparkles,
        roles: ['admin'],
      },
    ]
  }
]

function hasAccess(user: Usuario | null, requiredRoles: string[]): boolean {
  if (!user) return false
  return requiredRoles.includes(user.rol)
}

interface NavigationItemProps {
  item: {
    name: string
    href: string
    icon: any
    roles: string[]
    badge?: string
    highlight?: boolean
  }
  pathname: string
  user: Usuario | null
  onClose?: () => void
  badges: { [key: string]: number }
}

function NavigationItem({ item, pathname, user, onClose, badges }: NavigationItemProps) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
  const canAccess = hasAccess(user, item.roles)
  const badgeCount = item.badge ? badges[item.badge] || 0 : 0

  if (!canAccess) return null

  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={cn(
        'group relative flex items-center rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200',
        isActive
          ? 'bg-[#FCDE8D] text-[#2F7058] shadow-md'
          : 'text-white hover:bg-white/10 hover:text-white',
        item.highlight && !isActive && 'bg-green-600/20 border border-green-500/30'
      )}
    >
      {/* Barra lateral amarillo/crema para item activo */}
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#FCDE8D] rounded-r-full"></div>
      )}
      <item.icon
        className={cn(
          'mr-3 h-5 w-5 flex-shrink-0 transition-all duration-200',
          isActive ? 'text-[#2F7058]' : 'text-white/80 group-hover:text-white',
          item.highlight && !isActive && 'text-green-400'
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
      <nav className="flex flex-1 flex-col px-4 py-6 overflow-y-auto">
        <ul role="list" className="flex flex-1 flex-col space-y-6">
          {navigation.map((group) => {
            // Filtrar acceso por grupo si tiene roles requeridos
            if (group.roles && !hasAccess(user, group.roles)) return null

            return (
              <li key={group.category} className="space-y-2">
                <div className="px-4 text-xs font-semibold text-white/40 uppercase tracking-wider">
                  {group.category}
                </div>
                <ul role="list" className="space-y-1">
                  {group.items.map((item) => (
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
            )
          })}
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
