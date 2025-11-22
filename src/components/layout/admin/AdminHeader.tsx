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
    <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-white/10 bg-gradient-header px-6 shadow-sm">
      {/* Botón menú móvil */}
      <button
        type="button"
        className="-m-2.5 p-2.5 text-white hover:bg-white/10 rounded-lg transition-colors lg:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Logo - visible en desktop */}
      <div className="hidden lg:flex items-center gap-3">
        <Logo size="md" variant="full" light />
        {user && (
          <Badge className="bg-[#FCDE8D] text-[#2F7058] border-0 text-xs font-semibold px-2.5 py-0.5">
            {user.rol.charAt(0).toUpperCase() + user.rol.slice(1)}
          </Badge>
        )}
      </div>

      {/* Espaciador */}
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div className="flex flex-1"></div>

        {/* Panel derecho */}
        <div className="flex items-center gap-x-3">
          {/* Notificaciones */}
          <Button variant="ghost" size="sm" className="relative text-white hover:bg-white/10 h-9 w-9 p-0">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-[#CB3433] text-xs text-white flex items-center justify-center font-semibold shadow-lg">
              3
            </span>
          </Button>

          {/* Menú de usuario */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 hover:bg-white/10" suppressHydrationWarning>
                <Avatar className="h-9 w-9 ring-2 ring-[#FCDE8D] transition-all">
                  <AvatarFallback className="bg-white/20 text-white font-semibold">
                    {user?.nombre?.charAt(0).toUpperCase()}
                    {user?.apellido?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
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
