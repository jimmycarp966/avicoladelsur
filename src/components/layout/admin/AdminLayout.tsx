'use client'

import { useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { AdminSidebar } from './AdminSidebar'
import { AdminHeader } from './AdminHeader'
import { cn } from '@/lib/utils'

interface AdminLayoutProps {
  children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar para desktop */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <AdminSidebar />
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
          <AdminSidebar onClose={() => setSidebarOpen(false)} />
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72">
        <AdminHeader
          user={user}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="py-10">
          <div className="px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
