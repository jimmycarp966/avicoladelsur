import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/actions/auth.actions'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { colors } from '@/lib/config'

export const dynamic = 'force-dynamic'

function renderWelcomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card className="w-full mx-auto">
          <CardHeader className="text-center">
            <div
              className="mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4"
              style={{ backgroundColor: colors.primary.green }}
            >
              <span className="text-2xl font-bold text-white">A</span>
            </div>
            <CardTitle className="text-2xl">Avícola del Sur ERP</CardTitle>
            <CardDescription>
              Sistema de Gestión Integral
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <h4 className="text-sm font-medium text-yellow-800 mb-2">⚠️ Configuración Pendiente</h4>
              <p className="text-xs text-yellow-700">
                El sistema requiere configuración de Supabase para funcionar completamente.
                Consulta el archivo SUPABASE_SETUP.md para las instrucciones.
              </p>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Una vez configurado Supabase, podrás acceder a todas las funcionalidades del sistema ERP.
            </p>
          </CardContent>
        </Card>

        {/* Información del sistema */}
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">Características del Sistema</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-white rounded-md shadow-sm">
              <div className="font-medium">📦 Almacén</div>
              <div className="text-muted-foreground">Control de stock y lotes</div>
            </div>
            <div className="p-3 bg-white rounded-md shadow-sm">
              <div className="font-medium">💼 Ventas</div>
              <div className="text-muted-foreground">Pedidos y clientes</div>
            </div>
            <div className="p-3 bg-white rounded-md shadow-sm">
              <div className="font-medium">🚚 Reparto</div>
              <div className="text-muted-foreground">Rutas y entregas</div>
            </div>
            <div className="p-3 bg-white rounded-md shadow-sm">
              <div className="font-medium">🤖 Bot</div>
              <div className="text-muted-foreground">Pedidos por WhatsApp</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default async function HomePage() {
  // Verificar si hay configuración de Supabase
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // Si no hay configuración, mostrar la página de bienvenida directamente
    return renderWelcomePage()
  }

  // Verificar si hay un usuario autenticado
  const user = await getCurrentUser()

  // Si hay usuario autenticado, redirigir según su rol
  if (user) {
    switch (user.rol) {
      case 'admin':
        redirect('/dashboard')
      case 'vendedor':
        redirect('/ventas/pedidos')
      case 'repartidor':
        redirect('/home')
      case 'almacenista':
        redirect('/almacen/productos')
      default:
        redirect('/login')
    }
  }

  // Página de bienvenida para usuarios no autenticados
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card className="w-full mx-auto">
          <CardHeader className="text-center">
            <div
              className="mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4"
              style={{ backgroundColor: colors.primary.green }}
            >
              <span className="text-2xl font-bold text-white">A</span>
            </div>
            <CardTitle className="text-2xl">Avícola del Sur ERP</CardTitle>
            <CardDescription>
              Sistema de Gestión Integral
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Bienvenido al sistema ERP de Avícola del Sur.
              Inicia sesión para acceder a tu panel de control.
            </p>
            <Button asChild className="w-full" style={{ backgroundColor: colors.primary.green }}>
              <Link href="/login">
                Iniciar Sesión
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Información del sistema */}
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">Características del Sistema</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-white rounded-md shadow-sm">
              <div className="font-medium">📦 Almacén</div>
              <div className="text-muted-foreground">Control de stock y lotes</div>
            </div>
            <div className="p-3 bg-white rounded-md shadow-sm">
              <div className="font-medium">💼 Ventas</div>
              <div className="text-muted-foreground">Pedidos y clientes</div>
            </div>
            <div className="p-3 bg-white rounded-md shadow-sm">
              <div className="font-medium">🚚 Reparto</div>
              <div className="text-muted-foreground">Rutas y entregas</div>
            </div>
            <div className="p-3 bg-white rounded-md shadow-sm">
              <div className="font-medium">🤖 Bot</div>
              <div className="text-muted-foreground">Pedidos por WhatsApp</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
