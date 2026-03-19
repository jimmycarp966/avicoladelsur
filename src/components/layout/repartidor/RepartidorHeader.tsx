'use client'

import { useEffect, useState } from 'react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Logo } from '@/components/ui/logo'
import { LogoutButton } from '@/components/auth/LogoutButton'
import type { Usuario } from '@/types/domain.types'
import { Bell, Wifi, WifiOff } from 'lucide-react'

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
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-gradient-header px-3 py-3 sm:px-4">
      <div className="flex items-center justify-between">
        {/* Logo y título */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 sm:gap-3">
            <Logo size="md" variant="icon" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-semibold text-gray-900 sm:text-lg">
                  Repartidor
                </h1>
                <Badge
                  variant="secondary"
                  className="shrink-0 border-primary/20 bg-primary/10 text-xs font-medium text-primary"
                  suppressHydrationWarning
                >
                  <div
                    className="mr-1 h-1.5 w-1.5 rounded-full bg-primary animate-pulse"
                    suppressHydrationWarning
                  />
                  <span className="hidden sm:inline">Activo</span>
                  <span className="sm:hidden">On</span>
                </Badge>
              </div>
              <p className="hidden truncate text-xs text-gray-500 sm:block">Avícola del Sur</p>
            </div>
          </div>
        </div>

        {/* Panel derecho */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Estado de conexión */}
          <div className="hidden items-center gap-1 sm:flex">
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
          <Button variant="ghost" size="sm" className="relative p-2 sm:p-2.5">
            <Bell className="h-5 w-5" />
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-xs text-white">
              2
            </span>
          </Button>

          {/* Menú de usuario */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0 sm:h-9 sm:w-9">
                <Avatar className="h-8 w-8 ring-2 ring-primary/20 ring-offset-2 transition-all hover:ring-primary/40 sm:h-9 sm:w-9">
                  <AvatarFallback className="bg-primary/10 text-sm text-primary">
                    {user?.nombre?.charAt(0).toUpperCase()}
                    {user?.apellido?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {/* Indicador activo */}
                <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-primary" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user?.nombre} {user?.apellido}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">Repartidor</p>
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
