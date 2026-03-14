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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <RepartidorHeader user={user} />

      {/* Main content */}
      <main className="flex-1 pb-16">
        {children}
      </main>

      {/* Bottom navigation */}
      <RepartidorBottomNav />
    </div>
  )
}
