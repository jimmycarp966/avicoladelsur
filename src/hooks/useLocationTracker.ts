'use client'

/**
 * useLocationTracker Hook
 * 
 * Hook para tracking GPS continuo desde que se monta el componente.
 * Diseñado para la vista del repartidor para tener ubicación disponible
 * antes de iniciar la navegación.
 * 
 * Features:
 * - Inicia tracking automáticamente al montarse
 * - Mantiene estado de ubicación actualizado
 * - Indica si la ubicación es confiable (isReady)
 * - Envía ubicación a Supabase vía API para Realtime
 */

import { useEffect, useRef, useState, useCallback } from 'react'

interface LocationState {
    lat: number
    lng: number
    accuracy?: number
    timestamp: number
}

interface UseLocationTrackerOptions {
    /** Intervalo en ms para enviar ubicación al servidor. Default: 5000 */
    sendInterval?: number
    /** Habilitar alta precisión GPS. Default: true */
    highAccuracy?: boolean
    /** Iniciar tracking automáticamente. Default: true */
    autoStart?: boolean
    /** ID del repartidor para enviar ubicación al servidor */
    repartidorId?: string
    /** ID del vehículo */
    vehiculoId?: string
    /** ID de la ruta activa */
    rutaId?: string
}

interface UseLocationTrackerReturn {
    /** Ubicación actual */
    location: { lat: number; lng: number } | null
    /** Precisión en metros */
    accuracy: number | null
    /** Error de geolocalización */
    error: string | null
    /** Si está cargando la primera ubicación */
    isLoading: boolean
    /** Si la ubicación está lista y es confiable (accuracy < 100m) */
    isReady: boolean
    /** Si el tracking está activo */
    isTracking: boolean
    /** Última vez que se envió al servidor */
    lastSent: Date | null
    /** Iniciar tracking manualmente */
    startTracking: () => Promise<void>
    /** Detener tracking */
    stopTracking: () => void
    /** Obtener ubicación actual (promesa) */
    getCurrentPosition: () => Promise<{ lat: number; lng: number }>
}

