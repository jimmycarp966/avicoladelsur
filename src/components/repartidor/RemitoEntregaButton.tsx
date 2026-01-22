'use client'

import { Button } from '@/components/ui/button'
import { FileText, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { generarRemitoEntregaAction } from '@/actions/remitos.actions'

interface RemitoEntregaButtonProps {
    entregaId: string
    className?: string
}

export function RemitoEntregaButton({ entregaId, className }: RemitoEntregaButtonProps) {
    const [loading, setLoading] = useState(false)

    const handleGenerar = async () => {
        setLoading(true)
        const toastId = toast.loading('Generando remito PDF...')
        try {
            const res = await generarRemitoEntregaAction(entregaId)
            if (res.success && res.data?.archivo_url) {
                toast.success('Remito generado', { id: toastId })
                window.open(res.data.archivo_url, '_blank')
            } else {
                toast.error(res.error || 'Error al generar remito', { id: toastId })
            }
        } catch (error) {
            toast.error('Error al procesar el remito', { id: toastId })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button
            variant="ghost"
            size="sm"
            className={className || "w-full text-xs flex items-center gap-1"}
            onClick={handleGenerar}
            disabled={loading}
        >
            {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
                <FileText className="h-3 v-3" />
            )}
            Ver Remito
        </Button>
    )
}
