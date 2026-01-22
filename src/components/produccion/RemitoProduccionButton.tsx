'use client'

import { Button } from '@/components/ui/button'
import { FileText, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { generarRemitoProduccionAction } from '@/actions/remitos.actions'

interface RemitoProduccionButtonProps {
    ordenId: string
}

export function RemitoProduccionButton({ ordenId }: RemitoProduccionButtonProps) {
    const [loading, setLoading] = useState(false)

    const handleGenerar = async () => {
        setLoading(true)
        const toastId = toast.loading('Generando remito de producción...')
        try {
            const res = await generarRemitoProduccionAction(ordenId)
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
            className="flex items-center gap-1 text-primary hover:text-primary hover:bg-primary/5"
            onClick={handleGenerar}
            disabled={loading}
        >
            {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <FileText className="h-4 w-4" />
            )}
            Remito
        </Button>
    )
}
