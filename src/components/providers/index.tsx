'use client'

import { ReactNode } from 'react'
import { AuthProvider } from './AuthProvider'
import { WebMCPProvider } from './WebMCPProvider'
import { ServiceWorkerRegistration } from './ServiceWorkerRegistration'
import { Toaster } from '@/components/ui/sonner'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider>
      <WebMCPProvider />
      <ServiceWorkerRegistration />
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
        }}
      />
    </AuthProvider>
  )
}
