'use client'

/**
 * GpsTracker Component
 * 
 * Componente para tracking GPS en tiempo real desde la PWA del repartidor
 * Envía ubicaciones cada 5 segundos al servidor
 */

import { useEffect, useRef, useState } from 'react'
import { MapPin, Navigation, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface GpsTrackerProps {
  repartidorId: string
  vehiculoId: string
  rutaId?: string
}

export default function GpsTracker({ repartidorId, vehiculoId, rutaId }: GpsTrackerProps) {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const [lastSent, setLastSent] = useState<Date | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const currentPositionRef = useRef<{ lat: number; lng: number } | null>(null)

  // Solicitar permisos de ubicación
  const startTracking = async () => {
    if (!navigator.geolocation) {
      setError('Geolocalización no está disponible en este dispositivo')
      return
    }

    try {
      // Solicitar permiso
      const permission = await navigator.permissions.query({ name: 'geolocation' })
      if (permission.state === 'denied') {
        setError('Permisos de ubicación denegados. Por favor, habilítalos en la configuración del navegador.')
        return
      }

      setIsTracking(true)
      setError(null)

      // Obtener posición inicial
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const currentPos = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setPosition(currentPos)
          currentPositionRef.current = currentPos
          sendLocation(currentPos.lat, currentPos.lng)
        },
        (err) => {
          setError(`Error al obtener ubicación: ${err.message}`)
          setIsTracking(false)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      )

      // Iniciar watchPosition para actualizaciones continuas
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const currentPos = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setPosition(currentPos)
          currentPositionRef.current = currentPos
        },
        (err) => {
          console.error('Error en watchPosition:', err)
          setError(`Error al rastrear ubicación: ${err.message}`)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000 // Usar posición de máximo 5 segundos de antigüedad
        }
      )

      // Enviar ubicación cada 5 segundos usando la ref para evitar problemas de closure
      intervalRef.current = setInterval(() => {
        if (currentPositionRef.current) {
          sendLocation(currentPositionRef.current.lat, currentPositionRef.current.lng)
        }
      }, 5000)
    } catch (err: any) {
      setError(`Error al iniciar tracking: ${err.message}`)
      setIsTracking(false)
    }
  }

  // Detener tracking
  const stopTracking = () => {
    if (watchIdRef.current !== null) {
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

  // Enviar ubicación al servidor
  const sendLocation = async (lat: number, lng: number) => {
    try {
      const response = await fetch('/api/reparto/ubicacion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          repartidorId,
          vehiculoId,
          lat,
          lng
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error al enviar ubicación')
      }

      setLastSent(new Date())
    } catch (err: any) {
      console.error('Error al enviar ubicación:', err)
      setError(`Error al enviar ubicación: ${err.message}`)
    }
  }

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      stopTracking()
    }
  }, [])

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
            <Button onClick={startTracking} className="w-full">
              <Navigation className="mr-2 h-4 w-4" />
              Iniciar Tracking
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

