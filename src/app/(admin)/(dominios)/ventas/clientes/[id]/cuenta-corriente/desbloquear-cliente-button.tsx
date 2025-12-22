'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Unlock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface DesbloquearClienteButtonProps {
    clienteId: string
    clienteNombre: string
}

export function DesbloquearClienteButton({ clienteId, clienteNombre }: DesbloquearClienteButtonProps) {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleDesbloquear = async () => {
        setLoading(true)
        try {
            const supabase = createClient()

            const { error } = await supabase
                .from('clientes')
                .update({
                    bloqueado_por_deuda: false,
                    updated_at: new Date().toISOString()
                })
                .eq('id', clienteId)

            if (error) throw error

            toast.success('Cliente desbloqueado', {
                description: `${clienteNombre} puede volver a realizar compras`
            })

            router.refresh()
        } catch (error: any) {
            console.error('Error desbloqueando cliente:', error)
            toast.error('Error al desbloquear cliente', {
                description: error.message
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="outline" className="border-green-500 text-green-600 hover:bg-green-50">
                    <Unlock className="mr-2 h-4 w-4" />
                    Desbloquear Cliente
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>¿Desbloquear cliente?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esto permitirá que <strong>{clienteNombre}</strong> vuelva a realizar compras a crédito.
                        <br /><br />
                        <strong>Nota:</strong> El cliente podría volver a bloquearse automáticamente si excede su límite de crédito.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDesbloquear}
                        disabled={loading}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Desbloqueando...
                            </>
                        ) : (
                            <>
                                <Unlock className="mr-2 h-4 w-4" />
                                Sí, Desbloquear
                            </>
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
