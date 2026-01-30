import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Usuario } from '@/types/domain.types'

export interface UserState {
  user: Usuario | null
  session: any | null
  loading: boolean
  setUser: (user: Usuario | null) => void
  setSession: (session: any) => void
  setLoading: (loading: boolean) => void
  logout: () => void
  isAuthenticated: () => boolean
  hasRole: (role: string) => boolean
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      loading: true,

      setUser: (user) => set({ user }),

      setSession: (session) => set({ session }),

      setLoading: (loading) => set({ loading }),

      logout: () => {
        // Limpiar estado
        set({ user: null, session: null, loading: false })

        // Limpiar localStorage manualmente para asegurar que no quede estado zombie
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('user-storage')
          } catch (e) {
            console.error('Error limpiando localStorage:', e)
          }
        }
      },

      isAuthenticated: () => {
        const { user, session } = get()
        return !!(user && session)
      },

      hasRole: (role) => {
        const { user } = get()
        return user?.rol === role
      },
    }),
    {
      name: 'user-storage',
      partialize: (state) => ({
        user: state.user,
        session: state.session,
      }),
    }
  )
)
