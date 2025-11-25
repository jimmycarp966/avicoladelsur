import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/actions/auth.actions'
import { LoginForm } from '@/components/auth/LoginForm'
import { LoginBackground } from '@/components/auth/LoginBackground'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  // Verificar si hay configuración de Supabase
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return (
      <div 
        className="login-page min-h-screen flex items-center justify-center bg-primary py-12 px-4 sm:px-6 lg:px-8"
        style={{ backgroundColor: '#2F7058' }}
      >
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Configuración Requerida</h1>
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
              <h4 className="text-sm font-medium text-destructive mb-2">❌ Supabase no configurado</h4>
              <p className="text-xs text-destructive/90 mb-4">
                Para usar el sistema de autenticación, necesitas configurar Supabase primero.
              </p>
              <p className="text-xs text-destructive/80">
                Consulta el archivo <code className="bg-destructive/20 px-1 rounded">SUPABASE_SETUP.md</code> para las instrucciones detalladas.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Si ya hay un usuario autenticado, redirigir según su rol
  const user = await getCurrentUser()

  if (user) {
    switch (user.rol) {
      case 'admin':
        redirect('/dashboard')
      case 'vendedor':
        redirect('/almacen/pedidos')
      case 'repartidor':
        redirect('/home')
      case 'almacenista':
        redirect('/almacen/productos')
      default:
        redirect('/')
    }
  }

  return (
    <>
      <LoginBackground />
      <div 
        className="login-page min-h-screen flex items-center justify-center bg-primary py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden"
        style={{ backgroundColor: '#2F7058' }}
      >
        {/* Elementos decorativos sutiles de fondo */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -z-10"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl -z-10"></div>
        
        <div className="max-w-md w-full space-y-8 relative z-10">
          <LoginForm />
        </div>
      </div>
    </>
  )
}
