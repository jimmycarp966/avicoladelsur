'use client'

/**
 * GpsTracker Component
 *
 * Tracking GPS en tiempo real desde la PWA del repartidor.
 * Envía ubicaciones cada 5 segundos y guarda una cola mínima local
 * para reintentar cuando vuelve la conexión.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Loader2, MapPin, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface GpsTrackerProps {
  repartidorId: string
  vehiculoId: string
  rutaId?: string
  compact?: boolean
  autoStart?: boolean
}

type GPSPoint = {
  lat: number
  lng: number
  timestamp: number
}

const MAX_QUEUE_POINTS = 100

export default function GpsTracker({
  repartidorId,
  vehiculoId,
  rutaId,
  compact = false,
  autoStart = false,
}: GpsTrackerProps) {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [lastSent, setLastSent] = useState<Date | null>(null)

  const watchIdRef = useRef<number | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const currentPositionRef = useRef<GPSPoint | null>(null)
  const flushInProgressRef = useRef(false)
  const autoStartTriggeredRef = useRef(false)

  const queueStorageKey = `gps-queue:${repartidorId}:${vehiculoId}:${rutaId || 'sin-ruta'}`

  const readQueue = useCallback((): GPSPoint[] => {
    if (typeof window === 'undefined') return []

    try {
      const raw = window.localStorage.getItem(queueStorageKey)
      if (!raw) return []

      const parsed = JSON.parse(raw)
      return Array.isArray(parsed)
        ? parsed.filter((item) => (
          item &&
          Number.isFinite(item.lat) &&
          Number.isFinite(item.lng) &&
          Number.isFinite(item.timestamp)
        ))
        : []
    } catch (error) {
      console.warn('[GpsTracker] No se pudo leer la cola local:', error)
      return []
    }
  }, [queueStorageKey])

  const writeQueue = useCallback((queue: GPSPoint[]) => {
    if (typeof window === 'undefined') return

    try {
      const limitedQueue = queue.slice(-MAX_QUEUE_POINTS)
      window.localStorage.setItem(queueStorageKey, JSON.stringify(limitedQueue))
    } catch (error) {
      console.warn('[GpsTracker] No se pudo guardar la cola local:', error)
    }
  }, [queueStorageKey])

  const enqueueLocation = useCallback((point: GPSPoint) => {
    const queue = readQueue()
    queue.push(point)
    writeQueue(queue)
  }, [readQueue, writeQueue])

  const postLocation = useCallback(async (point: GPSPoint) => {
    const response = await fetch('/api/reparto/ubicacion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        repartidorId,
        vehiculoId,
        rutaId,
        lat: point.lat,
        lng: point.lng,
      }),
    })

    if (!response.ok) {
      let message = 'Error al enviar ubicación'

      try {
        const data = await response.json()
        message = data?.error || data?.message || message
      } catch {
        const text = await response.text().catch(() => '')
        if (text) message = text
      }

      throw new Error(message)
    }
  }, [repartidorId, rutaId, vehiculoId])

  const flushQueue = useCallback(async () => {
    if (typeof window === 'undefined' || flushInProgressRef.current) {
      return
    }

    if (!navigator.onLine) {
      return
    }

    const queue = readQueue()
    if (queue.length === 0) {
      return
    }

    flushInProgressRef.current = true

    try {
      const pending = [...queue]

      while (pending.length > 0) {
        const point = pending[0]

        try {
          await postLocation(point)
          pending.shift()
          setLastSent(new Date(point.timestamp))
          setError(null)
        } catch (error: any) {
          console.warn('[GpsTracker] Reintento de cola interrumpido:', error)
          break
        }
      }

      writeQueue(pending)
    } finally {
      flushInProgressRef.current = false
    }
  }, [postLocation, readQueue, writeQueue])

  const sendOrQueueLocation = useCallback(async (point: GPSPoint) => {
    if (!repartidorId || !vehiculoId) {
      return
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      enqueueLocation(point)
      setError('Sin conexión. Las ubicaciones quedan en cola para reintento.')
      return
    }

    try {
      await postLocation(point)
      setLastSent(new Date(point.timestamp))
      setError(null)
      void flushQueue()
    } catch (error: any) {
      enqueueLocation(point)
      setError(`Se guardó la ubicación para reintento: ${error?.message || 'error de red'}`)
    }
  }, [enqueueLocation, flushQueue, postLocation, repartidorId, vehiculoId])

  const handlePosition = useCallback((pos: GeolocationPosition) => {
    const currentPos: GPSPoint = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      timestamp: pos.timestamp,
    }

    currentPositionRef.current = currentPos
    setPosition({ lat: currentPos.lat, lng: currentPos.lng })
    setError(null)
    setIsStarting(false)

    return currentPos
  }, [])

  const handleGeoError = useCallback((err: GeolocationPositionError) => {
    let message = 'Error de geolocalización'

    switch (err.code) {
      case err.PERMISSION_DENIED:
        message = 'Permisos de ubicación denegados. Habilítalos en la configuración del navegador.'
        break
      case err.POSITION_UNAVAILABLE:
        message = 'Ubicación no disponible. Verifica el GPS del dispositivo.'
        break
      case err.TIMEOUT:
        message = 'Tiempo de espera agotado. Reintentando...'
        break
    }

    setError(message)
    setIsStarting(false)

    if (err.code === err.PERMISSION_DENIED) {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }

      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }

      setIsTracking(false)
      currentPositionRef.current = null
    }
  }, [])

  const startTracking = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setError('Geolocalización no está disponible en este dispositivo')
      return
    }

    if (isTracking || isStarting) {
      return
    }

    setIsStarting(true)

    try {
      if (navigator.permissions) {
        try {
          const permission = await navigator.permissions.query({ name: 'geolocation' })
          if (permission.state === 'denied') {
            setError('Permisos de ubicación denegados. Habilítalos en la configuración del navegador.')
            setIsStarting(false)
            return
          }
        } catch {
          // Algunos navegadores no soportan permissions.query
        }
      }

      setIsTracking(true)
      setError(null)

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const currentPos = handlePosition(pos)
          void sendOrQueueLocation(currentPos)
        },
        handleGeoError,
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        },
      )

      watchIdRef.current = navigator.geolocation.watchPosition(
        handlePosition,
        handleGeoError,
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000,
        },
      )

      intervalRef.current = setInterval(() => {
        if (currentPositionRef.current) {
          void sendOrQueueLocation(currentPositionRef.current)
        }
      }, 5000)
    } catch (err: any) {
      setError(`Error al iniciar tracking: ${err.message}`)
      setIsStarting(false)
      setIsTracking(false)
    }
  }, [handleGeoError, handlePosition, isStarting, isTracking, sendOrQueueLocation])

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    setIsTracking(false)
    setIsStarting(false)
    currentPositionRef.current = null
  }, [])

  useEffect(() => {
    const handleOnline = () => {
      void flushQueue()
    }

    window.addEventListener('online', handleOnline)
    void flushQueue()

    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [flushQueue])

  useEffect(() => {
    if (!autoStart || autoStartTriggeredRef.current || !repartidorId || !vehiculoId) {
      return
    }

    autoStartTriggeredRef.current = true
    void startTracking()
  }, [autoStart, repartidorId, startTracking, vehiculoId])

  useEffect(() => {
    return () => {
      stopTracking()
    }
  }, [stopTracking])

  if (compact) {
    return (
      <div className="bg-white rounded-full shadow-lg p-2 flex items-center gap-2">
        {!isTracking ? (
          <Button
            size="sm"
            onClick={() => void startTracking()}
            disabled={isStarting}
            className="rounded-full h-10 w-10 p-0"
            title="Iniciar Tracking GPS"
          >
            {isStarting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Navigation className="h-5 w-5" />}
          </Button>
        ) : (
          <>
            <Badge variant="default" className="bg-green-500 animate-pulse">
              <Navigation className="h-3 w-3 mr-1" />
              GPS
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={stopTracking}
              className="rounded-full h-8 w-8 p-0"
              title="Detener Tracking"
            >
              <span className="sr-only">Detener</span>
              ×
            </Button>
          </>
        )}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Navigation className="h-5 w-5" />
          Tracking GPS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {position && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Ubicación actual:</span>
            </div>
            <div className="pl-6 text-sm text-muted-foreground">
              <p>Lat: {position.lat.toFixed(6)}</p>
              <p>Lng: {position.lng.toFixed(6)}</p>
            </div>
          </div>
        )}

        {lastSent && (
          <div className="text-xs text-muted-foreground">
            Última ubicación enviada: {lastSent.toLocaleTimeString()}
          </div>
        )}

        <div className="flex items-center gap-2">
          {!isTracking ? (
            <Button onClick={() => void startTracking()} className="w-full" disabled={isStarting}>
              {isStarting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando...
                </>
              ) : (
                <>
                  <Navigation className="mr-2 h-4 w-4" />
                  Iniciar Tracking
                </>
              )}
            </Button>
          ) : (
            <>
              <Button onClick={stopTracking} variant="destructive" className="flex-1">
                Detener Tracking
              </Button>
              <Badge variant="default" className="bg-success">
                Activo
              </Badge>
            </>
          )}
        </div>

        {isTracking && (
          <p className="text-xs text-muted-foreground text-center">
            Enviando ubicación cada 5 segundos...
          </p>
        )}
      </CardContent>
    </Card>
  )
}
