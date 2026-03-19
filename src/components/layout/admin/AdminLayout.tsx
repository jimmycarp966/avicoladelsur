'use client'

import { useState } from 'react'
import { AdminSidebar } from './AdminSidebar'
import { AdminHeader } from './AdminHeader'
import { PageTransition } from '@/components/ui/page-transition'
import { KeyboardShortcutsProvider } from '@/components/providers/KeyboardShortcutsProvider'
import { cn } from '@/lib/utils'
import type { Usuario } from '@/types/domain.types'

interface AdminLayoutProps {
  children: React.ReactNode
  user: Usuario | null
}

export function AdminLayout({ children, user }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <KeyboardShortcutsProvider>
      <div className="min-h-dvh bg-background">
        {/* Sidebar para desktop */}
        <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
          <AdminSidebar user={user} />
        </div>

        {/* Sidebar móvil */}
        <div
          className={cn(
            'fixed inset-0 z-50 lg:hidden',
            sidebarOpen ? 'block' : 'hidden'
          )}
        >
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />

          {/* Sidebar móvil */}
          <div className="fixed left-0 top-0 bottom-0 w-[min(18rem,calc(100vw-1rem))] bg-[#2F7058] shadow-lg">
            <AdminSidebar onClose={() => setSidebarOpen(false)} user={user} />
          </div>
        </div>

        {/* Main content */}
        <div className="lg:pl-72">
          <AdminHeader
            user={user}
            onMenuClick={() => setSidebarOpen(true)}
          />

          <main className="py-4 sm:py-6 lg:py-10 h-full">
            <div className="px-3 sm:px-4 md:px-6 lg:px-8 h-full">
              <PageTransition>
                {children}
              </PageTransition>
            </div>
          </main>
        </div>
      </div>
    </KeyboardShortcutsProvider>
  )
}
