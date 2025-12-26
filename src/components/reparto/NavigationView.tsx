'use client'

/**
 * NavigationView - Turn-by-turn navigation with voice for delivery drivers
 * 
 * Features:
 * - Full-screen map optimized for driving
 * - Real-time GPS tracking
 * - Step-by-step driving instructions
 * - Voice announcements (Web Speech API)
 * - "Llegué" button to mark deliveries
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { config } from '@/lib/config'
import {
    Navigation,
    Volume2,
    VolumeX,
    X,
    MapPin,
    CheckCircle2,
    ArrowRight,
    ArrowLeft,
    RotateCcw,
    Loader2,
    Phone,
    FileText
} from 'lucide-react'

// Types
interface DeliveryStop {
    id: string
    orden: number
    cliente_nombre: string
    direccion?: string
    telefono?: string
    lat: number
    lng: number
    estado: 'pendiente' | 'entregado' | 'ausente'
}

interface NavigationStep {
    instruction: string
    distance: string
    duration: string
    maneuver?: string
}

interface NavigationViewProps {
    rutaId: string
    stops: DeliveryStop[]
    onClose: () => void
    onDeliveryComplete: (stopId: string) => void
    /** Ubicación inicial pre-obtenida (del hook useLocationTracker) */
    initialPosition?: { lat: number; lng: number } | null
}

// Voice synthesis helper
const speak = (text: string, enabled: boolean) => {
    if (!enabled || typeof window === 'undefined' || !window.speechSynthesis) return

    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'es-AR'
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.volume = 1.0

    // Try to find a Spanish voice
    const voices = window.speechSynthesis.getVoices()
    const spanishVoice = voices.find(v => v.lang.startsWith('es'))
    if (spanishVoice) {
        utterance.voice = spanishVoice
    }

    window.speechSynthesis.speak(utterance)
}

// Distance helper
const formatDistance = (meters: number): string => {
    if (meters < 1000) {
        return `${Math.round(meters)}m`
    }
    return `${(meters / 1000).toFixed(1)}km`
}

// Distance calculation helper (Haversine formula)
const getDistanceMeters = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000 // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

// Maneuver icons
const getManeuverIcon = (maneuver?: string) => {
    if (!maneuver) return <ArrowRight className="h-8 w-8" />

    if (maneuver.includes('left')) return <ArrowLeft className="h-8 w-8" />
    if (maneuver.includes('right')) return <ArrowRight className="h-8 w-8" />
    if (maneuver.includes('uturn')) return <RotateCcw className="h-8 w-8" />

    return <ArrowRight className="h-8 w-8" />
}

