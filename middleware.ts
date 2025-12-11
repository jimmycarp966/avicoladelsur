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
  const timestamp = new Date().toISOString()

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

  // Logs de autenticación en middleware
  if (error) {
    console.error(`[MIDDLEWARE AUTH LOG ${timestamp}] Error al obtener usuario:`, {
      pathname,
      error: error.message,
      status: error.status || 'N/A',
      reason: 'Error al verificar autenticación en middleware',
    })
  }

  // Si no hay usuario autenticado, redirigir a login
  if (!user) {
    console.warn(`[MIDDLEWARE AUTH LOG ${timestamp}] Redirigiendo a login - No hay usuario:`, {
      pathname,
      reason: 'Usuario no autenticado',
    })
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Obtener sesión para verificar expiración
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.expires_at) {
    const expiresAt = new Date(session.expires_at * 1000)
    const now = new Date()
    const isExpired = expiresAt < now
    const minutesUntilExpiry = Math.round((expiresAt.getTime() - now.getTime()) / 1000 / 60)

    if (isExpired) {
      console.warn(`[MIDDLEWARE AUTH LOG ${timestamp}] Redirigiendo a login - Token expirado:`, {
        pathname,
        userId: user.id,
        expiresAt: expiresAt.toISOString(),
        reason: 'Token de acceso expirado',
      })
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Log solo si quedan menos de 10 minutos para expirar
    if (minutesUntilExpiry < 10 && minutesUntilExpiry > 0) {
      console.log(`[MIDDLEWARE AUTH LOG ${timestamp}] Token próximo a expirar:`, {
        pathname,
        userId: user.id,
        minutesUntilExpiry,
      })
    }
  }

  // Obtener datos del usuario de la tabla usuarios
  const { data: userData, error: userError } = await supabase
    .from('usuarios')
    .select('rol, activo')
    .eq('id', user.id)
    .single()

  // Si hay error o usuario no existe/inactivo, redirigir a login
  if (userError || !userData || !userData.activo) {
    console.warn(`[MIDDLEWARE AUTH LOG ${timestamp}] Redirigiendo a login - Usuario inválido:`, {
      pathname,
      userId: user.id,
      userEmail: user.email,
      error: userError?.message || 'N/A',
      encontrado: !!userData,
      activo: userData?.activo ?? false,
      reason: userError ? 'Error al consultar usuario' : !userData ? 'Usuario no encontrado' : 'Usuario inactivo',
    })
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

  const tesoreriaRoutes = [
    '/tesoreria',
  ]

  // Verificar permisos según rol
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route))
  const isSellerRoute = sellerRoutes.some(route => pathname.startsWith(route))
  const isWarehouseRoute = warehouseRoutes.some(route => pathname.startsWith(route))
  const isDeliveryRoute = deliveryRoutes.some(route => pathname.startsWith(route))
  const isRrhhRoute = rrhhRoutes.some(route => pathname.startsWith(route))
  const isTesoreriaRoute = tesoreriaRoutes.some(route => pathname.startsWith(route))

  // Rutas de repartidor (PWA móvil)
  const driverRoutes = [
    '/checkin',
    '/entregas',
    '/perfil',
    '/ruta',
    '/ruta-diaria',
    '/home',
  ]

  const isDriverRoute = driverRoutes.some(route => pathname.startsWith(route))

  // Verificar permisos
  if (isAdminRoute && userRole !== 'admin') {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  if (isSellerRoute && !['admin', 'vendedor', 'encargado_sucursal'].includes(userRole)) {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }
  
  // Rutas de sucursal (solo para encargado_sucursal y admin)
  const sucursalRoutes = [
    '/sucursal',
  ]
  const isSucursalRoute = sucursalRoutes.some(route => pathname.startsWith(route))
  
  if (isSucursalRoute && !['admin', 'encargado_sucursal'].includes(userRole)) {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  if (isWarehouseRoute && !['admin', 'almacenista'].includes(userRole)) {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  if (isDeliveryRoute && !['admin', 'vendedor', 'almacenista'].includes(userRole)) {
    // Admin puede gestionar rutas, vendedor y almacenista solo pueden ver (RLS limita permisos)
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  if (isRrhhRoute && userRole !== 'admin') {
    // Solo admin puede acceder a RRHH
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }

  if (isTesoreriaRoute && !['admin', 'tesorero', 'encargado_sucursal'].includes(userRole)) {
    // Admin, tesorero y encargado_sucursal pueden acceder a tesorería (con restricciones RLS)
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }
  
  // Redirección automática para encargado_sucursal
  if (userRole === 'encargado_sucursal' && pathname === '/dashboard') {
    return NextResponse.redirect(new URL('/sucursal/dashboard', request.url))
  }
  
  // Redirección automática para encargado_sucursal desde raíz
  if (userRole === 'encargado_sucursal' && pathname === '/') {
    return NextResponse.redirect(new URL('/sucursal/dashboard', request.url))
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
