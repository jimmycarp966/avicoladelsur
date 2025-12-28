'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function ActualizarMorasButton() {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleActualizarMoras = async () => {
        setLoading(true)
        try {
            const supabase = createClient()
            const { data, error } = await supabase.rpc('fn_actualizar_moras_facturas')

            if (error) throw error

            const result = data as any

            if (result.success) {
                toast.success('Moras actualizadas', {
                    description: `${result.facturas_actualizadas} facturas procesadas. Total mora: $${result.total_mora_calculada?.toFixed(2) || 0}`
                })
                router.refresh()
            } else {
                throw new Error('Error al actualizar moras')
            }
        } catch (error: any) {
            console.error('Error actualizando moras:', error)
            toast.error('Error al actualizar moras', {
                description: error.message
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button
            onClick={handleActualizarMoras}
            disabled={loading}
            variant="outline"
        >
            {loading ? (
                <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Calculando...
                </>
            ) : (
                <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Recalcular Moras
                </>
            )}
        </Button>
    )
}