export default function NavigationView({
    rutaId,
    stops,
    onClose,
    onDeliveryComplete,
    initialPosition
}: NavigationViewProps) {
    const router = useRouter()
    // Refs
    const mapRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<any>(null)
    const directionsRendererRef = useRef<any>(null)
    const positionMarkerRef = useRef<any>(null)
    const watchIdRef = useRef<number | null>(null)
    const lastSpokenStepRef = useRef<number>(-1)
    const lastRouteCalcPositionRef = useRef<{ lat: number; lng: number } | null>(null)

    // State
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [voiceEnabled, setVoiceEnabled] = useState(true)
    // Usar ubicación pre-obtenida si está disponible
    const [currentPosition, setCurrentPosition] = useState<{ lat: number, lng: number } | null>(initialPosition || null)
    const [currentStopIndex, setCurrentStopIndex] = useState(0)
    const [steps, setSteps] = useState<NavigationStep[]>([])
    const [currentStepIndex, setCurrentStepIndex] = useState(0)
    const [distanceToNextStop, setDistanceToNextStop] = useState<string>('')
    const [durationToNextStop, setDurationToNextStop] = useState<string>('')
    const [showArrivalPanel, setShowArrivalPanel] = useState(false)

    // Get pending stops (not yet delivered)
    const pendingStops = stops.filter(s => s.estado !== 'entregado')
    const currentStop = pendingStops[currentStopIndex]

    // Initialize map with retry mechanism
    useEffect(() => {
        let timeoutId: NodeJS.Timeout
        let attempts = 0
        const maxAttempts = 20 // 10 seconds

        const initMap = () => {
            console.log('[NavigationView] initMap called', {
                attempts,
                hasMapRef: !!mapRef.current,
                hasGoogle: !!window.google,
                hasMaps: !!window.google?.maps
            })

            if (!mapRef.current) {
                console.warn('[NavigationView] mapRef is null, retrying...')
                if (attempts < maxAttempts) {
                    attempts++
                    timeoutId = setTimeout(initMap, 500)
                    return
                }
                // If ref is still null after all retries (unlikely), stop loading
                console.error('[NavigationView] mapRef never became available')
                setError('Error interno: No se pudo inicializar el contenedor del mapa')
                setLoading(false)
                return
            }

            if (!window.google || !window.google.maps) {
                if (attempts < maxAttempts) {
                    console.log(`[NavigationView] Maps API not ready, retrying... (${attempts + 1}/${maxAttempts})`)
                    attempts++
                    timeoutId = setTimeout(initMap, 500)
                    return
                }
                console.error('[NavigationView] Maps API timeout')
                setError('No se pudo cargar Google Maps. Verifique su conexión.')
                setLoading(false)
                return
            }

            if (mapInstanceRef.current) {
                console.log('[NavigationView] Map already initialized')
                setLoading(false)
                return
            }

            try {
                console.log('[NavigationView] initializing Google Maps instance...')
                const homeBase = config.rutas.homeBase

                mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
                    center: { lat: homeBase.lat, lng: homeBase.lng },
                    zoom: 16,
                    disableDefaultUI: true,
                    zoomControl: true,
                    mapTypeControl: false,
                    fullscreenControl: false,
                    styles: [
                        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
                        { featureType: 'transit', stylers: [{ visibility: 'off' }] }
                    ]
                })

                directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
                    map: mapInstanceRef.current,
                    suppressMarkers: false,
                    polylineOptions: {
                        strokeColor: '#3B82F6',
                        strokeWeight: 6,
                        strokeOpacity: 0.8
                    }
                })

                console.log('[NavigationView] Map initialized successfully')
                setLoading(false)
            } catch (err) {
                console.error('[NavigationView] Error initializing map:', err)
                setError('Error al inicializar el mapa de navegación')
                setLoading(false)
            }
        }

        // Start initialization
        initMap()

        return () => {
            if (timeoutId) clearTimeout(timeoutId)
        }
    }, [])

    // Start GPS tracking - usa initialPosition si está disponible, sin fallback a homeBase
    useEffect(() => {
        if (!navigator.geolocation) {
            console.warn('[NavigationView] GPS no soportado')
            // Si tenemos initialPosition, usarla; sino mostrar error
            if (!currentPosition && !initialPosition) {
                setError('GPS no disponible y no hay ubicación inicial')
            }
            return
        }

        // Si ya tenemos posición inicial, no necesitamos getCurrentPosition
        // pero sí queremos watchPosition para actualizaciones
        if (!currentPosition && !initialPosition) {
            // Solicitar posición solo si no tenemos ninguna
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    console.log('[NavigationView] GPS position:', pos.coords.latitude, pos.coords.longitude)
                    setCurrentPosition({
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude
                    })
                },
                (err) => {
                    console.error('[NavigationView] GPS Error:', err)
                    setError('No se pudo obtener tu ubicación. Verifica los permisos de GPS.')
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
            )
        }

        // Watch position continuously para actualizaciones en tiempo real
        watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                const newPos = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude
                }
                setCurrentPosition(newPos)

                // Update position marker
                if (positionMarkerRef.current && mapInstanceRef.current) {
                    positionMarkerRef.current.setPosition(newPos)
                    mapInstanceRef.current.panTo(newPos)
                }
            },
            (err) => console.error('GPS Watch Error:', err),
            {
                enableHighAccuracy: true,
                maximumAge: 3000,
                timeout: 15000
            }
        )

        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current)
            }
        }
    }, [initialPosition])

    // Create position marker
    useEffect(() => {
        if (!mapInstanceRef.current || !currentPosition || positionMarkerRef.current) return

        positionMarkerRef.current = new window.google.maps.Marker({
            position: currentPosition,
            map: mapInstanceRef.current,
            icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 12,
                fillColor: '#3B82F6',
                fillOpacity: 1,
                strokeColor: '#FFFFFF',
                strokeWeight: 3
            },
            zIndex: 100
        })

        mapInstanceRef.current.setCenter(currentPosition)
    }, [currentPosition])

    // Calculate route to current stop
    const calculateRoute = useCallback(async () => {
        console.log('[NavigationView] calculateRoute called', {
            hasPosition: !!currentPosition,
            hasStop: !!currentStop,
            hasGoogle: !!window.google,
            pos: currentPosition,
            stop: currentStop
        })

        if (!currentPosition || !currentStop || !window.google) {
            console.log('[NavigationView] Missing dependencies for route calculation')
            return
        }

        console.log('%c[NavigationView] 🗺️ Calculando ruta...', 'color: purple; font-weight: bold', {
            origen: currentPosition,
            destino: { lat: currentStop.lat, lng: currentStop.lng, nombre: currentStop.cliente_nombre }
        })

        const directionsService = new window.google.maps.DirectionsService()

        try {
            console.log('[NavigationView] requesting route...')
            const result = await new Promise<any>((resolve, reject) => {
                directionsService.route({
                    origin: currentPosition,
                    destination: { lat: currentStop.lat, lng: currentStop.lng },
                    travelMode: window.google.maps.TravelMode.DRIVING
                }, (res: any, status: any) => {
                    console.log('[NavigationView] Directions status:', status)
                    if (status === 'OK') resolve(res)
                    else reject(new Error(status))
                })
            })

            console.log('[NavigationView] Route received')

            // Display route
            if (directionsRendererRef.current) {
                directionsRendererRef.current.setDirections(result)
            } else {
                console.warn('[NavigationView] directionsRendererRef is null')
            }

            // Extract steps
            const route = result.routes[0]
            const leg = route.legs[0]

            setDistanceToNextStop(leg.distance.text)
            setDurationToNextStop(leg.duration.text)

            const newSteps: NavigationStep[] = leg.steps.map((step: any) => ({
                instruction: step.instructions.replace(/<[^>]*>/g, ''), // Remove HTML
                distance: step.distance.text,
                duration: step.duration.text,
                maneuver: step.maneuver
            }))

            console.log('[NavigationView] Steps set:', newSteps.length)
            setSteps(newSteps)
            setCurrentStepIndex(0)

            // Announce first instruction
            if (newSteps.length > 0 && voiceEnabled) {
                speak(`Navegando hacia ${currentStop.cliente_nombre}. ${newSteps[0].instruction}`, voiceEnabled)
            }

        } catch (err: any) {
            console.error('[NavigationView] Route calculation error:', err)
            setError('No se pudo calcular la ruta: ' + err.message)
        }
    }, [currentPosition, currentStop, voiceEnabled])

    // Calculate route only when there's significant position change (>50m) or on initial load
    useEffect(() => {
        if (!currentPosition || !currentStop || loading) return

        // Check if we need to recalculate (first time or moved >50m)
        const shouldRecalculate = () => {
            if (!lastRouteCalcPositionRef.current) return true

            const distance = getDistanceMeters(
                lastRouteCalcPositionRef.current.lat,
                lastRouteCalcPositionRef.current.lng,
                currentPosition.lat,
                currentPosition.lng
            )
            return distance > 50 // Only recalculate if moved more than 50 meters
        }

        if (shouldRecalculate()) {
            console.log('[NavigationView] Recalculando ruta (cambio >50m o inicial)')
            lastRouteCalcPositionRef.current = currentPosition
            calculateRoute()
        }
    }, [currentStop, loading, currentPosition, calculateRoute])

    // Recalculate periodically
    useEffect(() => {
        const interval = setInterval(() => {
            if (currentPosition && currentStop) {
                calculateRoute()
            }
        }, 30000) // Every 30 seconds

        return () => clearInterval(interval)
    }, [calculateRoute, currentPosition, currentStop])

    // Check proximity to destination
    useEffect(() => {
        if (!currentPosition || !currentStop) return

        const distance = getDistanceMeters(
            currentPosition.lat, currentPosition.lng,
            currentStop.lat, currentStop.lng
        )

        // Within 50 meters - show arrival panel
        if (distance < 50) {
            setShowArrivalPanel(true)
            if (voiceEnabled) {
                speak(`Has llegado a ${currentStop.cliente_nombre}`, voiceEnabled)
            }
        }
    }, [currentPosition, currentStop, voiceEnabled])

    // Check proximity to current step and announce
    useEffect(() => {
        if (!currentPosition || steps.length === 0) return

        // For simplicity, announce step changes based on step index
        if (currentStepIndex !== lastSpokenStepRef.current && currentStepIndex < steps.length) {
            const step = steps[currentStepIndex]
            speak(step.instruction, voiceEnabled)
            lastSpokenStepRef.current = currentStepIndex
        }
    }, [currentStepIndex, steps, voiceEnabled])



    // Handle delivery complete
    const handleDeliveryComplete = () => {
        if (!currentStop) return

        onDeliveryComplete(currentStop.id)
        setShowArrivalPanel(false)

        // Move to next stop
        if (currentStopIndex < pendingStops.length - 1) {
            setCurrentStopIndex(prev => prev + 1)
            speak('Entrega completada. Navegando a la siguiente parada.', voiceEnabled)
        } else {
            speak('¡Felicitaciones! Has completado todas las entregas.', voiceEnabled)
            onClose()
        }
    }

    // Skip current stop
    const handleSkipStop = () => {
        if (currentStopIndex < pendingStops.length - 1) {
            setCurrentStopIndex(prev => prev + 1)
            setShowArrivalPanel(false)
            speak('Saltando parada. Navegando a la siguiente.', voiceEnabled)
        }
    }

    if (error) {
        return (
            <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="pt-6 text-center">
                        <p className="text-destructive mb-4">{error}</p>
                        <Button onClick={onClose}>Cerrar</Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (!currentStop) {
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

    return (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
            {loading && (
                <div className="absolute inset-0 z-[60] bg-background flex items-center justify-center">
                    <div className="text-center">
                        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                        <p className="text-lg font-medium">Iniciando navegación...</p>
                    </div>
                </div>
            )}

            {/* Header with current instruction */}
            <div className="bg-primary text-primary-foreground p-4 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-primary-foreground">
                        <X className="h-6 w-6" />
                    </Button>
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                        {currentStopIndex + 1} / {pendingStops.length}
                    </Badge>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setVoiceEnabled(!voiceEnabled)}
                        className="text-primary-foreground"
                    >
                        {voiceEnabled ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
                    </Button>
                </div>

                {steps.length > 0 && currentStepIndex < steps.length && (
                    <div className="flex items-center gap-4">
                        <div className="bg-primary-foreground/20 p-3 rounded-lg">
                            {getManeuverIcon(steps[currentStepIndex].maneuver)}
                        </div>
                        <div className="flex-1">
                            <p className="text-lg font-bold">{steps[currentStepIndex].instruction}</p>
                            <p className="text-sm opacity-80">{steps[currentStepIndex].distance}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Map */}
            <div ref={mapRef} className="flex-1 w-full" />

            {/* Bottom panel with destination info */}
            <div className="bg-card p-4 border-t shadow-lg">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">
                            {currentStopIndex + 1}
                        </div>
                        <div>
                            <p className="font-bold">{currentStop.cliente_nombre}</p>
                            <p className="text-sm text-muted-foreground">{currentStop.direccion || 'Sin dirección'}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-lg font-bold text-primary">{distanceToNextStop || '--'}</p>
                        <p className="text-sm text-muted-foreground">{durationToNextStop || '--'}</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    {currentStop.telefono && (
                        <Button variant="outline" size="sm" className="flex-1" asChild>
                            <a href={`tel:${currentStop.telefono}`}>
                                <Phone className="h-4 w-4 mr-2" />
                                Llamar
                            </a>
                        </Button>
                    )}
                    <Button variant="outline" size="sm" className="flex-1" onClick={handleSkipStop}>
                        Saltar
                    </Button>
                    <Button size="sm" className="flex-1" onClick={() => setShowArrivalPanel(true)}>
                        <MapPin className="h-4 w-4 mr-2" />
                        Llegué
                    </Button>
                </div>
            </div>

            {/* Arrival confirmation panel */}
            {showArrivalPanel && (
                <div className="fixed inset-0 z-60 bg-black/50 flex items-end">
                    <Card className="w-full rounded-t-3xl animate-in slide-in-from-bottom">
                        <CardContent className="pt-6 pb-8">
                            <div className="text-center mb-6">
                                <div className="bg-green-100 text-green-600 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                                    <MapPin className="h-8 w-8" />
                                </div>
                                <p className="text-xl font-bold">¿Llegaste a destino?</p>
                                <p className="text-muted-foreground">{currentStop.cliente_nombre}</p>
                            </div>

                            <div className="flex flex-col gap-3">
                                <Button
                                    className="w-full py-6 text-lg"
                                    onClick={() => router.push(`/ruta/${rutaId}/entrega/${currentStop.id}`)}
                                >
                                    <FileText className="h-5 w-5 mr-2" />
                                    Gestionar Cobro / Detalles
                                </Button>

                                <div className="flex gap-3">
                                    <Button
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => setShowArrivalPanel(false)}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        className="flex-1 bg-green-600 hover:bg-green-700"
                                        onClick={handleDeliveryComplete}
                                    >
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        Entrega Rápida
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    )
}
