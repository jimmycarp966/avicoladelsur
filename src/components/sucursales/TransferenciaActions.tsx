'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { aprobarTransferenciaAction, recibirTransferenciaAction } from '@/actions/sucursales-transferencias.actions'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, PackageCheck } from 'lucide-react'

interface TransferenciaActionsProps {
    id: string
    estado: string
}

export function TransferenciaActions({ id, estado }: TransferenciaActionsProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    async function handleAprobar() {
        setLoading(true)
        try {
            const result = await aprobarTransferenciaAction(id)
            if (result.success) {
                toast.success('Transferencia aprobada y enviada')
                router.refresh()
            } else {
                toast.error(result.message || 'Error al aprobar')
            }
        } catch (error) {
            toast.error('Error inesperado')
        } finally {
            setLoading(false)
        }
    }

    async function handleRecibir() {
        setLoading(true)
        try {
            const result = await recibirTransferenciaAction(id)
            if (result.success) {
                toast.success('Transferencia recibida exitosamente')
                router.refresh()
            } else {
                toast.error(result.message || 'Error al recibir')
            }
        } catch (error) {
            toast.error('Error inesperado')
        } finally {
            setLoading(false)
        }
    }

    if (estado === 'pendiente') {
        return (
            <Button onClick={handleAprobar} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Aprobar y Enviar
            </Button>
        )
    }

    if (estado === 'en_transito') {
        return (
            <Button onClick={handleRecibir} disabled={loading} className="bg-green-600 hover:bg-green-700">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-2 h-4 w-4" />}
                Confirmar Recepción
            </Button>
        )
    }

    return null
}
