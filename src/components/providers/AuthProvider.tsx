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
  const [configError, setConfigError] = useState<string | null>(null)
  const router = useRouter()

  const { user, setUser, setSession, logout: storeLogout } = useUserStore()
  const { showToast } = useNotificationStore()

  // Crear cliente con manejo de errores
  let supabase: ReturnType<typeof createClient>
  try {
    supabase = createClient()
  } catch (error: any) {
    setConfigError(error.message)
    setLoading(false)
    
    // Si hay error de configuración, mostrar mensaje
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-4">
        <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg border border-red-200 p-8">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <span className="text-2xl">⚠️</span>
              </div>
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-red-600 mb-2">
                Configuración Requerida
              </h1>
              <div className="prose prose-sm max-w-none">
                <pre className="bg-gray-50 p-4 rounded border overflow-x-auto text-xs">
                  {configError || 'Variables de entorno de Supabase no configuradas'}
                </pre>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <p className="font-semibold">Pasos para solucionar:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Crea un archivo <code className="bg-gray-100 px-1 rounded">.env.local</code> en la raíz del proyecto</li>
                  <li>Copia el contenido de <code className="bg-gray-100 px-1 rounded">env.example</code></li>
                  <li>Reemplaza los valores con tus credenciales reales de Supabase</li>
                  <li>Reinicia el servidor de desarrollo (<code className="bg-gray-100 px-1 rounded">npm run dev</code>)</li>
                </ol>
                <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                  <p className="font-semibold text-blue-900 mb-1">Obtén tus credenciales:</p>
                  <a
                    href="https://supabase.com/dashboard/project/_/settings/api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    https://supabase.com/dashboard/project/_/settings/api
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Función para obtener datos del usuario desde la base de datos
  const fetchUserData = async (userId: string): Promise<Usuario | null> => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching user data:', error)
        return null
      }

      if (!data) {
        console.error('User data not found for ID:', userId)
        return null
      }

      if (!data.activo) {
        console.error('User is inactive:', userId)
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
      console.log('Iniciando login para:', email)

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('Error en signInWithPassword:', error)
        throw error
      }

      if (!data.user) {
        console.error('No se obtuvo usuario de auth')
        throw new Error('Error en la autenticación')
      }

      console.log('Usuario autenticado, obteniendo datos del usuario...', data.user.id)
      const userData = await fetchUserData(data.user.id)

      if (!userData) {
        console.error('Usuario no encontrado en tabla usuarios, cerrando sesión...')
        await supabase.auth.signOut()
        throw new Error('Usuario no encontrado en el sistema. Verifica que el usuario esté sincronizado con Supabase Auth.')
      }

      if (!userData.activo) {
        console.error('Usuario inactivo, cerrando sesión...')
        await supabase.auth.signOut()
        throw new Error('Usuario inactivo. Contacte al administrador.')
      }

      console.log('Usuario encontrado, estableciendo sesión...', userData)
      setUser(userData)
      setSession(data.user)

      // Redirigir según rol
      let redirectTo = '/'
      switch (userData.rol) {
        case 'admin':
          redirectTo = '/dashboard'
          break
        case 'vendedor':
          redirectTo = '/almacen/pedidos'
          break
        case 'repartidor':
          redirectTo = '/home'
          break
        case 'almacenista':
          redirectTo = '/almacen/productos'
          break
      }

      console.log('Redirigiendo a:', redirectTo)
      showToast('success', `Bienvenido ${userData.nombre}`)
      
      // Asegurar que el loading se desactive antes de redirigir
      setLoading(false)
      
      // Usar setTimeout para dar tiempo a que se actualice el estado antes de redirigir
      setTimeout(() => {
        router.push(redirectTo)
        router.refresh()
      }, 100)
    } catch (error: any) {
      console.error('Login error completo:', error)
      const errorMessage = error.message || 'Error en el inicio de sesión'
      showToast('error', errorMessage)
      setLoading(false)
      throw error
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
      router.refresh()
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
