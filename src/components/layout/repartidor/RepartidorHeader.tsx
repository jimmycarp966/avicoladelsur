'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Logo } from '@/components/ui/logo'
import { Bell, Wifi, WifiOff } from 'lucide-react'
import { useState, useEffect } from 'react'
import { LogoutButton } from '@/components/auth/LogoutButton'
import type { Usuario } from '@/types/domain.types'

interface RepartidorHeaderProps {
  user: Usuario | null
}

export function RepartidorHeader({ user }: RepartidorHeaderProps) {
  const [isOnline, setIsOnline] = useState(true)

  // Detectar estado de conexión
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <header className="sticky top-0 z-40 bg-gradient-header border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Logo y título */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <Logo size="md" variant="icon" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-semibold text-gray-900 truncate">Repartidor</h1>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs font-medium shrink-0" suppressHydrationWarning>
                <div className="w-1.5 h-1.5 bg-primary rounded-full mr-1 animate-pulse" suppressHydrationWarning></div>
                <span className="hidden sm:inline">Activo</span>
                <span className="sm:hidden">On</span>
              </Badge>
            </div>
            <p className="text-xs text-gray-500 truncate">Avícola del Sur</p>
          </div>
        </div>

        {/* Panel derecho */}
        <div className="flex items-center gap-3">
          {/* Estado de conexión */}
          <div className="flex items-center gap-1">
            {isOnline ? (
              <Wifi className="h-4 w-4 text-success" />
            ) : (
              <WifiOff className="h-4 w-4 text-destructive" />
            )}
            <span className="text-xs text-gray-500">
              {isOnline ? 'En línea' : 'Sin conexión'}
            </span>
          </div>

          {/* Notificaciones */}
          <Button variant="ghost" size="sm" className="relative p-2">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-accent text-xs text-white flex items-center justify-center">
              2
            </span>
          </Button>

          {/* Menú de usuario */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
                <Avatar className="h-8 w-8 ring-2 ring-primary/20 ring-offset-2 hover:ring-primary/40 transition-all">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {user?.nombre?.charAt(0).toUpperCase()}
                    {user?.apellido?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {/* Indicador activo */}
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-primary rounded-full border-2 border-white"></div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user?.nombre} {user?.apellido}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    Repartidor
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <LogoutButton variant="menuItem" />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
