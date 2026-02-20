'use client'

/**
 * NavigationInteractivo - Flujo de navegación paso a paso con selección de rutas
 * 
 * Este componente orquesta el flujo interactivo:
 * 1. Calcula próximo cliente óptimo (horario + distancia)
 * 2. Obtiene rutas alternativas de Google
 * 3. Muestra selector de rutas alternativas
 * 4. Inicia navegación con la ruta elegida
 * 5. Al completar entrega, repite desde paso 1
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import RutaAlternativasSelector from './RutaAlternativasSelector'
import NavigationView from './NavigationView'
import {
    calcularProximosClientes,
    obtenerProximoCliente,
    type ClientePendiente,
    type ClienteCalificado
} from '@/lib/rutas/next-client-selector'
import type { RutaAlternativa } from '@/lib/rutas/ors-directions'
import {
    obtenerPreferenciaDominante,
    registrarPreferencia,
    marcarRutaPreferida
} from '@/lib/rutas/preferencias-ruta'
import { createClient } from '@/lib/supabase/client'

interface DeliveryStop {
    id: string
    orden: number
    cliente_nombre: string
    direccion?: string
    telefono?: string
    lat: number
    lng: number
    estado: 'pendiente' | 'entregado' | 'ausente'
    horarioApertura?: string
    esUrgente?: boolean
    pedidoId?: string
}

interface NavigationInteractivoProps {
    rutaId: string
    stops: DeliveryStop[]
    onClose: () => void
    onDeliveryComplete: (stopId: string) => void
    initialPosition?: { lat: number; lng: number } | null
    repartidorId: string
}

type FaseNavegacion = 'calculando' | 'seleccionando' | 'navegando' | 'completado' | 'error'

export default function NavigationInteractivo({
    rutaId,
    stops,
    onClose,
    onDeliveryComplete,
    initialPosition,
    repartidorId
}: NavigationInteractivoProps) {
    const router = useRouter()
    const supabase = createClient()

    // Estado del flujo
    const [fase, setFase] = useState<FaseNavegacion>('calculando')
    const [error, setError] = useState<string | null>(null)

    // Datos actuales
    const [posicionActual, setPosicionActual] = useState<{ lat: number; lng: number } | null>(initialPosition || null)
    const [clienteSugerido, setClienteSugerido] = useState<ClienteCalificado | null>(null)
    const [rutasAlternativas, setRutasAlternativas] = useState<RutaAlternativa[]>([])
    const [rutaSeleccionada, setRutaSeleccionada] = useState<RutaAlternativa | null>(null)

    // Clientes pendientes
    const clientesPendientes = stops.filter(s => s.estado !== 'entregado')

    // Obtener posición actual
    useEffect(() => {
        if (posicionActual) return
        if (!navigator.geolocation) {
            setError('GPS no disponible')
            setFase('error')
            return
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setPosicionActual({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude
                })
            },
            (err) => {
                console.error('[NavigationInteractivo] Error GPS:', err)
                setError('No se pudo obtener ubicación GPS')
                setFase('error')
            },
            { enableHighAccuracy: true, timeout: 15000 }
        )
    }, [posicionActual])

    // Calcular próximo cliente cuando cambia la posición o los clientes pendientes
    const calcularProximoCliente = useCallback(async () => {
        console.log('[NavigationInteractivo] 🔍 DEBUG calcularProximoCliente iniciado')
        console.log('[NavigationInteractivo] 🔍 DEBUG posicionActual:', posicionActual)
        console.log('[NavigationInteractivo] 🔍 DEBUG clientesPendientes.length:', clientesPendientes.length)

        if (!posicionActual || clientesPendientes.length === 0) {
            console.log('[NavigationInteractivo] 🔍 DEBUG: No hay posición o clientes pendientes, retornando')
            return
        }

        setFase('calculando')
        console.log('[NavigationInteractivo] 🔍 DEBUG: Fase cambiada a calculando')

        try {
            // Convertir stops a ClientePendiente
            const clientes: ClientePendiente[] = clientesPendientes.map(s => ({
                id: s.id,
                nombre: s.cliente_nombre,
                lat: s.lat,
                lng: s.lng,
                horarioApertura: s.horarioApertura,
                esUrgente: s.esUrgente,
                pedidoId: s.pedidoId
            }))

            console.log('[NavigationInteractivo] 🔍 DEBUG: Clientes convertidos:', clientes.length)

            // Calcular próximo cliente óptimo
            const proximoCliente = obtenerProximoCliente({
                posicionActual,
                clientesPendientes: clientes,
                horaActual: new Date()
            })

            console.log('[NavigationInteractivo] 🔍 DEBUG: proximoCliente calculado:', proximoCliente)

            if (!proximoCliente) {
                console.log('[NavigationInteractivo] 🔍 DEBUG: No hay próximo cliente')
                setError('No hay clientes pendientes')
                setFase('error')
                return
            }

            console.log('[NavigationInteractivo] Próximo cliente:', proximoCliente.nombre)
            setClienteSugerido(proximoCliente)
            console.log('[NavigationInteractivo] 🔍 DEBUG: clienteSugerido seteado')

            // Obtener rutas alternativas de Google
            console.log('[NavigationInteractivo] 🔍 DEBUG: Llamando obtenerRutasAlternativas...')
            await obtenerRutasAlternativas(proximoCliente)
            console.log('[NavigationInteractivo] 🔍 DEBUG: obtenerRutasAlternativas completado')
        } catch (err: any) {
            console.error('[NavigationInteractivo] Error calculando:', err)
            setError(err.message || 'Error al calcular próximo cliente')
            setFase('error')
        }
    }, [posicionActual, clientesPendientes])

    // Obtener rutas alternativas de Google
    const obtenerRutasAlternativas = async (cliente: ClienteCalificado) => {
        console.log('[NavigationInteractivo] 🔍 DEBUG obtenerRutasAlternativas iniciado')
        console.log('[NavigationInteractivo] 🔍 DEBUG cliente:', cliente)
        console.log('[NavigationInteractivo] 🔍 DEBUG posicionActual:', posicionActual)

        if (!posicionActual) {
            console.log('[NavigationInteractivo] 🔍 DEBUG: No hay posicionActual, retornando')
            return
        }

        try {
            console.log('[NavigationInteractivo] 🔍 DEBUG: Llamando a /api/rutas/alternativas...')
            // Llamar a la API de rutas alternativas
            const response = await fetch('/api/rutas/alternativas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    origen: posicionActual,
                    destino: { lat: cliente.lat, lng: cliente.lng }
                })
            })

            console.log('[NavigationInteractivo] 🔍 DEBUG: Response status:', response.status)

            if (!response.ok) {
                throw new Error('Error al obtener rutas alternativas')
            }

            const data = await response.json()
            console.log('[NavigationInteractivo] 🔍 DEBUG: Response data:', data)

            if (!data.rutas || data.rutas.length === 0) {
                throw new Error('No se encontraron rutas')
            }

            console.log('[NavigationInteractivo] 🔍 DEBUG: Rutas obtenidas:', data.rutas.length)

            // Obtener preferencia del repartidor y marcar ruta preferida
            const preferencia = await obtenerPreferenciaDominante(supabase, repartidorId)
            const rutasConPreferencia = marcarRutaPreferida(data.rutas, preferencia)

            console.log('[NavigationInteractivo] 🔍 DEBUG: Rutas con preferencia:', rutasConPreferencia.length)
            console.log('[NavigationInteractivo] 🔍 DEBUG: Cambiando fase a seleccionando')
            setRutasAlternativas(rutasConPreferencia)
            setFase('seleccionando')
        } catch (err: any) {
            console.error('[NavigationInteractivo] 🔍 DEBUG Error en obtenerRutasAlternativas:', err)
            console.error('[NavigationInteractivo] Error obteniendo rutas:', err)
            setError(err.message || 'Error al obtener rutas')
            setFase('error')
        }
    }

    // Iniciar cálculo cuando hay posición
    const isCalculating = useRef(false)
    useEffect(() => {
        if (posicionActual && clientesPendientes.length > 0 && fase === 'calculando' && !isCalculating.current) {
            isCalculating.current = true
            calcularProximoCliente().finally(() => {
                isCalculating.current = false
            })
        }
    }, [posicionActual, clientesPendientes.length, fase])

    // Manejar selección de ruta
    const handleSeleccionarRuta = async (ruta: RutaAlternativa) => {
        console.log('[NavigationInteractivo] 🔍 DEBUG: Ruta seleccionada:', ruta.resumen)
        console.log('[NavigationInteractivo] 🔍 DEBUG: Ruta completa:', ruta)
        setRutaSeleccionada(ruta)

        // Registrar preferencia para aprendizaje
        if (rutasAlternativas.length > 1) {
            await registrarPreferencia(supabase, repartidorId, ruta, rutasAlternativas)
        }

        console.log('[NavigationInteractivo] 🔍 DEBUG: Cambiando fase a navegando')
        setFase('navegando')
    }

    // Manejar entrega completada
    const handleDeliveryComplete = (stopId: string) => {
        console.log('[NavigationInteractivo] Entrega completada:', stopId)
        onDeliveryComplete(stopId)

        // Volver a calcular próximo cliente
        if (clientesPendientes.length > 1) {
            setFase('calculando')
            setClienteSugerido(null)
            setRutasAlternativas([])
            setRutaSeleccionada(null)
        } else {
            setFase('completado')
        }
    }

    // Manejar cerrar navegación (volver a selector)
    const handleCerrarNavegacion = () => {
        setFase('calculando')
        setRutaSeleccionada(null)
    }

    // Render según fase
    if (fase === 'error') {
        return (
            <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
                <Card className="max-w-md w-full shadow-2xl border-destructive/20 bg-white/95 dark:bg-background/95">
                    <CardContent className="pt-8 pb-8 text-center">
                        <AlertCircle className="h-20 w-20 text-destructive mx-auto mb-6 animate-pulse" />
                        <p className="text-destructive font-medium text-lg mb-6">{error}</p>
                        <div className="flex gap-3 justify-center">
                            <Button variant="outline" size="lg" className="w-32 h-12" onClick={onClose}>Cerrar</Button>
                            <Button size="lg" className="w-32 h-12 shadow-md active:scale-95 transition-all" onClick={() => {
                                setError(null)
                                setFase('calculando')
                            }}>
                                Reintentar
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (fase === 'completado') {
        return (
            <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
                <Card className="max-w-md w-full shadow-2xl border-primary/20 bg-white/95 dark:bg-background/95">
                    <CardContent className="pt-8 pb-8 text-center">
                        <div className="p-4 bg-green-100 dark:bg-green-900/30 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 className="h-14 w-14 text-green-600 dark:text-green-400" />
                        </div>
                        <p className="text-2xl font-bold mb-3 text-foreground">¡Ruta Completada!</p>
                        <p className="text-muted-foreground mb-8 text-lg">Has completado todas las entregas.</p>
                        <Button size="lg" className="w-full h-14 text-lg font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all" onClick={onClose}>
                            Cerrar Navegación
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (fase === 'calculando') {
        return (
            <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
                <div className="text-center bg-white/80 dark:bg-black/40 p-10 rounded-3xl shadow-2xl border border-white/20">
                    <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-6 drop-shadow-lg" />
                    <p className="text-xl font-bold text-foreground">Calculando destino óptimo...</p>
                    <p className="text-base text-muted-foreground mt-3 font-medium">
                        Analizando horarios de apertura y distancias
                    </p>
                </div>
            </div>
        )
    }

    if (fase === 'seleccionando' && clienteSugerido && rutasAlternativas.length > 0) {
        return (
            <div className="fixed inset-0 z-50 bg-background">
                <RutaAlternativasSelector
                    clienteDestino={clienteSugerido}
                    rutasAlternativas={rutasAlternativas}
                    posicionActual={posicionActual!}
                    onSeleccionarRuta={handleSeleccionarRuta}
                    onCambiarCliente={undefined} // Por ahora no permitimos cambiar cliente
                />
                {/* Botón cerrar */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-4 left-4 z-10"
                    onClick={onClose}
                >
                    ✕
                </Button>
            </div>
        )
    }

    if (fase === 'navegando' && clienteSugerido) {
        console.log('[NavigationInteractivo] 🔍 DEBUG: Render fase navegando')
        console.log('[NavigationInteractivo] 🔍 DEBUG: clienteSugerido:', clienteSugerido)
        console.log('[NavigationInteractivo] 🔍 DEBUG: posicionActual:', posicionActual)
        console.log('[NavigationInteractivo] 🔍 DEBUG: rutaSeleccionada:', rutaSeleccionada)

        // Crear un stop temporal con los datos del cliente sugerido
        const stopActual: DeliveryStop = {
            id: clienteSugerido.id,
            orden: 1,
            cliente_nombre: clienteSugerido.nombre,
            direccion: undefined,
            telefono: undefined,
            lat: clienteSugerido.lat,
            lng: clienteSugerido.lng,
            estado: 'pendiente'
        }

        console.log('[NavigationInteractivo] 🔍 DEBUG: stopActual:', stopActual)
        console.log('[NavigationInteractivo] 🔍 DEBUG: Renderizando NavigationView...')

        return (
            <NavigationView
                rutaId={rutaId}
                stops={[stopActual]}
                onClose={handleCerrarNavegacion}
                onDeliveryComplete={handleDeliveryComplete}
                initialPosition={posicionActual}
            />
        )
    }

    // Fallback
    console.log('[NavigationInteractivo] 🔍 DEBUG: Fallback render, fase:', fase)
    console.log('[NavigationInteractivo] 🔍 DEBUG: clienteSugerido:', clienteSugerido)
    console.log('[NavigationInteractivo] 🔍 DEBUG: rutasAlternativas:', rutasAlternativas.length)
    return (
        <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    )
}
