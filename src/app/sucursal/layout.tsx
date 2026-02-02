'use client'

import { Suspense, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { SucursalSidebar } from '@/components/layout/SucursalSidebar'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Menu, Loader2 } from 'lucide-react'
import { LogoutButton } from '@/components/auth/LogoutButton'

// Fallback para el sidebar mientras carga
function SidebarSkeleton() {
  return (
    <div className="flex h-full w-full flex-col bg-card border-r p-4">
      <div className="flex items-center gap-2 mb-6">
        <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
        <div className="h-6 w-32 rounded bg-muted animate-pulse" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  )
}

interface SucursalLayoutProps {
  children: React.ReactNode
}

export default function SucursalLayout({ children }: SucursalLayoutProps) {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  // Evitar problemas de hidratación renderizando componentes con Radix UI solo en el cliente
  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col">
        <Suspense fallback={<SidebarSkeleton />}>
          <SucursalSidebar />
        </Suspense>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b bg-background px-4 lg:px-6">
          {/* Mobile Menu */}
          {mounted ? (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <Suspense fallback={<SidebarSkeleton />}>
                  <SucursalSidebar />
                </Suspense>
              </SheetContent>
            </Sheet>
          ) : (
            <Button variant="ghost" size="icon" className="lg:hidden" disabled>
              <Menu className="h-6 w-6" />
            </Button>
          )}

          {/* Title */}
          <div className="flex-1">
            <h1 className="text-lg font-semibold lg:text-xl">
              Panel de Sucursal
            </h1>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {mounted && <NotificationBell />}
            <LogoutButton variant="icon" className="text-muted-foreground hover:text-foreground" />
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
