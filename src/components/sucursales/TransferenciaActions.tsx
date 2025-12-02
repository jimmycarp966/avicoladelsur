'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
    aprobarTransferenciaAction, 
    recibirTransferenciaAction,
    prepararTransferenciaAction,
    confirmarRecepcionTransferenciaAction,
    cancelarTransferenciaAction
} from '@/actions/sucursales-transferencias.actions'
import { asignarTransferenciaARutaDesdeAlmacen } from '@/actions/reparto.actions'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, PackageCheck, Scale, Truck, XCircle, Package } from 'lucide-react'

interface TransferenciaActionsProps {
    id: string
    estado: string
}

export function TransferenciaActions({ id, estado }: TransferenciaActionsProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [loadingAction, setLoadingAction] = useState<string | null>(null)

    async function handlePreparar() {
        setLoadingAction('preparar')
        try {
            const result = await prepararTransferenciaAction(id)
            if (result.success) {
                toast.success(result.message || 'Transferencia preparada')
                router.refresh()
            } else {
                toast.error(result.message || 'Error al preparar')
            }
        } catch (error) {
            toast.error('Error inesperado')
        } finally {
            setLoadingAction(null)
        }
    }

    async function handleAsignarRuta() {
        setLoadingAction('ruta')
        try {
            const result = await asignarTransferenciaARutaDesdeAlmacen(id)
            if (result.success) {
                toast.success(result.message || 'Transferencia asignada a ruta')
                router.refresh()
            } else {
                toast.error(result.error || 'Error al asignar a ruta')
            }
        } catch (error) {
            toast.error('Error inesperado')
        } finally {
            setLoadingAction(null)
        }
    }

    async function handleConfirmarRecepcion() {
        setLoadingAction('recibir')
        try {
            const result = await confirmarRecepcionTransferenciaAction(id)
            if (result.success) {
                toast.success(result.message || 'Transferencia recibida')
                router.refresh()
            } else {
                toast.error(result.message || 'Error al recibir')
            }
        } catch (error) {
            toast.error('Error inesperado')
        } finally {
            setLoadingAction(null)
        }
    }

    async function handleCancelar() {
        if (!confirm('¿Está seguro de cancelar esta transferencia? El stock será devuelto.')) return
        
        setLoadingAction('cancelar')
        try {
            const result = await cancelarTransferenciaAction(id)
            if (result.success) {
                toast.success(result.message || 'Transferencia cancelada')
                router.refresh()
            } else {
                toast.error(result.message || 'Error al cancelar')
            }
        } catch (error) {
            toast.error('Error inesperado')
        } finally {
            setLoadingAction(null)
        }
    }

    // Legacy: Aprobar (para compatibilidad con estados anteriores)
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

    // Legacy: Recibir (para compatibilidad con estados anteriores)
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

    const isLoading = loading || loadingAction !== null

    // NUEVO FLUJO: en_almacen → preparado → en_ruta → entregado → recibido
    
    // Estado: En Almacén - Preparar
    if (estado === 'en_almacen') {
        return (
            <div className="flex items-center gap-2">
                <Button 
                    onClick={handlePreparar} 
                    disabled={isLoading}
                    className="bg-blue-600 hover:bg-blue-700"
                >
                    {loadingAction === 'preparar' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Scale className="mr-2 h-4 w-4" />
                    )}
                    Marcar Preparada
                </Button>
                <Button 
                    variant="outline" 
                    onClick={handleCancelar}
                    disabled={isLoading}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                >
                    {loadingAction === 'cancelar' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <XCircle className="mr-2 h-4 w-4" />
                    )}
                    Cancelar
                </Button>
            </div>
        )
    }

    // Estado: Preparado - Asignar a ruta
    if (estado === 'preparado') {
        return (
            <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-700 border-green-300">
                    <Package className="mr-1 h-3 w-3" /> Preparada
                </Badge>
                <Button 
                    onClick={handleAsignarRuta} 
                    disabled={isLoading}
                    className="bg-indigo-600 hover:bg-indigo-700"
                >
                    {loadingAction === 'ruta' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Truck className="mr-2 h-4 w-4" />
                    )}
                    Asignar a Ruta
                </Button>
            </div>
        )
    }

    // Estado: En Ruta
    if (estado === 'en_ruta') {
        return (
            <Badge className="bg-indigo-100 text-indigo-700 border-indigo-300">
                <Truck className="mr-1 h-3 w-3" /> En Ruta
            </Badge>
        )
    }

    // Estado: Entregado - Confirmar recepción
    if (estado === 'entregado') {
        return (
            <Button 
                onClick={handleConfirmarRecepcion} 
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700"
            >
                {loadingAction === 'recibir' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <PackageCheck className="mr-2 h-4 w-4" />
                )}
                Confirmar Recepción
            </Button>
        )
    }

    // Estado: Recibido
    if (estado === 'recibido' || estado === 'recibida') {
        return (
            <Badge className="bg-green-100 text-green-700 border-green-300">
                <CheckCircle2 className="mr-1 h-3 w-3" /> Completada
            </Badge>
        )
    }

    // LEGACY: Compatibilidad con estados anteriores

    // Estado: Pendiente (legacy)
    if (estado === 'pendiente') {
        return (
            <Button onClick={handleAprobar} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Aprobar y Enviar
            </Button>
        )
    }

    // Estado: En Tránsito (legacy)
    if (estado === 'en_transito') {
        return (
            <Button onClick={handleRecibir} disabled={loading} className="bg-green-600 hover:bg-green-700">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-2 h-4 w-4" />}
                Confirmar Recepción
            </Button>
        )
    }

    // Estado: Cancelada
    if (estado === 'cancelada') {
        return (
            <Badge variant="destructive">
                <XCircle className="mr-1 h-3 w-3" /> Cancelada
            </Badge>
        )
    }

    return null
}
