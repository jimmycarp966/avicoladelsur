'use client'

import { createClient } from '@/lib/supabase/client'
import { useUserStore } from '@/store/userStore'

/**
 * Función centralizada de logout.
 * Esta es la ÚNICA función que debe usarse para cerrar sesión.
 * 
 * @param options.reason - Razón del logout (para logging)
 * @param options.showToast - Si mostrar notificación (default: true)
 */
export async function performLogout(options?: {
    reason?: string
    showToast?: boolean
}) {
    const timestamp = new Date().toISOString()
    console.log(`[LOGOUT ${timestamp}] Iniciando logout centralizado:`, {
        reason: options?.reason || 'Manual',
    })

    try {
        // 1. Cerrar sesión en Supabase (cliente)
        const supabase = createClient()
        await supabase.auth.signOut()
        console.log(`[LOGOUT ${timestamp}] Supabase signOut completado`)

        // 2. Limpiar store de Zustand
        useUserStore.getState().logout()
        console.log(`[LOGOUT ${timestamp}] Store limpiado`)

        // 3. Limpiar localStorage manualmente (por si Zustand no lo limpió)
        if (typeof window !== 'undefined') {
            localStorage.removeItem('user-storage')
            // También limpiar cualquier otro storage relacionado
            sessionStorage.clear()
            console.log(`[LOGOUT ${timestamp}] LocalStorage limpiado`)
        }

    } catch (error) {
        console.error(`[LOGOUT ${timestamp}] Error durante logout:`, error)
        // Continuar con la redirección aunque haya error
    }

    // 4. SIEMPRE redirigir con recarga completa
    // Esto limpia todo el estado de React/Next.js
    console.log(`[LOGOUT ${timestamp}] Redirigiendo a /login...`)
    window.location.href = '/login'
}

/**
 * Hook simplificado para usar logout en componentes
 */
export function useLogout() {
    const handleLogout = async (reason?: string) => {
        await performLogout({ reason })
    }

    return { logout: handleLogout }
}
