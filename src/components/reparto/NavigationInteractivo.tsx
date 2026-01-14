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
            <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="pt-6 text-center">
                        <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
                        <p className="text-destructive mb-4">{error}</p>
                        <div className="flex gap-2 justify-center">
                            <Button variant="outline" onClick={onClose}>Cerrar</Button>
                            <Button onClick={() => {
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
            <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="pt-6 text-center">
                        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                        <p className="text-xl font-bold mb-2">¡Ruta Completada!</p>
                        <p className="text-muted-foreground mb-4">Has completado todas las entregas.</p>
                        <Button onClick={onClose}>Cerrar Navegación</Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (fase === 'calculando') {
        return (
            <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-lg font-medium">Calculando próximo cliente...</p>
                    <p className="text-sm text-muted-foreground mt-2">
                        Analizando horarios y distancias
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
