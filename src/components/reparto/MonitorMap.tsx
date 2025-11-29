'use client'

/**
 * MonitorMap Component
 * 
 * Mapa Google Maps para visualizar vehículos en tiempo real, rutas planificadas y alertas
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { AlertCircle, Truck, Loader2, RefreshCw, Pause, Play } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface UbicacionVehiculo {
  vehiculo_id: string
  repartidor_id: string
  repartidor_nombre: string
  lat: number
  lng: number
  created_at: string
  ruta_activa_id?: string
  ruta_numero?: string
}

interface Alerta {
  id: string
  tipo: string
  descripcion: string
  lat?: number
  lng?: number
  created_at: string
}

interface MonitorMapProps {
  zonaId?: string
  fecha?: string
}

declare global {
  interface Window {
    google: any
  }
}

// Tipos para Google Maps (usando any ya que se carga dinámicamente)
type GoogleMap = any
type GoogleMarker = any
type GooglePolyline = any
type GoogleInfoWindow = any
type GoogleLatLng = any
type GoogleLatLngBounds = any

export default function MonitorMap({ zonaId, fecha }: MonitorMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<GoogleMap | null>(null)
  const markersRef = useRef<Map<string, GoogleMarker>>(new Map())
  const polylinesRef = useRef<Map<string, GooglePolyline>>(new Map())
  const infoWindowsRef = useRef<Map<string, GoogleInfoWindow>>(new Map())
  
  const [ubicaciones, setUbicaciones] = useState<UbicacionVehiculo[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [rutas, setRutas] = useState<Map<string, { polyline: string; ordenVisita: any[] }>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mapsLoaded, setMapsLoaded] = useState(false)
  const [isPollingPaused, setIsPollingPaused] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [isPageHidden, setIsPageHidden] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Cargar ubicaciones y alertas
  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (fecha) params.append('fecha', fecha)
      if (zonaId) params.append('zona_id', zonaId)

      const [ubicacionesRes, alertasRes] = await Promise.all([
        fetch(`/api/reparto/ubicaciones?${params.toString()}`),
        fetch(`/api/reparto/alertas?${params.toString()}`)
      ])

      // Manejar ubicaciones
      let ubicacionesData: any = { success: false, data: [] }
      if (ubicacionesRes.ok) {
        try {
          ubicacionesData = await ubicacionesRes.json()
        } catch (e) {
          console.warn('[MonitorMap] Error parseando respuesta de ubicaciones:', e)
        }
      } else {
        console.warn('[MonitorMap] Error en respuesta de ubicaciones:', ubicacionesRes.status, ubicacionesRes.statusText)
      }

      // Manejar alertas
      let alertasData: any = { success: false, data: [] }
      if (alertasRes.ok) {
        try {
          alertasData = await alertasRes.json()
        } catch (e) {
          console.warn('[MonitorMap] Error parseando respuesta de alertas:', e)
        }
      } else {
        console.warn('[MonitorMap] Error en respuesta de alertas:', alertasRes.status, alertasRes.statusText)
      }

      // Solo establecer error si ambas peticiones fallaron completamente
      if (!ubicacionesRes.ok && !alertasRes.ok) {
        throw new Error('No se pudieron cargar los datos del monitor')
      }

      if (ubicacionesData.success) {
        setUbicaciones(ubicacionesData.data || [])
        console.log('[MonitorMap] Ubicaciones recibidas:', ubicacionesData.data?.length || 0)
      } else {
        setUbicaciones([])
        console.warn('[MonitorMap] No se pudieron cargar ubicaciones:', ubicacionesData.error)
      }

      if (alertasData.success) {
        setAlertas(alertasData.data || [])
      } else {
        setAlertas([])
      }

      // Cargar polilíneas de rutas activas
      const rutasActivas = new Set(
        ubicacionesData.data
          ?.filter((u: UbicacionVehiculo) => u.ruta_activa_id)
          .map((u: UbicacionVehiculo) => u.ruta_activa_id)
      )
      
      console.log('[MonitorMap] Rutas activas desde ubicaciones:', rutasActivas.size)
      
      // Si no hay rutas activas desde ubicaciones, cargar rutas planificadas directamente
      if (rutasActivas.size === 0) {
        try {
          const fechaParam = fecha || new Date().toISOString().split('T')[0]
          const rutasRes = await fetch(`/api/reparto/rutas-activas?fecha=${fechaParam}${zonaId ? `&zona_id=${zonaId}` : ''}`)
          if (rutasRes.ok) {
            const rutasData = await rutasRes.json()
            if (rutasData.success && rutasData.data && Array.isArray(rutasData.data)) {
              rutasData.data.forEach((ruta: any) => {
                if (ruta.id) {
                  rutasActivas.add(ruta.id)
                }
              })
              console.log('[MonitorMap] Rutas activas cargadas desde endpoint alternativo:', rutasActivas.size, rutasData.data)
            }
          } else {
            console.warn('[MonitorMap] Error al cargar rutas activas:', rutasRes.status, rutasRes.statusText)
          }
        } catch (err) {
          console.warn('[MonitorMap] Error al cargar rutas activas alternativas:', err)
        }
      }

      const rutasMap = new Map()
      for (const rutaId of rutasActivas) {
        try {
          const rutaRes = await fetch(`/api/rutas/${rutaId}/recorrido`)
          if (rutaRes.ok) {
            const rutaData = await rutaRes.json()
            if (rutaData.success && rutaData.data.polyline) {
              rutasMap.set(rutaId, {
                polyline: rutaData.data.polyline,
                ordenVisita: rutaData.data.ordenVisita || []
              })
              console.log(`[MonitorMap] Ruta ${rutaId} cargada con polyline`)
            } else {
              console.warn(`[MonitorMap] Ruta ${rutaId} sin polyline:`, rutaData)
            }
          } else {
            console.warn(`[MonitorMap] Error al cargar ruta ${rutaId}:`, rutaRes.status)
          }
        } catch (err) {
          console.error(`[MonitorMap] Error al cargar ruta ${rutaId}:`, err)
        }
      }
      
      console.log('[MonitorMap] Total rutas con polyline:', rutasMap.size)
      setRutas(rutasMap)

      setLoading(false)
      setError(null)
      setLastUpdate(new Date())
    } catch (err: any) {
      console.error('[MonitorMap] Error al cargar datos del monitor:', err)
      // Solo mostrar error si es un error crítico, no si simplemente no hay datos
      if (err.message && err.message.includes('No se pudieron cargar')) {
        setError(err.message)
      } else {
        // Si es otro tipo de error, solo loguearlo pero no mostrar mensaje al usuario
        setError(null)
      }
      setLoading(false)
    }
  }, [zonaId, fecha])

  // Calcular intervalo de polling adaptativo
  const getPollingInterval = useCallback(() => {
    // Si no hay vehículos activos, polling más lento (60s)
    if (ubicaciones.length === 0) {
      return 60000 // 60 segundos
    }
    // Si hay 1-2 vehículos, polling moderado (15s)
    if (ubicaciones.length <= 2) {
      return 15000 // 15 segundos
    }
    // Si hay 3+ vehículos, polling más frecuente (10s)
    return 10000 // 10 segundos
  }, [ubicaciones.length])

  // Rastrear estado de visibilidad de la página
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    const handleVisibilityChange = () => {
      setIsPageHidden(document.visibilityState === 'hidden')
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    setIsPageHidden(document.visibilityState === 'hidden')

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Polling optimizado con Page Visibility API y adaptativo
  useEffect(() => {
    // Cargar datos iniciales
    fetchData()

    let currentInterval = getPollingInterval()

    const startPolling = () => {
      // Limpiar intervalo anterior si existe
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }

      currentInterval = getPollingInterval()
      
      intervalRef.current = setInterval(() => {
        // Solo hacer polling si la pestaña está visible y no está pausado
        if (!isPollingPaused && typeof document !== 'undefined' && document.visibilityState === 'visible') {
          fetchData()
        }
      }, currentInterval)
    }

    startPolling()

    // Manejar cambios de visibilidad de la pestaña
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && !isPollingPaused) {
        // Cuando vuelve a estar visible, actualizar inmediatamente y reiniciar polling
        fetchData()
        startPolling()
      }
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }

    // Reiniciar polling cuando cambia la cantidad de vehículos (ajustar intervalo)
    const checkInterval = setInterval(() => {
      const newInterval = getPollingInterval()
      // Si el intervalo cambió, reiniciar polling
      if (newInterval !== currentInterval) {
        startPolling()
      }
    }, 5000) // Verificar cada 5 segundos si necesita ajustar

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (checkInterval) {
        clearInterval(checkInterval)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [zonaId, fecha, isPollingPaused, getPollingInterval, fetchData])

  // Función para actualización manual
  const handleManualRefresh = useCallback(() => {
    fetchData()
  }, [fetchData])

  // Parsear polyline simple (formato: "lat1,lng1;lat2,lng2;...")
  const parsePolyline = useCallback((polyline: string): GoogleLatLng[] => {
    if (!polyline || !window.google || !window.google.maps || !window.google.maps.LatLng) return []
    return polyline.split(';').map(p => {
      const coords = p.split(',')
      if (coords.length >= 2) {
        const lat = parseFloat(coords[0])
        const lng = parseFloat(coords[1])
        if (!isNaN(lat) && !isNaN(lng)) {
          return new window.google.maps.LatLng(lat, lng)
        }
      }
      return null
    }).filter((point): point is GoogleLatLng => point !== null)
  }, [])

  // Crear icono personalizado para vehículos (verde)
  const createTruckIcon = useCallback((): any => {
    if (!window.google || !window.google.maps || !window.google.maps.Size || !window.google.maps.Point) return undefined
    
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#2d6a4f">
          <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
        </svg>
      `),
      scaledSize: new window.google.maps.Size(32, 32),
      anchor: new window.google.maps.Point(16, 32)
    }
  }, [])

  // Crear icono personalizado para alertas (rojo)
  const createAlertIcon = useCallback((): any => {
    if (!window.google || !window.google.maps || !window.google.maps.Size || !window.google.maps.Point) return undefined
    
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#dc2626">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
      `),
      scaledSize: new window.google.maps.Size(32, 32),
      anchor: new window.google.maps.Point(16, 32)
    }
  }, [])

  // Inicializar mapa
  const initializeMap = useCallback(() => {
    if (!window.google || !window.google.maps || !window.google.maps.Map || !mapRef.current || mapInstanceRef.current) {
      return
    }

    try {
      const defaultCenter = ubicaciones.length > 0
        ? { lat: ubicaciones[0].lat, lng: ubicaciones[0].lng }
        : { lat: -27.1671, lng: -65.4995 } // Monteros, Tucumán

      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: defaultCenter,
        zoom: ubicaciones.length > 0 ? 13 : 10,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
      })

      console.log('[MonitorMap] Mapa inicializado correctamente')
    } catch (err) {
      console.error('[MonitorMap] Error inicializando mapa:', err)
      setError('Error al inicializar el mapa')
    }
  }, [ubicaciones])

  // Actualizar marcadores y polilíneas
  const updateMapElements = useCallback(() => {
    if (!mapInstanceRef.current || !window.google || !window.google.maps || !window.google.maps.Marker || !window.google.maps.Polyline || !window.google.maps.InfoWindow || !window.google.maps.LatLng || !window.google.maps.LatLngBounds) return

    // Limpiar marcadores y polilíneas anteriores
    markersRef.current.forEach(marker => marker.setMap(null))
    polylinesRef.current.forEach(polyline => polyline.setMap(null))
    infoWindowsRef.current.forEach(infoWindow => infoWindow.close())
    
    markersRef.current.clear()
    polylinesRef.current.clear()
    infoWindowsRef.current.clear()

    const bounds = new window.google.maps.LatLngBounds()
    let hasPoints = false

    // Agregar marcadores de vehículos
    ubicaciones.forEach((ubicacion) => {
      const position = new window.google.maps.LatLng(ubicacion.lat, ubicacion.lng)
      bounds.extend(position)
      hasPoints = true

      const marker = new window.google.maps.Marker({
        position,
        map: mapInstanceRef.current,
        icon: createTruckIcon(),
        title: ubicacion.repartidor_nombre
      })

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; min-width: 150px;">
            <p style="font-weight: 600; margin: 0 0 4px 0;">${ubicacion.repartidor_nombre}</p>
            <p style="font-size: 12px; color: #666; margin: 0 0 4px 0;">
              ${ubicacion.ruta_numero || 'Sin ruta activa'}
            </p>
            <p style="font-size: 11px; color: #999; margin: 0;">
              ${new Date(ubicacion.created_at).toLocaleTimeString()}
            </p>
          </div>
        `
      })

      marker.addListener('click', () => {
        // Cerrar otros infowindows
        infoWindowsRef.current.forEach(iw => iw.close())
        infoWindow.open(mapInstanceRef.current, marker)
      })

      markersRef.current.set(`vehiculo-${ubicacion.vehiculo_id}`, marker)
      infoWindowsRef.current.set(`vehiculo-${ubicacion.vehiculo_id}`, infoWindow)
    })

    // Agregar polilíneas de rutas
    Array.from(rutas.entries()).forEach(([rutaId, ruta]) => {
      const path = parsePolyline(ruta.polyline)
      if (path.length === 0) return

      path.forEach(point => bounds.extend(point))
      hasPoints = true

      const polyline = new window.google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: '#2d6a4f',
        strokeOpacity: 0.7,
        strokeWeight: 3,
        map: mapInstanceRef.current
      })

      polylinesRef.current.set(`ruta-${rutaId}`, polyline)
    })

    // Agregar marcadores de alertas
    alertas
      .filter(a => a.lat && a.lng)
      .forEach((alerta) => {
        const position = new window.google.maps.LatLng(alerta.lat!, alerta.lng!)
        bounds.extend(position)
        hasPoints = true

        const marker = new window.google.maps.Marker({
          position,
          map: mapInstanceRef.current,
          icon: createAlertIcon(),
          title: alerta.tipo
        })

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 8px; min-width: 180px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="color: #dc2626; font-size: 16px;">⚠</span>
                <p style="font-weight: 600; margin: 0; text-transform: capitalize;">${alerta.tipo}</p>
              </div>
              <p style="font-size: 12px; color: #666; margin: 0 0 4px 0;">${alerta.descripcion}</p>
              <p style="font-size: 11px; color: #999; margin: 0;">
                ${new Date(alerta.created_at).toLocaleString()}
              </p>
            </div>
          `
        })

        marker.addListener('click', () => {
          infoWindowsRef.current.forEach(iw => iw.close())
          infoWindow.open(mapInstanceRef.current, marker)
        })

        markersRef.current.set(`alerta-${alerta.id}`, marker)
        infoWindowsRef.current.set(`alerta-${alerta.id}`, infoWindow)
      })

    // Ajustar vista para mostrar todos los puntos
    if (hasPoints && mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(bounds)
      // Asegurar un zoom mínimo
      const listener = window.google.maps.event.addListener(mapInstanceRef.current, 'bounds_changed', () => {
        if (mapInstanceRef.current && mapInstanceRef.current.getZoom() && mapInstanceRef.current.getZoom()! > 15) {
          mapInstanceRef.current.setZoom(15)
        }
        window.google.maps.event.removeListener(listener)
      })
    }
  }, [ubicaciones, rutas, alertas, parsePolyline, createTruckIcon, createAlertIcon])

  // Efecto para inicializar mapa cuando Google Maps está disponible
  useEffect(() => {
    let timeoutId: NodeJS.Timeout
    let retryCount = 0
    const maxRetries = 30

    const checkGoogleMaps = () => {
      if (
        window.google && 
        window.google.maps && 
        window.google.maps.Map &&
        window.google.maps.Marker &&
        window.google.maps.Polyline &&
        window.google.maps.InfoWindow &&
        window.google.maps.LatLng &&
        window.google.maps.LatLngBounds
      ) {
        if (!mapsLoaded) {
          setMapsLoaded(true)
          // Pequeño delay para asegurar que todo esté listo
          setTimeout(() => {
            initializeMap()
          }, 100)
        }
        return true
      }
      return false
    }

    const checkGoogleMapsLoop = () => {
      if (checkGoogleMaps()) return

      if (retryCount < maxRetries) {
        retryCount++
        timeoutId = setTimeout(checkGoogleMapsLoop, 500)
      } else {
        console.error('[MonitorMap] Google Maps API failed to load')
        setError('Google Maps no se pudo cargar')
        setLoading(false)
      }
    }

    const handleGoogleMapsLoaded = () => {
      if (!mapsLoaded) {
        // Pequeño delay para asegurar que todo esté listo
        setTimeout(() => {
          if (
            window.google && 
            window.google.maps && 
            window.google.maps.Map &&
            window.google.maps.Marker &&
            window.google.maps.Polyline &&
            window.google.maps.InfoWindow &&
            window.google.maps.LatLng &&
            window.google.maps.LatLngBounds
          ) {
            setMapsLoaded(true)
            initializeMap()
          }
        }, 100)
      }
    }

    window.addEventListener('google-maps-loaded', handleGoogleMapsLoaded)

    const initialDelay = setTimeout(() => {
      if (!window.google) {
        setError('Google Maps script no se cargó')
        setLoading(false)
        return
      }
      checkGoogleMapsLoop()
    }, 1000)

    return () => {
      clearTimeout(initialDelay)
      if (timeoutId) clearTimeout(timeoutId)
      window.removeEventListener('google-maps-loaded', handleGoogleMapsLoaded)
    }
  }, [initializeMap, mapsLoaded])

  // Actualizar elementos del mapa cuando cambian los datos
  useEffect(() => {
    if (mapInstanceRef.current && mapsLoaded) {
      updateMapElements()
    }
  }, [updateMapElements, mapsLoaded])

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      markersRef.current.forEach(marker => marker.setMap(null))
      polylinesRef.current.forEach(polyline => polyline.setMap(null))
      infoWindowsRef.current.forEach(infoWindow => infoWindow.close())
    }
  }, [])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Monitor de Reparto en Tiempo Real
            </CardTitle>
            <div className="flex items-center gap-2">
              {lastUpdate && !loading && (
                <Badge variant="outline" className="text-xs">
                  Actualizado: {lastUpdate.toLocaleTimeString()}
                </Badge>
              )}
              <Badge variant={loading ? 'secondary' : 'default'}>
                {loading ? 'Cargando...' : `${ubicaciones.length} vehículos activos`}
              </Badge>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualRefresh}
                disabled={loading}
                className="h-8"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                Actualizar ahora
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPollingPaused(!isPollingPaused)}
                className="h-8"
              >
                {isPollingPaused ? (
                  <>
                    <Play className="h-3.5 w-3.5 mr-1.5" />
                    Reanudar
                  </>
                ) : (
                  <>
                    <Pause className="h-3.5 w-3.5 mr-1.5" />
                    Pausar
                  </>
                )}
              </Button>
            </div>
            {isPollingPaused && (
              <Badge variant="secondary" className="text-xs">
                Polling pausado
              </Badge>
            )}
            {isPageHidden && !isPollingPaused && (
              <Badge variant="secondary" className="text-xs">
                Pestaña oculta - polling pausado
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md">
              {error}
            </div>
          )}

          <div className="h-[400px] sm:h-[500px] lg:h-[600px] w-full rounded-lg overflow-hidden border relative">
            {(!mapsLoaded || loading) && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {!mapsLoaded ? 'Cargando Google Maps...' : 'Cargando datos...'}
                </div>
              </div>
            )}
            <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
          </div>

          {/* Panel de alertas */}
          {alertas.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold mb-2">Alertas Recientes</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {alertas.slice(0, 5).map((alerta) => (
                  <div
                    key={alerta.id}
                    className="p-2 border rounded-md flex items-start gap-2"
                  >
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium capitalize">{alerta.tipo}</p>
                      <p className="text-xs text-muted-foreground">
                        {alerta.descripcion}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(alerta.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}