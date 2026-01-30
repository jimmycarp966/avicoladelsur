'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

interface BackButtonProps {
    children?: React.ReactNode
    className?: string
}

/**
 * Botón "Volver" que navega a la página anterior en el historial.
 * Usar en lugar de links hardcodeados para mantener el contexto de navegación.
 */
export function BackButton({ children, className }: BackButtonProps) {
    const router = useRouter()

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className={className}
        >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {children || 'Volver'}
        </Button>
    )
}
