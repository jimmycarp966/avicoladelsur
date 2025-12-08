'use client'

import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Bell, Settings, LogOut, User } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUserStore } from '@/store/userStore'
import { useNotificationStore } from '@/store/notificationStore'

interface Sucursal {
  id: string
  nombre: string
  active: boolean
}

interface SucursalHeaderProps {
  sucursal: Sucursal
}

export function SucursalHeader({ sucursal }: SucursalHeaderProps) {
  const router = useRouter()
  const { logout: storeLogout } = useUserStore()
  const { showToast } = useNotificationStore()

  const handleLogout = async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      storeLogout()
      showToast('success', 'Sesión cerrada exitosamente')
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
      showToast('error', 'Error al cerrar sesión')
    }
  }
  return (
    <header className="fixed top-0 left-64 right-0 z-40 h-16 bg-background border-b">
      <div className="flex h-full items-center justify-between px-6">
        {/* Información de sucursal */}
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-lg font-semibold">{sucursal.nombre}</h1>
            <div className="flex items-center gap-2">
              <Badge variant={sucursal.active ? "default" : "secondary"}>
                {sucursal.active ? 'Activa' : 'Inactiva'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Acciones del header */}
        <div className="flex items-center gap-4">
          {/* Notificaciones */}
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="w-4 h-4" />
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              3
            </Badge>
          </Button>

          {/* Menú de usuario */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    <User className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">Usuario Sucursal</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    usuario@sucursal.com
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
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
    </header>
  )
}
