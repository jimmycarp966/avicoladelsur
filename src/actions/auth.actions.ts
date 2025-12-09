'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loginSchema, registerUserSchema, changePasswordSchema, resetPasswordSchema } from '@/lib/schemas/auth.schema'
import type { LoginFormData, RegisterUserFormData, ChangePasswordFormData, ResetPasswordFormData } from '@/lib/schemas/auth.schema'
import type { ApiResponse } from '@/types/api.types'
import { getSucursalUsuario } from '@/lib/utils'

// Login
export async function login(data: LoginFormData): Promise<ApiResponse<{ redirectTo: string }>> {
  try {
    const supabase = await createClient()

    // Validar datos
    const validatedData = loginSchema.parse(data)

    // Intentar login
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: validatedData.email,
      password: validatedData.password,
    })

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        return {
          success: false,
          error: 'Email o contraseña incorrectos',
        }
      }
      throw error
    }

    if (!authData.user) {
      return {
        success: false,
        error: 'Error en la autenticación',
      }
    }

    // Obtener datos del usuario de la tabla usuarios
    const { data: userData, error: userError } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', authData.user.id)
      .single()

    if (userError || !userData) {
      // Si no existe en la tabla usuarios, cerrar sesión
      await supabase.auth.signOut()
      return {
        success: false,
        error: 'Usuario no encontrado en el sistema',
      }
    }

    if (!userData.activo) {
      await supabase.auth.signOut()
      return {
        success: false,
        error: 'Usuario inactivo. Contacte al administrador.',
      }
    }

    // Verificar si el usuario tiene sucursal asignada
    const sucursalId = await getSucursalUsuario(supabase, authData.user.id)
    
    // Si tiene sucursal asignada, redirigir al dashboard de sucursal
    if (sucursalId) {
      return {
        success: true,
        data: { redirectTo: '/sucursal/dashboard' },
        message: `Bienvenido ${userData.nombre}`,
      }
    }

    // Si no tiene sucursal, redirigir según rol
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

    return {
      success: true,
      data: { redirectTo },
      message: `Bienvenido ${userData.nombre}`,
    }
  } catch (error: any) {
    console.error('Error en login:', error)
    return {
      success: false,
      error: error.message || 'Error en el inicio de sesión',
    }
  }
}

// Logout
export async function logout(): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch (error) {
    console.error('Error en logout:', error)
  }

  // Redirigir a login
  redirect('/login')
}

// Registrar nuevo usuario (solo admin)
export async function registerUser(data: RegisterUserFormData): Promise<ApiResponse<{ userId: string }>> {
  try {
    const supabase = await createClient()

    // Validar datos
    const validatedData = registerUserSchema.parse(data)

    // Verificar permisos (solo admin puede crear usuarios)
    const { data: currentUser, error: userError } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', (await supabase.auth.getUser()).data.user?.id)
      .single()

    if (userError || currentUser?.rol !== 'admin') {
      return {
        success: false,
        error: 'No tiene permisos para crear usuarios',
      }
    }

    // Crear usuario en auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: validatedData.email,
      password: validatedData.password,
      email_confirm: true, // Auto-confirmar email
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
        return {
          success: false,
          error: 'El email ya está registrado',
        }
      }
      throw authError
    }

    // Crear usuario en la tabla usuarios
    const { data: userData, error: userTableError } = await supabase
      .from('usuarios')
      .insert({
        id: authData.user.id,
        email: validatedData.email,
        nombre: validatedData.nombre,
        apellido: validatedData.apellido,
        telefono: validatedData.telefono,
        rol: validatedData.rol,
        vehiculo_asignado: validatedData.vehiculo_asignado,
        activo: true,
      })
      .select()
      .single()

    if (userTableError) throw userTableError

    revalidatePath('/dashboard')

    return {
      success: true,
      data: { userId: userData.id },
      message: 'Usuario creado exitosamente',
    }
  } catch (error: any) {
    console.error('Error al registrar usuario:', error)
    return {
      success: false,
      error: error.message || 'Error al crear usuario',
    }
  }
}

// Cambiar contraseña
export async function changePassword(data: ChangePasswordFormData): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    // Validar datos
    const validatedData = changePasswordSchema.parse(data)

    // Verificar contraseña actual
    const { data: user, error: userError } = await supabase.auth.getUser()
    if (userError || !user.user) {
      return {
        success: false,
        error: 'Usuario no autenticado',
      }
    }

    // Intentar login con contraseña actual para verificar
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: user.user.email!,
      password: validatedData.currentPassword,
    })

    if (loginError) {
      return {
        success: false,
        error: 'Contraseña actual incorrecta',
      }
    }

    // Actualizar contraseña
    const { error: updateError } = await supabase.auth.updateUser({
      password: validatedData.newPassword,
    })

    if (updateError) throw updateError

    return {
      success: true,
      message: 'Contraseña actualizada exitosamente',
    }
  } catch (error: any) {
    console.error('Error al cambiar contraseña:', error)
    return {
      success: false,
      error: error.message || 'Error al cambiar contraseña',
    }
  }
}

// Resetear contraseña (envía email)
export async function resetPassword(data: ResetPasswordFormData): Promise<ApiResponse> {
  try {
    const supabase = await createClient()

    // Validar datos
    const validatedData = resetPasswordSchema.parse(data)

    const { error } = await supabase.auth.resetPasswordForEmail(validatedData.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
    })

    if (error) throw error

    return {
      success: true,
      message: 'Se ha enviado un email para resetear la contraseña',
    }
  } catch (error: any) {
    console.error('Error al resetear contraseña:', error)
    return {
      success: false,
      error: error.message || 'Error al enviar email de reseteo',
    }
  }
}

// Obtener usuario actual
export async function getCurrentUser() {
  try {
    // Verificar si las variables de entorno están configuradas
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.warn('Variables de entorno de Supabase no configuradas')
      return null
    }

    const supabase = await createClient()

    const { data: authUser, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser.user) {
      return null
    }

    const { data: user, error: userError } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', authUser.user.id)
      .single()

    if (userError || !user.activo) {
      return null
    }

    return user
  } catch (error) {
    console.error('Error al obtener usuario actual:', error)
    return null
  }
}

// Verificar permisos de usuario
export async function hasRole(requiredRole: string | string[]): Promise<boolean> {
  try {
    const user = await getCurrentUser()
    if (!user) return false

    if (Array.isArray(requiredRole)) {
      return requiredRole.includes(user.rol)
    }

    return user.rol === requiredRole
  } catch (error) {
    console.error('Error al verificar permisos:', error)
    return false
  }
}
