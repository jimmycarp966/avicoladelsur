'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AdminSidebar } from './AdminSidebar'
import { AdminHeader } from './AdminHeader'
import { KeyboardShortcutsProvider } from '@/components/providers/KeyboardShortcutsProvider'
import { createClient } from '@/lib/supabase/client'
import { useUserStore } from '@/store/userStore'
import { useNotificationStore } from '@/store/notificationStore'
import { cn } from '@/lib/utils'
import type { Usuario } from '@/types/domain.types'

interface AdminLayoutProps {
  children: React.ReactNode
  user: Usuario | null // Usuario pasado desde Server Component
}

export function AdminLayout({ children, user }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()
  const { logout: storeLogout } = useUserStore()
  const { showToast } = useNotificationStore()

  // Función logout local que no depende del AuthProvider
  const handleLogout = async () => {
    console.log('[AdminLayout] Iniciando logout...')
    try {
      const supabase = createClient()
      console.log('[AdminLayout] SignOut de Supabase...')
      await supabase.auth.signOut()
      console.log('[AdminLayout] Store logout...')
      storeLogout()
      showToast('success', 'Sesión cerrada exitosamente')
    } catch (error) {
      console.error('[AdminLayout] Error al cerrar sesión:', error)
      showToast('error', 'Error al cerrar sesión')
    } finally {
      // Siempre redirigir al login, incluso si hay error
      console.log('[AdminLayout] Redirigiendo a /login...')
      window.location.href = '/login'
    }
  }

  return (
    <KeyboardShortcutsProvider>
      <div className="min-h-screen bg-background">
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
            className="fixed inset-0 bg-black/25"
            onClick={() => setSidebarOpen(false)}
          />

          {/* Sidebar móvil */}
          <div className="fixed left-0 top-0 bottom-0 w-72 bg-white shadow-lg">
            <AdminSidebar onClose={() => setSidebarOpen(false)} user={user} />
          </div>
        </div>

        {/* Main content */}
        <div className="lg:pl-72">
          <AdminHeader
            user={user}
            onMenuClick={() => setSidebarOpen(true)}
            onLogout={handleLogout}
          />

          <main className="py-10">
            <div className="px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </KeyboardShortcutsProvider>
  )
}
