'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  MapPin,
  Truck,
  CheckSquare,
  User,
  Home
} from 'lucide-react'

interface RepartidorBottomNavProps {
  currentTab: string
  onTabChange: (tab: string) => void
}

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
    name: 'Ruta',
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

export function RepartidorBottomNav({ currentTab, onTabChange }: RepartidorBottomNavProps) {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-2 safe-area-inset-bottom">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => onTabChange(item.id)}
              className={cn(
                'flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-colors min-w-0 flex-1',
                isActive
                  ? 'bg-green-50 text-green-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              )}
            >
              <item.icon
                className={cn(
                  'h-5 w-5 mb-1',
                  isActive ? 'text-green-600' : 'text-gray-400'
                )}
              />
              <span className="text-xs font-medium truncate">
                {item.name}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
