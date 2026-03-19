'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CheckSquare, Home, MapPin, Truck, User } from 'lucide-react'

import { cn } from '@/lib/utils'

const navigation = [
  {
    name: 'Inicio',
    href: '/home',
    icon: Home,
    id: 'inicio',
  },
  {
    name: 'Check-in',
    href: '/checkin',
    icon: CheckSquare,
    id: 'checkin',
  },
  {
    name: 'Ruta diaria',
    href: '/ruta-diaria',
    icon: MapPin,
    id: 'ruta',
  },
  {
    name: 'Entregas',
    href: '/entregas',
    icon: Truck,
    id: 'entregas',
  },
  {
    name: 'Perfil',
    href: '/perfil',
    icon: User,
    id: 'perfil',
  },
]

export function RepartidorBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white px-2 py-2 safe-area-inset-bottom">
      <div className="mx-auto flex max-w-md items-center justify-around gap-1">
        {navigation.map((item) => {
          const isRutaPath = pathname.startsWith('/ruta/')
          const isActive =
            item.id === 'ruta'
              ? pathname === '/ruta-diaria' || isRutaPath
              : pathname === item.href || pathname.startsWith(item.href + '/')

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center justify-center rounded-lg px-2 py-2 transition-colors',
                isActive
                  ? 'bg-green-50 text-green-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              )}
            >
              <item.icon
                className={cn('mb-1 h-5 w-5', isActive ? 'text-green-600' : 'text-gray-400')}
              />
              <span className="truncate text-xs font-medium">{item.name}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
