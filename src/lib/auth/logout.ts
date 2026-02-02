'use client'

import { createClient } from '@/lib/supabase/client'
import { useUserStore } from '@/store/userStore'

/**
 * FUNCIÓN CENTRALIZADA DE LOGOUT - ÚNICA FUNCIÓN QUE DEBE USARSE
 *
 * Esta es la ÚNICA función que debe usarse para cerrar sesión en toda la aplicación.
 *
 * Características:
 * - Cierra sesión en Supabase Auth
 * - Limpia el store de Zustand completamente
 * - Limpia localStorage y sessionStorage
 * - Fuerza una recarga completa de la página para limpiar todo el estado de React/Next.js
 *
 * @param options.reason - Razón del logout (para debugging)
 * @param options.redirectTo - URL a redirigir (default: '/login')
 */
export async function performLogout(options?: {
    reason?: string
    redirectTo?: string
}) {
    const timestamp = new Date().toISOString()
    const reason = options?.reason || 'Manual'
    const redirectTo = options?.redirectTo || '/login'

    console.log(`[LOGOUT ${timestamp}] Iniciando logout centralizado:`, { reason })

    try {
        // 1. Cerrar sesión en Supabase (cliente)
        const supabase = createClient()
        await supabase.auth.signOut()
        console.log(`[LOGOUT ${timestamp}] Supabase signOut completado`)

        // 2. Limpiar store de Zustand
        useUserStore.getState().logout()
        console.log(`[LOGOUT ${timestamp}] Store limpiado`)

        // 3. Limpiar localStorage y sessionStorage manualmente
        if (typeof window !== 'undefined') {
            // Limpiar todos los items relacionados con el usuario
            const keysToRemove: string[] = []
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)
                if (key && (key.includes('user') || key.includes('auth') || key.includes('session'))) {
                    keysToRemove.push(key)
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key))

            // También limpiar sessionStorage
            sessionStorage.clear()

            console.log(`[LOGOUT ${timestamp}] Storage limpiado (${keysToRemove.length} keys)`)
        }

    } catch (error) {
        console.error(`[LOGOUT ${timestamp}] Error durante logout:`, error)
        // Continuar con la redirección aunque haya error
    }

    // 4. SIEMPRE redirigir con recarga completa
    // Esto limpia todo el estado de React/Next.js y evita problemas de hidratación
    console.log(`[LOGOUT ${timestamp}] Redirigiendo a ${redirectTo}...`)

    // Usar setTimeout para asegurar que se ejecuten todas las limpiezas asíncronas
    setTimeout(() => {
        window.location.href = redirectTo
    }, 100)
}

/**
 * Hook simplificado para usar logout en componentes (obsoleto, usar LogoutButton)
 * @deprecated Usar el componente LogoutButton en su lugar
 */
export function useLogout() {
    const handleLogout = async (reason?: string) => {
        await performLogout({ reason })
    }

    return { logout: handleLogout }
}
