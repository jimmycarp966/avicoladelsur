'use client'

import { createClient } from '@/lib/supabase/client'
import { useUserStore } from '@/store/userStore'

/**
 * Logout centralizado para todos los roles y layouts.
 */
export async function performLogout(options?: { reason?: string; redirectTo?: string }) {
  const timestamp = new Date().toISOString()
  const reason = options?.reason || 'Manual'
  const redirectTo = options?.redirectTo || '/login'

  console.log(`[LOGOUT ${timestamp}] Inicio`, { reason })

  try {
    const supabase = createClient()

    // Evita quedarse "colgado" si signOut demora o falla intermitentemente.
    await Promise.race([
      supabase.auth.signOut(),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ])

    useUserStore.getState().logout()

    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.includes('user') || key.includes('auth') || key.includes('session'))) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key))
      sessionStorage.clear()
    }
  } catch (error) {
    console.error(`[LOGOUT ${timestamp}] Error`, error)
  }

  setTimeout(() => {
    window.location.replace(redirectTo)
  }, 100)

  // Fallback defensivo para navegadores/casos donde replace no dispare.
  setTimeout(() => {
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = redirectTo
    }
  }, 1500)
}

export function useLogout() {
  const handleLogout = async (reason?: string) => {
    await performLogout({ reason })
  }

  return { logout: handleLogout }
}

