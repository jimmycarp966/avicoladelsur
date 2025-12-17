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

  // Función helper para logs de sesión
  const logSessionInfo = (context: string, session: any, additionalInfo?: any) => {
    const timestamp = new Date().toISOString()
    const sessionInfo = session ? {
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'N/A',
      expiresIn: session.expires_at ? Math.round((session.expires_at * 1000 - Date.now()) / 1000 / 60) + ' minutos' : 'N/A',
      tokenType: session.token_type || 'N/A',
      hasAccessToken: !!session.access_token,
      hasRefreshToken: !!session.refresh_token,
      userId: session.user?.id || 'N/A',
      userEmail: session.user?.email || 'N/A',
    } : null

    console.log(`[AUTH LOG ${timestamp}] ${context}`, {
      sessionInfo,
      ...additionalInfo,
    })
  }

  // Función para obtener datos del usuario desde la base de datos
  const fetchUserData = async (userId: string): Promise<Usuario | null> => {
    try {
      // Verificar primero que haya una sesión activa antes de consultar BD
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.warn(`[AUTH LOG ${new Date().toISOString()}] No hay sesión activa al intentar obtener datos del usuario:`, {
          userId,
          reason: 'Sesión ya cerrada',
        })
        return null
      }

      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error(`[AUTH LOG ${new Date().toISOString()}] Error fetching user data:`, {
          userId,
          error: error.message || 'Error desconocido',
          code: error.code || 'N/A',
          details: error.details || 'N/A',
          hint: error.hint || 'N/A',
          fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        })
        return null
      }

      if (!data) {
        console.error(`[AUTH LOG ${new Date().toISOString()}] User data not found:`, {
          userId,
          reason: 'No se encontró registro en tabla usuarios',
        })
        return null
      }

      if (!data.activo) {
        console.error(`[AUTH LOG ${new Date().toISOString()}] User is inactive:`, {
          userId,
          email: data.email,
          nombre: data.nombre,
          rol: data.rol,
          activo: data.activo,
          reason: 'Usuario marcado como inactivo en la base de datos',
        })
        return null
      }

      return data
    } catch (error) {
      console.error(`[AUTH LOG ${new Date().toISOString()}] Exception fetching user data:`, {
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name || typeof error,
        fullError: error instanceof Error ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : String(error),
      })
      return null
    }
  }

  // Función para refrescar datos del usuario
  const refreshUser = async () => {
    try {
      console.log(`[AUTH LOG ${new Date().toISOString()}] Refreshing user...`)

      const { data: { user: authUser }, error } = await supabase.auth.getUser()

      if (error || !authUser) {
        console.error(`[AUTH LOG ${new Date().toISOString()}] Error getting user on refresh:`, {
          error: error?.message || 'No user returned',
          code: error?.status || 'N/A',
          reason: 'No se pudo obtener el usuario autenticado',
        })
        setUser(null)
        setSession(null)
        setLoading(false)
        return
      }

      // Obtener sesión actual para verificar expiración
      const { data: { session } } = await supabase.auth.getSession()
      logSessionInfo('Refresh user - Sesión actual', session, {
        userId: authUser.id,
        userEmail: authUser.email,
      })

      const userData = await fetchUserData(authUser.id)

      if (!userData) {
        // Usuario no encontrado o inactivo
        console.warn(`[AUTH LOG ${new Date().toISOString()}] Cerrando sesión - Usuario no válido:`, {
          userId: authUser.id,
          userEmail: authUser.email,
          reason: 'Usuario no encontrado en BD o marcado como inactivo',
        })
        await supabase.auth.signOut()
        setUser(null)
        setSession(null)
        showToast('error', 'Usuario no encontrado o inactivo')
      } else {
        console.log(`[AUTH LOG ${new Date().toISOString()}] Usuario refrescado exitosamente:`, {
          userId: userData.id,
          nombre: userData.nombre,
          rol: userData.rol,
          activo: userData.activo,
        })
        setUser(userData)
        setSession(authUser)
      }
    } catch (error) {
      console.error(`[AUTH LOG ${new Date().toISOString()}] Exception refreshing user:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
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

      // Verificar si el usuario tiene sucursal asignada
      let redirectTo = '/'
      try {
        const { data: empleado, error: empleadoError } = await supabase
          .from('rrhh_empleados')
          .select('sucursal_id')
          .eq('usuario_id', data.user.id)
          .eq('activo', true)
          .maybeSingle()

        if (!empleadoError && empleado?.sucursal_id) {
          console.log('Usuario tiene sucursal asignada:', empleado.sucursal_id)
          redirectTo = '/sucursal/dashboard'
        } else {
          // Si no tiene sucursal, redirigir según rol
          switch (userData.rol) {
            case 'admin':
              redirectTo = '/dashboard'
              break
            case 'vendedor':
              redirectTo = '/almacen/pedidos'
              break
            case 'encargado_sucursal':
              redirectTo = '/sucursal/dashboard'
              break
            case 'repartidor':
              redirectTo = '/home'
              break
            case 'almacenista':
              redirectTo = '/almacen/productos'
              break
          }
        }
      } catch (error) {
        console.error('Error al verificar sucursal:', error)
        // En caso de error, usar redirección por defecto según rol
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
  const logout = async (reason?: string) => {
    try {
      const timestamp = new Date().toISOString()
      console.log(`[AUTH LOG ${timestamp}] Iniciando logout:`, {
        userId: user?.id || 'N/A',
        userEmail: user?.email || 'N/A',
        reason: reason || 'Logout manual',
        activo: user?.activo ?? 'N/A',
      })

      setLoading(true)
      await supabase.auth.signOut()
      storeLogout()

      console.log(`[AUTH LOG ${timestamp}] Logout completado exitosamente`)
      showToast('info', 'Sesión cerrada exitosamente')
      window.location.href = '/login'
    } catch (error: any) {
      console.error(`[AUTH LOG ${new Date().toISOString()}] Error en logout:`, {
        error: error?.message || String(error),
        reason: reason || 'Error desconocido',
      })
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
        console.log(`[AUTH LOG ${new Date().toISOString()}] Obteniendo sesión inicial...`)

        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.error(`[AUTH LOG ${new Date().toISOString()}] Error getting initial session:`, {
            error: error.message,
            code: error.status || 'N/A',
            reason: 'Error al obtener la sesión inicial',
          })
          setLoading(false)
          return
        }

        logSessionInfo('Sesión inicial obtenida', session)

        if (session?.user) {
          // Verificar si el token está expirado
          if (session.expires_at) {
            const expiresAt = new Date(session.expires_at * 1000)
            const now = new Date()
            const isExpired = expiresAt < now

            console.log(`[AUTH LOG ${new Date().toISOString()}] Estado del token:`, {
              expiresAt: expiresAt.toISOString(),
              now: now.toISOString(),
              isExpired,
              minutesUntilExpiry: isExpired ? 0 : Math.round((expiresAt.getTime() - now.getTime()) / 1000 / 60),
            })

            if (isExpired) {
              console.warn(`[AUTH LOG ${new Date().toISOString()}] Token expirado, intentando refrescar...`)
              // Intentar refrescar la sesión
              const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
              if (refreshError || !refreshedSession) {
                console.error(`[AUTH LOG ${new Date().toISOString()}] Error al refrescar sesión expirada:`, {
                  error: refreshError?.message || 'No se pudo refrescar',
                  reason: 'Token expirado y no se pudo refrescar',
                })
                await supabase.auth.signOut()
                setLoading(false)
                return
              }
              logSessionInfo('Sesión refrescada después de expiración', refreshedSession)
            }
          }

          const userData = await fetchUserData(session.user.id)
          if (userData) {
            console.log(`[AUTH LOG ${new Date().toISOString()}] Sesión inicial establecida:`, {
              userId: userData.id,
              nombre: userData.nombre,
              rol: userData.rol,
            })
            setUser(userData)
            setSession(session.user)
          } else {
            // Usuario no válido
            console.warn(`[AUTH LOG ${new Date().toISOString()}] Cerrando sesión inicial - Usuario no válido:`, {
              userId: session.user.id,
              reason: 'Usuario no encontrado o inactivo en BD',
            })
            await supabase.auth.signOut()
          }
        } else {
          console.log(`[AUTH LOG ${new Date().toISOString()}] No hay sesión inicial`)
        }
      } catch (error) {
        console.error(`[AUTH LOG ${new Date().toISOString()}] Exception getting initial session:`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        })
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Escuchar cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const timestamp = new Date().toISOString()
        console.log(`[AUTH LOG ${timestamp}] Auth state changed:`, {
          event,
          userEmail: session?.user?.email || 'N/A',
          userId: session?.user?.id || 'N/A',
        })

        logSessionInfo(`Auth state change: ${event}`, session)

        if (event === 'SIGNED_IN' && session?.user) {
          console.log(`[AUTH LOG ${timestamp}] Usuario inició sesión`)
          const userData = await fetchUserData(session.user.id)
          if (userData) {
            setUser(userData)
            setSession(session.user)
          } else {
            console.warn(`[AUTH LOG ${timestamp}] Usuario inició sesión pero no es válido en BD`)
            await supabase.auth.signOut()
          }
        } else if (event === 'SIGNED_OUT') {
          console.log(`[AUTH LOG ${timestamp}] Usuario cerró sesión (evento SIGNED_OUT)`)
          setUser(null)
          setSession(null)
        } else if (event === 'TOKEN_REFRESHED') {
          console.log(`[AUTH LOG ${timestamp}] Token refrescado automáticamente`)
          logSessionInfo('Token refrescado', session)
          if (session?.user) {
            const userData = await fetchUserData(session.user.id)
            if (userData) {
              setUser(userData)
              setSession(session.user)
            }
          }
        } else if (event === 'USER_UPDATED') {
          console.log(`[AUTH LOG ${timestamp}] Usuario actualizado`)
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
    if (!user) {
      console.log(`[AUTH LOG ${new Date().toISOString()}] Verificación periódica no iniciada - No hay usuario`)
      return
    }

    const userId = user.id
    console.log(`[AUTH LOG ${new Date().toISOString()}] Iniciando verificación periódica de usuario:`, {
      userId,
      intervalo: '30 segundos',
    })

    const interval = setInterval(async () => {
      const timestamp = new Date().toISOString()

      // Verificar primero que el usuario todavía existe en el estado local
      // Esto evita ejecutar verificaciones si ya se cerró la sesión
      const currentUser = user
      if (!currentUser) {
        console.log(`[AUTH LOG ${timestamp}] Verificación periódica cancelada - Usuario ya no existe en estado local`)
        return
      }

      console.log(`[AUTH LOG ${timestamp}] Verificación periódica de usuario...`)

      // Verificar también el estado de la sesión
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        console.error(`[AUTH LOG ${timestamp}] Error al obtener sesión en verificación periódica:`, {
          error: sessionError.message,
          code: sessionError.status || 'N/A',
          reason: 'Error al verificar sesión',
        })
        await logout('Error al verificar sesión')
        return
      }

      if (!session) {
        console.warn(`[AUTH LOG ${timestamp}] No hay sesión activa en verificación periódica`)
        await logout('Sesión no encontrada')
        return
      }

      // Verificar que el usuario de la sesión coincida con el usuario local
      if (session.user?.id !== currentUser.id) {
        console.warn(`[AUTH LOG ${timestamp}] Usuario de sesión no coincide con usuario local:`, {
          sessionUserId: session.user?.id || 'N/A',
          localUserId: currentUser.id,
          reason: 'Usuario de sesión cambiado',
        })
        await logout('Usuario de sesión no coincide')
        return
      }

      // Verificar expiración del token
      if (session.expires_at) {
        const expiresAt = new Date(session.expires_at * 1000)
        const now = new Date()
        const minutesUntilExpiry = Math.round((expiresAt.getTime() - now.getTime()) / 1000 / 60)

        console.log(`[AUTH LOG ${timestamp}] Estado del token en verificación periódica:`, {
          expiresAt: expiresAt.toISOString(),
          minutesUntilExpiry,
          isExpired: expiresAt < now,
        })

        if (expiresAt < now) {
          console.warn(`[AUTH LOG ${timestamp}] Token expirado en verificación periódica`)
          await logout('Token expirado')
          return
        }
      }

      // Verificar datos del usuario en BD (solo si todavía tenemos usuario local)
      try {
        const currentUserData = await fetchUserData(currentUser.id)
        if (!currentUserData || !currentUserData.activo) {
          // Usuario desactivado, cerrar sesión
          console.warn(`[AUTH LOG ${timestamp}] Usuario desactivado o no encontrado en verificación periódica:`, {
            userId: currentUser.id,
            encontrado: !!currentUserData,
            activo: currentUserData?.activo ?? false,
            reason: 'Usuario desactivado en BD o no encontrado',
          })
          await logout('Usuario desactivado o no encontrado')
        } else {
          console.log(`[AUTH LOG ${timestamp}] Verificación periódica OK:`, {
            userId: currentUserData.id,
            activo: currentUserData.activo,
          })
        }
      } catch (error) {
        // Si hay un error al obtener datos del usuario, no cerrar sesión automáticamente
        // Solo loguear el error para diagnóstico
        console.error(`[AUTH LOG ${timestamp}] Error en verificación periódica (no se cierra sesión):`, {
          userId: currentUser.id,
          error: error instanceof Error ? error.message : String(error),
          reason: 'Error al consultar BD, pero sesión sigue activa',
        })
      }
    }, 30000) // Verificar cada 30 segundos

    return () => {
      console.log(`[AUTH LOG ${new Date().toISOString()}] Deteniendo verificación periódica de usuario:`, {
        userId: userId || 'N/A',
      })
      clearInterval(interval)
    }
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
