'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUserStore } from '@/store/userStore'
import { useNotificationStore } from '@/store/notificationStore'
import type { Usuario } from '@/types/domain.types'

interface AuthContextType {
  user: Usuario | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const { user, setUser, setSession, logout: storeLogout } = useUserStore()
  const { showToast } = useNotificationStore()

  const supabase = createClient()

  // Función para obtener datos del usuario desde la base de datos
  const fetchUserData = async (userId: string): Promise<Usuario | null> => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', userId)
        .single()

      if (error || !data.activo) {
        console.error('Error fetching user data:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error fetching user data:', error)
      return null
    }
  }

  // Función para refrescar datos del usuario
  const refreshUser = async () => {
    try {
      const { data: { user: authUser }, error } = await supabase.auth.getUser()

      if (error || !authUser) {
        setUser(null)
        setSession(null)
        setLoading(false)
        return
      }

      const userData = await fetchUserData(authUser.id)

      if (!userData) {
        // Usuario no encontrado o inactivo
        await supabase.auth.signOut()
        setUser(null)
        setSession(null)
        showToast('error', 'Usuario no encontrado o inactivo')
      } else {
        setUser(userData)
        setSession(authUser)
      }
    } catch (error) {
      console.error('Error refreshing user:', error)
      setUser(null)
      setSession(null)
    } finally {
      setLoading(false)
    }
  }

  // Función de login
  const login = async (email: string, password: string) => {
    try {
      setLoading(true)

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      if (data.user) {
        const userData = await fetchUserData(data.user.id)

        if (!userData) {
          await supabase.auth.signOut()
          throw new Error('Usuario no encontrado en el sistema')
        }

        if (!userData.activo) {
          await supabase.auth.signOut()
          throw new Error('Usuario inactivo. Contacte al administrador.')
        }

        setUser(userData)
        setSession(data.user)

        // Redirigir según rol
        let redirectTo = '/'
        switch (userData.rol) {
          case 'admin':
            redirectTo = '/dashboard'
            break
          case 'vendedor':
            redirectTo = '/ventas/pedidos'
            break
          case 'repartidor':
            redirectTo = '/home'
            break
          case 'almacenista':
            redirectTo = '/almacen/productos'
            break
        }

        showToast('success', `Bienvenido ${userData.nombre}`)
        router.push(redirectTo)
      }
    } catch (error: any) {
      console.error('Login error:', error)
      showToast('error', error.message || 'Error en el inicio de sesión')
      throw error
    } finally {
      setLoading(false)
    }
  }

  // Función de logout
  const logout = async () => {
    try {
      setLoading(true)
      await supabase.auth.signOut()
      storeLogout()
      showToast('info', 'Sesión cerrada exitosamente')
      router.push('/login')
    } catch (error: any) {
      console.error('Logout error:', error)
      showToast('error', 'Error al cerrar sesión')
    } finally {
      setLoading(false)
    }
  }

  // Escuchar cambios en el estado de autenticación
  useEffect(() => {
    // Obtener sesión inicial
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Error getting session:', error)
          setLoading(false)
          return
        }

        if (session?.user) {
          const userData = await fetchUserData(session.user.id)
          if (userData) {
            setUser(userData)
            setSession(session.user)
          } else {
            // Usuario no válido
            await supabase.auth.signOut()
          }
        }
      } catch (error) {
        console.error('Error getting initial session:', error)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Escuchar cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email)

        if (event === 'SIGNED_IN' && session?.user) {
          const userData = await fetchUserData(session.user.id)
          if (userData) {
            setUser(userData)
            setSession(session.user)
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setSession(null)
        }

        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase.auth])

  // Efecto para verificar usuario activo periódicamente
  useEffect(() => {
    if (!user) return

    const interval = setInterval(async () => {
      const currentUserData = await fetchUserData(user.id)
      if (!currentUserData || !currentUserData.activo) {
        // Usuario desactivado, cerrar sesión
        await logout()
      }
    }, 30000) // Verificar cada 30 segundos

    return () => clearInterval(interval)
  }, [user])

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    refreshUser,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
