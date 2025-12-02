'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { SucursalSidebar } from '@/components/layout/SucursalSidebar'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Menu, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface SucursalLayoutProps {
  children: React.ReactNode
}

export default function SucursalLayout({ children }: SucursalLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
      toast.success('Sesión cerrada exitosamente')
    } catch (error) {
      toast.error('Error al cerrar sesión')
    }
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col">
        <SucursalSidebar />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b bg-background px-4 lg:px-6">
          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SucursalSidebar />
            </SheetContent>
          </Sheet>

          {/* Title */}
          <div className="flex-1">
            <h1 className="text-lg font-semibold lg:text-xl">
              Panel de Sucursal
            </h1>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
