import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { NextRequest } from 'next/server'
import type { CookieOptions } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Obtener usuario actual
  const { data: { user }, error } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Rutas públicas (no requieren autenticación)
  const publicRoutes = [
    '/login',
    '/reset-password',
    '/forgot-password',
    '/',
    '/api/bot/webhook', // Webhook del bot debe ser público
  ]

  const isPublicRoute = publicRoutes.some(route =>
    pathname === route || pathname.startsWith(route + '/') || pathname.startsWith('/api/')
  )

  // Si es una ruta pública, continuar
  if (isPublicRoute) {
    return response
  }

  // Si no hay usuario autenticado, redirigir a login
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Obtener datos del usuario de la tabla usuarios
  const { data: userData, error: userError } = await supabase
    .from('usuarios')
    .select('rol, activo')
    .eq('id', user.id)
    .single()

  // Si hay error o usuario no existe/inactivo, redirigir a login
  if (userError || !userData || !userData.activo) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  const userRole = userData.rol

  // Definir rutas protegidas por rol
  const adminRoutes = [
    '/admin',
    '/admin/usuarios',
    '/admin/configuracion',
  ]

  const sellerRoutes = [
    '/admin/ventas',
    '/admin/clientes',
    '/admin/cotizaciones',
    '/admin/reclamos',
  ]

  const warehouseRoutes = [
    '/admin/almacen',
    '/admin/productos',
    '/admin/lotes',
    '/admin/stock',
  ]

  const deliveryRoutes = [
    '/admin/reparto',
    '/admin/rutas',
    '/admin/vehiculos',
  ]

  const rrhhRoutes = [
    '/rrhh',
  ]

  // Verificar permisos según rol
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route))
  const isSellerRoute = sellerRoutes.some(route => pathname.startsWith(route))
  const isWarehouseRoute = warehouseRoutes.some(route => pathname.startsWith(route))
  const isDeliveryRoute = deliveryRoutes.some(route => pathname.startsWith(route))
  const isRrhhRoute = rrhhRoutes.some(route => pathname.startsWith(route))

  // Rutas de repartidor (PWA móvil)
  const isDriverRoute = pathname.startsWith('/repartidor')

  // Verificar permisos
  if (isAdminRoute && userRole !== 'admin') {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  if (isSellerRoute && !['admin', 'vendedor'].includes(userRole)) {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  if (isWarehouseRoute && !['admin', 'almacenista'].includes(userRole)) {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  if (isDeliveryRoute && !['admin'].includes(userRole)) {
    // Solo admin puede gestionar rutas, pero repartidores tienen su propia app
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  if (isRrhhRoute && userRole !== 'admin') {
    // Solo admin puede acceder a RRHH
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  if (isDriverRoute && userRole !== 'repartidor') {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  // Si todas las verificaciones pasan, continuar
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
