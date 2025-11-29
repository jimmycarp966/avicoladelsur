'use client'

/**
 * MonitorMap Component (Mejorado)
 * 
 * Visualización en tiempo real de rutas de reparto con:
 * - Colores distintivos por ruta
 * - Marcadores de clientes con estado
 * - Panel lateral de estadísticas
 * - InfoWindows detallados
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { AlertCircle, Truck, Loader2, RefreshCw, Pause, Play, MapPin, Navigation, User, Phone, Package, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getRouteColor, getColorName } from '@/lib/colors'
import RutasSidebar from './RutasSidebar'
import { toast } from 'sonner'

// Tipos
interface UbicacionVehiculo {
  vehiculo_id: string
  repartidor_id: string
  repartidor_nombre: string
  lat: number
  lng: number
  created_at: string
  ruta_activa_id?: string
  ruta_numero?: string
  // Campos extendidos que podrían venir del backend o calcularse
  patente?: string
  velocidad?: number
  bateria?: number
}

interface Alerta {
  id: string
  tipo: string
  descripcion: string
  lat?: number
  lng?: number
  created_at: string
}

interface ClientePunto {
  id: string
  cliente_nombre: string
  direccion: string
  lat: number
  lng: number
  orden: number
  estado: 'pendiente' | 'entregado' | 'ausente' | 'saltado'
  hora_estimada?: string
}

interface RutaData {
  id: string
  numero: string
  repartidor: string
  polyline: string
  ordenVisita: ClientePunto[]
  color: string
  progreso: { completadas: number; total: number }
  estado: 'en_curso' | 'completada' | 'retrasada'
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

export default function MonitorMap({ zonaId, fecha }: MonitorMapProps) {
  // Refs para Google Maps
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())
  const polylinesRef = useRef<Map<string, any>>(new Map())
  const infoWindowsRef = useRef<Map<string, any>>(new Map())

  // Estado de datos
  const [ubicaciones, setUbicaciones] = useState<UbicacionVehiculo[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [rutas, setRutas] = useState<Map<string, RutaData>>(new Map())

  // Estado de UI
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mapsLoaded, setMapsLoaded] = useState(false)
  const [isPollingPaused, setIsPollingPaused] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [isPageHidden, setIsPageHidden] = useState(false)
  const [selectedRutaId, setSelectedRutaId] = useState<string | undefined>(undefined)
  const [googleMapsApiKeyMissing, setGoogleMapsApiKeyMissing] = useState(false)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Verificar API Key
  useEffect(() => {
    const checkTimer = setTimeout(() => {
      if (typeof window !== 'undefined' && !window.google) {
        console.error('[MonitorMap] Google Maps no detectado')
        setGoogleMapsApiKeyMissing(true)
        setError('Google Maps no está configurado')
        setLoading(false)
      }
    }, 3000)
    return () => clearTimeout(checkTimer)
  }, [])

  // Cargar datos
  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (fecha) params.append('fecha', fecha)
      if (zonaId) params.append('zona_id', zonaId)

      // 1. Cargar ubicaciones y alertas
      const [ubicacionesRes, alertasRes] = await Promise.all([
        fetch(`/api/reparto/ubicaciones?${params.toString()}`),
        fetch(`/api/reparto/alertas?${params.toString()}`)
      ])

      let ubicacionesData = { success: false, data: [] }
      if (ubicacionesRes.ok) ubicacionesData = await ubicacionesRes.json()

      let alertasData = { success: false, data: [] }
      if (alertasRes.ok) alertasData = await alertasRes.json()

      if (ubicacionesData.success) {
        setUbicaciones(ubicacionesData.data || [])
      }

      if (alertasData.success) {
        setAlertas(alertasData.data || [])
      }

      // 2. Identificar rutas activas
      const rutasActivasIds = new Set<string>()

      // Desde ubicaciones
      ubicacionesData.data?.forEach((u: UbicacionVehiculo) => {
        if (u.ruta_activa_id) rutasActivasIds.add(u.ruta_activa_id)
      })

      // Si no hay desde ubicaciones, buscar en endpoint de rutas activas
      if (rutasActivasIds.size === 0) {
        const fechaParam = fecha || new Date().toISOString().split('T')[0]
        const rutasRes = await fetch(`/api/reparto/rutas-activas?fecha=${fechaParam}${zonaId ? `&zona_id=${zonaId}` : ''}`)
        if (rutasRes.ok) {
          const rutasData = await rutasRes.json()
          if (rutasData.success && Array.isArray(rutasData.data)) {
            rutasData.data.forEach((r: any) => rutasActivasIds.add(r.id))
          }
        }
      }

      // 3. Cargar detalles de cada ruta (polyline, clientes)
      const nuevasRutas = new Map<string, RutaData>()

      for (const rutaId of rutasActivasIds) {
        try {
          // Verificar si ya tenemos la ruta y no ha cambiado (opcional: optimización)
          // Por ahora recargamos para tener estado actualizado de clientes
          const rutaRes = await fetch(`/api/rutas/${rutaId}/recorrido`)
          if (rutaRes.ok) {
            const res = await rutaRes.json()
            if (res.success && res.data) {
              const color = getRouteColor(rutaId)
              const ordenVisita = res.data.ordenVisita || []

              // Calcular progreso
              const total = ordenVisita.length
              const completadas = ordenVisita.filter((c: any) => c.estado === 'entregado').length

              nuevasRutas.set(rutaId, {
                id: rutaId,
                numero: res.data.numero_ruta || 'S/N',
                repartidor: res.data.repartidor_nombre || 'Sin asignar',
                polyline: res.data.polyline,
                ordenVisita: ordenVisita,
                color: color,
                progreso: { completadas, total },
                estado: completadas === total ? 'completada' : 'en_curso'
              })
            }
          }
        } catch (e) {
          console.error(`Error cargando ruta ${rutaId}`, e)
        }
      }

      setRutas(nuevasRutas)
      setLoading(false)
      setError(null)
      setLastUpdate(new Date())

    } catch (err: any) {
      console.error('[MonitorMap] Error general:', err)
      if (!ubicaciones.length) setError('Error al cargar datos')
      setLoading(false)
    }
  }, [fecha, zonaId, ubicaciones.length])

  // Polling logic
  useEffect(() => {
    fetchData()

    const interval = setInterval(() => {
      if (!isPollingPaused && document.visibilityState === 'visible') {
        fetchData()
      }
    }, 10000) // 10 segundos

    intervalRef.current = interval
    return () => clearInterval(interval)
  }, [fetchData, isPollingPaused])

  // Helpers para iconos
  const createTruckIcon = useCallback((color: string) => {
    if (!window.google) return null
    return {
      path: 'M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
      fillColor: color,
      fillOpacity: 1,
      strokeWeight: 1,
      strokeColor: '#ffffff',
      scale: 1.5,
      anchor: new window.google.maps.Point(12, 12)
    }
  }, [])

  const createClientIcon = useCallback((orden: number, color: string, estado: string) => {
    if (!window.google) return null

    // Colores por estado
    let fillColor = color
    let strokeColor = '#ffffff'

    if (estado === 'entregado') {
      fillColor = '#10B981' // Verde siempre para entregados
    } else if (estado === 'ausente' || estado === 'problema') {
      fillColor = '#EF4444' // Rojo
    } else if (estado === 'saltado') {
      fillColor = '#9CA3AF' // Gris
    }

    // SVG string para el marcador
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
        <circle cx="15" cy="15" r="12" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>
        <text x="15" y="20" font-family="Arial" font-size="14" font-weight="bold" fill="white" text-anchor="middle">${orden}</text>
      </svg>
    `

    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new window.google.maps.Size(30, 30),
      anchor: new window.google.maps.Point(15, 15)
    }
  }, [])

  // Inicializar mapa
  const initializeMap = useCallback(() => {
    if (!mapRef.current || mapInstanceRef.current || !window.google) return

    const defaultCenter = { lat: -27.1671, lng: -65.4995 } // Monteros

    mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom: 13,
      styles: [
        {
          featureType: "poi",
          elementType: "labels",
          stylers: [{ visibility: "off" }]
        }
      ],
      mapTypeControl: false,
      fullscreenControl: true,
      streetViewControl: false
    })

    console.log('Mapa inicializado')
  }, [])

  // Actualizar elementos del mapa
  const updateMapElements = useCallback(() => {
    if (!mapInstanceRef.current || !window.google) return

    // Limpiar todo
    markersRef.current.forEach(m => m.setMap(null))
    polylinesRef.current.forEach(p => p.setMap(null))
    markersRef.current.clear()
    polylinesRef.current.clear()

    const bounds = new window.google.maps.LatLngBounds()
    let hasPoints = false

    // 1. Dibujar Rutas (Polylines y Clientes)
    rutas.forEach((ruta) => {
      // Polyline
      if (ruta.polyline) {
        const path = window.google.maps.geometry.encoding.decodePath(ruta.polyline)

        // Si la ruta está seleccionada, la resaltamos
        const isSelected = selectedRutaId === ruta.id
        const opacity = selectedRutaId && !isSelected ? 0.3 : 0.8
        const weight = isSelected ? 6 : 4
        const zIndex = isSelected ? 10 : 1

        const polyline = new window.google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: ruta.color,
          strokeOpacity: opacity,
          strokeWeight: weight,
          zIndex: zIndex,
          map: mapInstanceRef.current
        })

        polylinesRef.current.set(`ruta-${ruta.id}`, polyline)
        path.forEach((p: any) => bounds.extend(p))
        hasPoints = true
      }

      // Marcadores de Clientes
      ruta.ordenVisita.forEach((cliente) => {
        if (!cliente.lat || !cliente.lng) return

        const position = { lat: cliente.lat, lng: cliente.lng }
        bounds.extend(position)

        const isSelected = selectedRutaId === ruta.id
        const opacity = selectedRutaId && !isSelected ? 0.4 : 1

        const marker = new window.google.maps.Marker({
          position,
          map: mapInstanceRef.current,
          icon: createClientIcon(cliente.orden, ruta.color, cliente.estado),
          title: `${cliente.orden}. ${cliente.cliente_nombre}`,
          opacity: opacity,
          zIndex: isSelected ? 20 : 5
        })

        // InfoWindow Cliente
        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div class="p-2 min-w-[200px]">
              <div class="flex items-center gap-2 mb-2 border-b pb-2">
                <span class="font-bold text-lg" style="color: ${ruta.color}">#${cliente.orden}</span>
                <div>
                  <p class="font-bold text-sm">${cliente.cliente_nombre}</p>
                  <p class="text-xs text-gray-500">${(cliente.estado || 'pendiente').toUpperCase()}</p>
                </div>
              </div>
              <p class="text-xs mb-1">📍 ${cliente.direccion}</p>
              ${cliente.hora_estimada ? `<p class="text-xs">⏰ Est: ${cliente.hora_estimada}</p>` : ''}
            </div>
          `
        })

        marker.addListener('click', () => {
          infoWindowsRef.current.forEach(iw => iw.close())
          infoWindow.open(mapInstanceRef.current, marker)
          setSelectedRutaId(ruta.id)
        })

        markersRef.current.set(`cliente-${cliente.id}`, marker)
        infoWindowsRef.current.set(`cliente-${cliente.id}`, infoWindow)
      })
    })

    // 2. Dibujar Vehículos (encima de todo)
    ubicaciones.forEach((ubicacion) => {
      const ruta = ubicacion.ruta_activa_id ? rutas.get(ubicacion.ruta_activa_id) : null
      const color = ruta ? ruta.color : '#333333'

      const position = { lat: ubicacion.lat, lng: ubicacion.lng }
      bounds.extend(position)
      hasPoints = true

      const isSelected = selectedRutaId === ubicacion.ruta_activa_id

      const marker = new window.google.maps.Marker({
        position,
        map: mapInstanceRef.current,
        icon: createTruckIcon(color),
        title: ubicacion.repartidor_nombre,
        zIndex: 100, // Siempre encima
        animation: isSelected ? window.google.maps.Animation.BOUNCE : null
      })

      // InfoWindow Vehículo Mejorado
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div class="p-3 min-w-[240px]">
            <div class="flex items-center justify-between mb-3 border-b pb-2">
              <div class="flex items-center gap-2">
                <span style="font-size: 20px;">🚚</span>
                <div>
                  <p class="font-bold text-sm">${ubicacion.repartidor_nombre}</p>
                  <p class="text-xs text-gray-500">${ubicacion.patente || 'Vehículo'}</p>
                </div>
              </div>
              <span class="px-2 py-0.5 rounded text-xs text-white" style="background-color: ${color}">
                ${ruta?.numero || 'Sin Ruta'}
              </span>
            </div>
            
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-500">Progreso:</span>
                <span class="font-medium">${ruta?.progreso.completadas || 0} / ${ruta?.progreso.total || 0}</span>
              </div>
              <div class="w-full bg-gray-200 rounded-full h-1.5">
                <div class="h-1.5 rounded-full" style="width: ${ruta ? (ruta.progreso.completadas / ruta.progreso.total) * 100 : 0}%; background-color: ${color}"></div>
              </div>
              
              <div class="flex justify-between pt-1">
                <span class="text-gray-500">Última act:</span>
                <span class="font-medium">${new Date(ubicacion.created_at).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        `
      })

      marker.addListener('click', () => {
        infoWindowsRef.current.forEach(iw => iw.close())
        infoWindow.open(mapInstanceRef.current, marker)
        if (ubicacion.ruta_activa_id) setSelectedRutaId(ubicacion.ruta_activa_id)
      })

      markersRef.current.set(`vehiculo-${ubicacion.vehiculo_id}`, marker)
      infoWindowsRef.current.set(`vehiculo-${ubicacion.vehiculo_id}`, infoWindow)
    })

    // Ajustar vista si hay puntos
    if (hasPoints && !mapInstanceRef.current.getBounds()?.equals(bounds)) {
      mapInstanceRef.current.fitBounds(bounds)
    }
  }, [rutas, ubicaciones, selectedRutaId, createClientIcon, createTruckIcon])

  // Efecto para inicializar mapa
  useEffect(() => {
    if (window.google && !mapsLoaded) {
      initializeMap()
      setMapsLoaded(true)
    }
  }, [initializeMap, mapsLoaded])

  // Efecto para actualizar elementos
  useEffect(() => {
    if (mapsLoaded) {
      updateMapElements()
    }
  }, [mapsLoaded, updateMapElements])

  // Efecto para visibilidad de página
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageHidden(document.hidden)
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  return (
    <div className="flex h-full w-full gap-4">
      {/* Sidebar de Rutas */}
      <RutasSidebar
        rutas={Array.from(rutas.values())}
        selectedRutaId={selectedRutaId}
        onSelectRuta={setSelectedRutaId}
        loading={loading}
      />

      {/* Mapa */}
      <div className="flex-1 relative rounded-xl overflow-hidden border shadow-sm">
        <div ref={mapRef} className="h-full w-full bg-gray-100" />

        {/* Loading Overlay */}
        {loading && !rutas.size && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-50">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-gray-500">Cargando mapa...</p>
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute top-4 left-4 right-4 z-50">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2 shadow-lg">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
              {googleMapsApiKeyMissing && (
                <Button variant="outline" size="sm" className="ml-auto" onClick={() => window.location.reload()}>
                  Reintentar
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Controls Overlay */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          <Button
            variant="secondary"
            size="icon"
            className="bg-white shadow-md hover:bg-gray-50"
            onClick={() => setIsPollingPaused(!isPollingPaused)}
            title={isPollingPaused ? "Reanudar actualización" : "Pausar actualización"}
          >
            {isPollingPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>

          <Button
            variant="secondary"
            size="icon"
            className="bg-white shadow-md hover:bg-gray-50"
            onClick={() => fetchData()}
            title="Actualizar ahora"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Status Bar */}
        <div className="absolute bottom-4 left-4 right-4 z-10">
          <div className="bg-white/90 backdrop-blur shadow-lg rounded-lg p-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Truck className="h-3 w-3" />
                {ubicaciones.length} Vehículos
              </span>
              <span className="flex items-center gap-1">
                <Navigation className="h-3 w-3" />
                {rutas.size} Rutas
              </span>
              {alertas.length > 0 && (
                <span className="flex items-center gap-1 text-red-600 font-medium">
                  <AlertCircle className="h-3 w-3" />
                  {alertas.length} Alertas
                </span>
              )}
            </div>
            <div className="text-gray-500">
              {isPollingPaused ? (
                <span className="text-amber-600 font-medium">Pausado</span>
              ) : (
                <span>Actualizado: {lastUpdate ? lastUpdate.toLocaleTimeString() : '-'}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}