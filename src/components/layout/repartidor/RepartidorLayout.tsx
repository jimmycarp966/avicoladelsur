'use client'

import { useAuth } from '@/components/providers/AuthProvider'
import { RepartidorBottomNav } from './RepartidorBottomNav'
import { RepartidorHeader } from './RepartidorHeader'

interface RepartidorLayoutProps {
  children: React.ReactNode
}

export function RepartidorLayout({ children }: RepartidorLayoutProps) {
  const { user } = useAuth()

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Header */}
      <RepartidorHeader user={user} />

      {/* Main content */}
      <main className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))]">
        {children}
      </main>

      {/* Bottom navigation */}
      <RepartidorBottomNav />
    </div>
  )
}
