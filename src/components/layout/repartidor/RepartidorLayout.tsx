'use client'

import { useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { RepartidorBottomNav } from './RepartidorBottomNav'
import { RepartidorHeader } from './RepartidorHeader'

interface RepartidorLayoutProps {
  children: React.ReactNode
}

export function RepartidorLayout({ children }: RepartidorLayoutProps) {
  const [currentTab, setCurrentTab] = useState('ruta')
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <RepartidorHeader user={user} />

      {/* Main content */}
      <main className="flex-1 pb-16">
        {children}
      </main>

      {/* Bottom navigation */}
      <RepartidorBottomNav
        currentTab={currentTab}
        onTabChange={setCurrentTab}
      />
    </div>
  )
}
