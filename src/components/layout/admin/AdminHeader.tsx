'use client'

import { useAuth } from '@/components/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Logo } from '@/components/ui/logo'
import { Menu, Bell, LogOut, Settings, User } from 'lucide-react'
import type { Usuario } from '@/types/domain.types'

interface AdminHeaderProps {
  user: Usuario | null
  onMenuClick: () => void
}

export function AdminHeader({ user, onMenuClick }: AdminHeaderProps) {
  const { logout } = useAuth()

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
    }
  }

  return (
    <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-gradient-header px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      {/* Botón menú móvil */}
      <button
        type="button"
        className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Logo - visible en desktop */}
      <div className="hidden lg:flex items-center gap-3">
        <Logo size="md" variant="full" />
        {user && (
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs font-medium" suppressHydrationWarning>
            <div className="w-1.5 h-1.5 bg-primary rounded-full mr-1.5 animate-pulse" suppressHydrationWarning></div>
            {user.rol.charAt(0).toUpperCase() + user.rol.slice(1)}
          </Badge>
        )}
      </div>

      {/* Espaciador */}
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div className="flex flex-1"></div>

        {/* Panel derecho */}
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          {/* Notificaciones */}
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-accent text-xs text-white flex items-center justify-center">
              3
            </span>
          </Button>

          {/* Menú de usuario */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8 ring-2 ring-primary/20 ring-offset-2 hover:ring-primary/40 transition-all">
                  <AvatarFallback className="bg-primary/10 text-primary">
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
                    {user?.email}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground capitalize">
                    {user?.rol}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Configuración</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar Sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
