import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/actions/auth.actions'
import { createClient } from '@/lib/supabase/server'
import { getSucursalUsuario } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  // Verificar si hay configuración de Supabase
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // Sin configuración, ir a login que mostrará el mensaje de error
    redirect('/login')
  }

  // Verificar si hay un usuario autenticado
  const user = await getCurrentUser()

  // Si hay usuario autenticado, redirigir según su rol y sucursal
  if (user) {
    const supabase = await createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    // Verificar si tiene sucursal asignada
    if (authUser) {
      const sucursalId = await getSucursalUsuario(supabase, authUser.id)
      if (sucursalId) {
        redirect('/sucursal/dashboard')
      }
    }

    // Si no tiene sucursal, redirigir según rol
    switch (user.rol) {
      case 'admin':
        redirect('/dashboard')
      case 'vendedor':
        redirect('/almacen/pedidos')
      case 'encargado_sucursal':
        redirect('/sucursal/dashboard')
      case 'repartidor':
        redirect('/home')
      case 'almacenista':
        redirect('/almacen/productos')
      default:
        redirect('/login')
    }
  }

  // Si no hay usuario autenticado, ir directamente al login
  redirect('/login')
}
