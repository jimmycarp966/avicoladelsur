'use client'

import { LogOut } from 'lucide-react'
import { performLogout } from '@/lib/auth/logout'
import { useState } from 'react'

interface LogoutButtonProps {
  variant?: 'menuItem' | 'button' | 'icon'
  className?: string
  label?: string
}

/**
 * Componente de botón de logout robusto y unificado.
 *
 * USAR ESTE COMPONENTE para todos los botones de cerrar sesión.
 * Funciona tanto dentro de DropdownMenu como standalone.
 *
 * @example
 * // En DropdownMenuItem:
 * <LogoutButton variant="menuItem" />
 *
 * // Como botón normal:
 * <LogoutButton variant="button" />
 *
 * // Como botón con ícono:
 * <LogoutButton variant="icon" />
 */
export function LogoutButton({
  variant = 'menuItem',
  className = '',
  label = 'Cerrar Sesión'
}: LogoutButtonProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async (e?: React.MouseEvent | React.KeyboardEvent) => {
    // Prevenir comportamiento por defecto
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    if (isLoggingOut) return

    setIsLoggingOut(true)

    try {
      await performLogout({ reason: `LogoutButton-${variant}` })
    } catch (error) {
      console.error('[LogoutButton] Error durante logout:', error)
      // Forzar redirección incluso si hay error
      window.location.href = '/login'
    }
  }

  // Variante para DropdownMenuItem
  if (variant === 'menuItem') {
    return (
      <div
        role="menuitem"
        tabIndex={0}
        className={`flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer px-2 py-1.5 rounded-sm text-sm outline-none focus:bg-accent focus:text-accent-foreground ${className}`}
        onClick={handleLogout}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleLogout(e)
          }
        }}
      >
        {isLoggingOut ? (
          <>
            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>Cerrando...</span>
          </>
        ) : (
          <>
            <LogOut className="mr-2 h-4 w-4" />
            <span>{label}</span>
          </>
        )}
      </div>
    )
  }

  // Variante botón normal
  if (variant === 'button') {
    return (
      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        {isLoggingOut ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>Cerrando...</span>
          </>
        ) : (
          <>
            <LogOut className="h-4 w-4" />
            <span>{label}</span>
          </>
        )}
      </button>
    )
  }

  // Variante icono
  return (
    <button
      onClick={handleLogout}
      disabled={isLoggingOut}
      className={`inline-flex items-center justify-center p-2 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      title={label}
    >
      {isLoggingOut ? (
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <LogOut className="h-5 w-5" />
      )}
    </button>
  )
}
