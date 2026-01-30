import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const requestUrl = new URL(request.url)

    try {
        const supabase = await createClient()
        await supabase.auth.signOut()
    } catch (error) {
        console.error('[Logout Route] Error en signOut:', error)
    }

    // Crear respuesta con redirect
    const response = NextResponse.redirect(`${requestUrl.origin}/login`, {
        status: 302, // Usar 302 para redirect temporal
    })

    // Limpiar cookies de sesión de Supabase
    // Nota: Los nombres de las cookies pueden variar según la configuración
    const cookiesToClear = [
        'sb-access-token',
        'sb-refresh-token',
        `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0]}-auth-token`,
    ]

    cookiesToClear.forEach(cookieName => {
        response.cookies.set(cookieName, '', {
            expires: new Date(0),
            path: '/',
        })
    })

    return response
}