export function useLocationTracker(options: UseLocationTrackerOptions = {}): UseLocationTrackerReturn {
    const {
        sendInterval = 5000,
        highAccuracy = true,
        autoStart = true,
        repartidorId,
        vehiculoId,
        rutaId
    } = options

    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
    const [accuracy, setAccuracy] = useState<number | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isTracking, setIsTracking] = useState(false)
    const [lastSent, setLastSent] = useState<Date | null>(null)

    const watchIdRef = useRef<number | null>(null)
    const sendIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const currentLocationRef = useRef<LocationState | null>(null)

    // Enviar ubicación al servidor
    const sendLocationToServer = useCallback(async (lat: number, lng: number) => {
        if (!repartidorId || !vehiculoId) return

        try {
            const response = await fetch('/api/reparto/ubicacion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    repartidorId,
                    vehiculoId,
                    rutaId,
                    lat,
                    lng
                })
            })

            if (response.ok) {
                setLastSent(new Date())
            }
        } catch (err) {
            console.error('[useLocationTracker] Error enviando ubicación:', err)
        }
    }, [repartidorId, vehiculoId, rutaId])

    // Manejar actualización de posición
    const handlePositionUpdate = useCallback((position: GeolocationPosition) => {
        const newLocation: LocationState = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
        }

        currentLocationRef.current = newLocation
        setLocation({ lat: newLocation.lat, lng: newLocation.lng })
        setAccuracy(newLocation.accuracy || null)
        setIsLoading(false)
        setError(null)

        // Debug siempre visible
        console.log('%c[useLocationTracker] ✅ Ubicación actualizada:', 'color: green; font-weight: bold', {
            lat: newLocation.lat.toFixed(6),
            lng: newLocation.lng.toFixed(6),
            accuracy: newLocation.accuracy?.toFixed(0) + 'm',
            timestamp: new Date(newLocation.timestamp).toLocaleTimeString()
        })
    }, [])

    // Manejar error de geolocalización
    const handlePositionError = useCallback((err: GeolocationPositionError) => {
        setIsLoading(false)
        let errorMessage = 'Error de geolocalización'

        switch (err.code) {
            case err.PERMISSION_DENIED:
                errorMessage = 'Permisos de ubicación denegados. Habilítalos en la configuración.'
                break
            case err.POSITION_UNAVAILABLE:
                errorMessage = 'Ubicación no disponible. Verifica tu GPS.'
                break
            case err.TIMEOUT:
                errorMessage = 'Tiempo de espera agotado. Reintentando...'
                break
        }

        setError(errorMessage)
        console.error('[useLocationTracker] Error:', errorMessage)
    }, [])

    // Iniciar tracking
    const startTracking = useCallback(async () => {
        if (typeof window === 'undefined' || !navigator.geolocation) {
            setError('Geolocalización no disponible en este navegador')
            setIsLoading(false)
            return
        }

        // Verificar permisos primero
        try {
            const permission = await navigator.permissions.query({ name: 'geolocation' })
            if (permission.state === 'denied') {
                setError('Permisos de ubicación denegados. Habilítalos en configuración.')
                setIsLoading(false)
                return
            }
        } catch (e) {
            // Algunos navegadores no soportan permissions.query, continuar de todos modos
        }

        setIsTracking(true)
        setIsLoading(true)
        console.log('%c[useLocationTracker] 📡 Iniciando tracking GPS...', 'color: blue; font-weight: bold')

        // Obtener posición inicial
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                console.log('%c[useLocationTracker] 📍 getCurrentPosition exitoso:', 'color: green', {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy
                })
                handlePositionUpdate(pos)
            },
            (err) => {
                console.error('%c[useLocationTracker] ❌ getCurrentPosition error:', 'color: red', err.message)
                handlePositionError(err)
            },
            {
                enableHighAccuracy: highAccuracy,
                timeout: 15000,
                maximumAge: 0
            }
        )

        // Iniciar watchPosition para actualizaciones continuas
        watchIdRef.current = navigator.geolocation.watchPosition(
            handlePositionUpdate,
            handlePositionError,
            {
                enableHighAccuracy: highAccuracy,
                timeout: 15000,
                maximumAge: 3000
            }
        )

        // Enviar ubicación periódicamente al servidor
        if (repartidorId && vehiculoId) {
            sendIntervalRef.current = setInterval(() => {
                if (currentLocationRef.current) {
                    sendLocationToServer(
                        currentLocationRef.current.lat,
                        currentLocationRef.current.lng
                    )
                }
            }, sendInterval)
        }
    }, [handlePositionUpdate, handlePositionError, highAccuracy, sendInterval, repartidorId, vehiculoId, sendLocationToServer])

    // Detener tracking
    const stopTracking = useCallback(() => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current)
            watchIdRef.current = null
        }
        if (sendIntervalRef.current) {
            clearInterval(sendIntervalRef.current)
            sendIntervalRef.current = null
        }
        setIsTracking(false)
    }, [])

    // Obtener ubicación actual (promesa)
    const getCurrentPosition = useCallback((): Promise<{ lat: number; lng: number }> => {
        return new Promise((resolve, reject) => {
            // Si ya tenemos ubicación reciente, devolverla
            if (currentLocationRef.current) {
                const age = Date.now() - currentLocationRef.current.timestamp
                if (age < 10000) { // Menos de 10 segundos
                    resolve({
                        lat: currentLocationRef.current.lat,
                        lng: currentLocationRef.current.lng
                    })
                    return
                }
            }

            // Solicitar nueva ubicación
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    resolve({
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude
                    })
                },
                (err) => {
                    reject(new Error(`Error GPS: ${err.message}`))
                },
                {
                    enableHighAccuracy: highAccuracy,
                    timeout: 10000,
                    maximumAge: 5000
                }
            )
        })
    }, [highAccuracy])

    // Auto-iniciar tracking al montar
    useEffect(() => {
        if (autoStart) {
            startTracking()
        }

        return () => {
            stopTracking()
        }
    }, [autoStart, startTracking, stopTracking])

    // Calcular si está listo (ubicación confiable)
    const isReady = !isLoading && location !== null && (accuracy === null || accuracy < 100)

    return {
        location,
        accuracy,
        error,
        isLoading,
        isReady,
        isTracking,
        lastSent,
        startTracking,
        stopTracking,
        getCurrentPosition
    }
}
