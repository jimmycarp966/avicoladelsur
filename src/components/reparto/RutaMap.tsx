"use client"

import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { AlertCircle, Loader2, MapPin, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  buildGoogleMapsDirectionsUrl,
  normalizeCoordinates,
  parsePolyline,
} from '@/lib/utils/rutas'

type Entrega = {
  id: string
  orden_entrega: number
  estado_entrega?: string
  coordenadas_entrega?: any
  pedido?: {
    id: string
    numero_pedido?: string
    cliente?: {
      id: string
      nombre?: string
      direccion?: string
      coordenadas?: any
    }
  }
}

interface RutaMapProps {
  rutaId: string
  entregas: Entrega[]
  showGpsTracking?: boolean
  repartidorId?: string
  vehiculoId?: string
  className?: string
}

type RecorridoResponse = {
  success: boolean
  data?: {
    polyline?: string | null
    ordenVisita?: Array<{
      detalle_ruta_id: string
      lat?: number
      lng?: number
      orden?: number
      cliente_nombre?: string
    }>
    historial?: Array<{ lat: number; lng: number; created_at: string }>
  }
  error?: string
}

type UltimaUbicacionResponse = {
  success: boolean
  data?: {
    vehiculo_id?: string
    repartidor_id?: string
    lat: number
    lng: number
    created_at: string
  } | null
  error?: string
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

export default function RutaMap({
  rutaId,
  entregas,
  showGpsTracking = false,
  repartidorId,
  vehiculoId,
  className,
}: RutaMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<GoogleMap | null>(null)
  const markersRef = useRef<Map<string, GoogleMarker>>(new Map())
  const polylinesRef = useRef<Map<string, GooglePolyline>>(new Map())
  const infoWindowsRef = useRef<Map<string, GoogleInfoWindow>>(new Map())
  
  const [polylinePoints, setPolylinePoints] = useState<Array<[number, number]>>([])
  const [historialPoints, setHistorialPoints] = useState<Array<[number, number]>>([])
  const [ordenVisita, setOrdenVisita] = useState<
    Array<{
      detalle_ruta_id: string
      lat?: number
      lng?: number
      orden?: number
      cliente_nombre?: string
    }>
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mapsLoaded, setMapsLoaded] = useState(false)
  const [gpsPosition, setGpsPosition] = useState<{
    lat: number
    lng: number
    created_at?: string
  } | null>(null)

  const fetchRecorrido = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/rutas/${rutaId}/recorrido`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        const data: RecorridoResponse = await res.json()
        throw new Error(data.error || 'No se pudo cargar el recorrido')
      }
      const data: RecorridoResponse = await res.json()
      console.log('🗺️ [RutaMap] Datos recibidos del endpoint:', {
        success: data.success,
        tieneData: !!data.data,
        ordenVisita: data.data?.ordenVisita?.length || 0,
        polyline: data.data?.polyline?.substring(0, 50) || 'vacío',
        mensaje: (data.data as any)?.mensaje,
      })
      if (data.success && data.data) {
        setPolylinePoints(parsePolyline(data.data.polyline))
        if (Array.isArray(data.data.ordenVisita)) {
          setOrdenVisita(data.data.ordenVisita)
        } else {
          setOrdenVisita([])
        }
        if (Array.isArray(data.data.historial) && data.data.historial.length > 0) {
          setHistorialPoints(
            data.data.historial.map(point => [point.lat, point.lng]),
          )
        } else {
          setHistorialPoints([])
        }
      } else {
        setPolylinePoints([])
        setHistorialPoints([])
        setOrdenVisita([])
        setError(data.error || 'No se encontró información de la ruta')
      }
    } catch (err: any) {
      console.error('Error cargando recorrido:', err)
      setError(err.message || 'Error al obtener el recorrido')
      setPolylinePoints([])
      setHistorialPoints([])
      setOrdenVisita([])
    } finally {
      setLoading(false)
    }
  }, [rutaId])

  const fetchGpsPosition = useCallback(async () => {
    if (!showGpsTracking || (!repartidorId && !vehiculoId)) {
      return
    }

    try {
      const params = new URLSearchParams()
      if (repartidorId) params.append('repartidor_id', repartidorId)
      if (vehiculoId) params.append('vehiculo_id', vehiculoId)
      const res = await fetch(
        `/api/reparto/ubicacion-actual?${params.toString()}`,
        { cache: 'no-store' },
      )
      if (!res.ok) {
        const data: UltimaUbicacionResponse = await res.json()
        throw new Error(data.error || 'No se pudo obtener la ubicación actual')
      }
      const data: UltimaUbicacionResponse = await res.json()
      if (data.success && data.data) {
        setGpsPosition({
          lat: data.data.lat,
          lng: data.data.lng,
          created_at: data.data.created_at,
        })
      }
    } catch (err) {
      console.error('Error obteniendo ubicación actual:', err)
    }
  }, [repartidorId, showGpsTracking, vehiculoId])

  useEffect(() => {
    fetchRecorrido()
  }, [fetchRecorrido])

  useEffect(() => {
    if (!showGpsTracking || (!repartidorId && !vehiculoId)) return
    fetchGpsPosition()
    const interval = setInterval(fetchGpsPosition, 5000)
    return () => clearInterval(interval)
  }, [fetchGpsPosition, repartidorId, showGpsTracking, vehiculoId])

  const ordenVisitaLookup = useMemo(() => {
    const map = new Map<string, any>()
    ordenVisita.forEach(punto => {
      if (!punto.detalle_ruta_id) return
      map.set(punto.detalle_ruta_id, punto)
    })
    return map
  }, [ordenVisita])

  const markers = useMemo(() => {
    console.log('🗺️ [RutaMap] Procesando entregas para marcadores:', {
      totalEntregas: entregas.length,
      ordenVisitaSize: ordenVisitaLookup.size,
    })

    const sorted = [...entregas].sort(
      (a, b) => (a.orden_entrega || 0) - (b.orden_entrega || 0),
    )

    const markersResult = sorted
      .map(entrega => {
        // Intentar obtener coordenadas de múltiples fuentes
        let coords =
          normalizeCoordinates(entrega.coordenadas_entrega) ||
          normalizeCoordinates(entrega.pedido?.cliente?.coordenadas)

        // Debug: Log para ver qué formato tienen las coordenadas
        if (!coords) {
          console.log('🗺️ [RutaMap] Entrega sin coordenadas:', {
            entregaId: entrega.id,
            entregaCompleta: entrega,
            tienePedido: !!entrega.pedido,
            pedidoId: entrega.pedido?.id,
            tieneCliente: !!entrega.pedido?.cliente,
            clienteId: entrega.pedido?.cliente?.id,
            clienteNombre: entrega.pedido?.cliente?.nombre,
            coordenadasEntrega: entrega.coordenadas_entrega,
            coordenadasCliente: entrega.pedido?.cliente?.coordenadas,
            tipoCoordenadasCliente: typeof entrega.pedido?.cliente?.coordenadas,
            esArray: Array.isArray(entrega.pedido?.cliente?.coordenadas),
            estructuraCompleta: JSON.stringify(entrega, null, 2),
          })
        } else {
          console.log('✅ [RutaMap] Entrega con coordenadas:', {
            entregaId: entrega.id,
            clienteNombre: entrega.pedido?.cliente?.nombre,
            coords,
          })
        }

        // Si no hay coordenadas en la entrega, buscar en ordenVisita
        if (!coords && ordenVisitaLookup.size > 0) {
          const fallback = ordenVisitaLookup.get(entrega.id)
          if (fallback && Number.isFinite(fallback.lat) && Number.isFinite(fallback.lng)) {
            coords = { lat: fallback.lat, lng: fallback.lng }
            console.log('✅ [RutaMap] Coordenadas encontradas en ordenVisita:', {
              entregaId: entrega.id,
              coords,
            })
          }
        }

        // Si aún no hay coordenadas, retornar null (se filtrará)
        if (!coords) return null

        return {
          id: entrega.id,
          order: entrega.orden_entrega,
          estado: entrega.estado_entrega,
          pedido: entrega.pedido,
          coords,
        }
      })
      .filter((marker): marker is NonNullable<typeof marker> => Boolean(marker))

    console.log('🗺️ [RutaMap] Marcadores finales:', {
      total: markersResult.length,
      marcadores: markersResult.map(m => ({
        id: m.id,
        order: m.order,
        cliente: m.pedido?.cliente?.nombre,
        coords: m.coords,
      })),
    })

    return markersResult
  }, [entregas, ordenVisitaLookup])

  // Contar entregas sin coordenadas para mostrar mensaje informativo
  const entregasSinCoordenadas = useMemo(() => {
    return entregas.filter(entrega => {
      const coords =
        normalizeCoordinates(entrega.coordenadas_entrega) ||
        normalizeCoordinates(entrega.pedido?.cliente?.coordenadas)
      return !coords
    }).length
  }, [entregas])

  const mapCenter = useMemo(() => {
    if (gpsPosition) {
      return { lat: gpsPosition.lat, lng: gpsPosition.lng }
    }
    if (markers.length > 0) {
      return { lat: markers[0].coords.lat, lng: markers[0].coords.lng }
    }
    if (polylinePoints.length > 0) {
      return { lat: polylinePoints[0][0], lng: polylinePoints[0][1] }
    }
    return { lat: -27.1671, lng: -65.4995 } // Monteros, Tucumán
  }, [gpsPosition, markers, polylinePoints])

  // Crear icono personalizado con número de orden
  const createOrderIcon = useCallback((order: number | undefined): any => {
    if (!window.google || !window.google.maps || !window.google.maps.Size || !window.google.maps.Point) return undefined
    const label = order ?? '?'
    
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
          <circle cx="14" cy="14" r="14" fill="#2d6a4f" stroke="#fff" stroke-width="2"/>
          <text x="14" y="18" font-family="Arial, sans-serif" font-size="12" font-weight="600" fill="#fff" text-anchor="middle">${label}</text>
        </svg>
      `),
      scaledSize: new window.google.maps.Size(28, 28),
      anchor: new window.google.maps.Point(14, 28)
    }
  }, [])

  // Crear icono para GPS actual
  const createGpsIcon = useCallback((): any => {
    if (!window.google || !window.google.maps || !window.google.maps.Size || !window.google.maps.Point) return undefined
    
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#0ea5e9">
          <circle cx="12" cy="12" r="12" fill="#0ea5e9" stroke="#fff" stroke-width="2"/>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-13c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" fill="#fff"/>
        </svg>
      `),
      scaledSize: new window.google.maps.Size(24, 24),
      anchor: new window.google.maps.Point(12, 24)
    }
  }, [])

  // Convertir puntos a LatLng de Google Maps
  const convertToLatLngArray = useCallback((points: Array<[number, number]>): GoogleLatLng[] => {
    if (!window.google || !window.google.maps || !window.google.maps.LatLng) return []
    return points.map(([lat, lng]) => new window.google.maps.LatLng(lat, lng))
  }, [])

  // Inicializar mapa
  const initializeMap = useCallback(() => {
    if (!window.google || !window.google.maps || !window.google.maps.Map || !mapRef.current || mapInstanceRef.current) {
      return
    }

    try {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: mapCenter,
        zoom: 13,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
      })

      console.log('[RutaMap] Mapa inicializado correctamente')
    } catch (err) {
      console.error('[RutaMap] Error inicializando mapa:', err)
      setError('Error al inicializar el mapa')
    }
  }, [mapCenter])

  // Actualizar elementos del mapa
  const updateMapElements = useCallback(() => {
    if (!mapInstanceRef.current || !window.google || !window.google.maps || !window.google.maps.Marker || !window.google.maps.Polyline || !window.google.maps.InfoWindow || !window.google.maps.LatLng || !window.google.maps.LatLngBounds) return

    // Limpiar elementos anteriores
    markersRef.current.forEach(marker => marker.setMap(null))
    polylinesRef.current.forEach(polyline => polyline.setMap(null))
    infoWindowsRef.current.forEach(infoWindow => infoWindow.close())
    
    markersRef.current.clear()
    polylinesRef.current.clear()
    infoWindowsRef.current.clear()

    const bounds = new window.google.maps.LatLngBounds()
    let hasPoints = false

    // Agregar polilínea de ruta optimizada (verde)
    if (polylinePoints.length > 0) {
      const path = convertToLatLngArray(polylinePoints)
      path.forEach(point => bounds.extend(point))
      hasPoints = true

      const polyline = new window.google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: '#2d6a4f',
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: mapInstanceRef.current
      })

      polylinesRef.current.set('ruta-optimizada', polyline)
    }

    // Agregar polilínea de historial GPS (azul, punteada)
    if (historialPoints.length > 1) {
      const path = convertToLatLngArray(historialPoints)
      path.forEach(point => bounds.extend(point))
      hasPoints = true

      // Crear línea punteada usando símbolos repetidos
      const polyline = new window.google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: '#0ea5e9',
        strokeOpacity: 0.6,
        strokeWeight: 3,
        icons: [{
          icon: {
            path: 'M 0,-1 0,1',
            strokeOpacity: 1,
            strokeWeight: 2,
            scale: 4
          },
          offset: '0%',
          repeat: '10px'
        }],
        map: mapInstanceRef.current
      })

      polylinesRef.current.set('historial-gps', polyline)
    }

    // Agregar marcadores de entregas
    markers.forEach(marker => {
      const position = new window.google.maps.LatLng(marker.coords.lat, marker.coords.lng)
      bounds.extend(position)
      hasPoints = true

      const googleMarker = new window.google.maps.Marker({
        position,
        map: mapInstanceRef.current,
        icon: createOrderIcon(marker.order),
        title: `Orden ${marker.order}: ${marker.pedido?.cliente?.nombre || 'Cliente'}`
      })

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; min-width: 180px;">
            <p style="font-weight: 600; font-size: 14px; margin: 0 0 8px 0;">
              ${marker.pedido?.cliente?.nombre || 'Cliente'}
            </p>
            <p style="font-size: 12px; color: #666; margin: 0 0 4px 0; display: flex; align-items: center; gap: 4px;">
              📍 ${marker.pedido?.cliente?.direccion || 'Dirección no disponible'}
            </p>
            ${marker.pedido?.numero_pedido ? `
              <p style="font-size: 12px; color: #666; margin: 0 0 8px 0;">
                Pedido: ${marker.pedido.numero_pedido}
              </p>
            ` : ''}
            <a 
              href="${buildGoogleMapsDirectionsUrl(marker.coords.lat, marker.coords.lng)}"
              target="_blank"
              rel="noreferrer"
              style="
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 6px 12px;
                background: #f3f4f6;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                text-decoration: none;
                color: #374151;
                font-size: 12px;
                font-weight: 500;
                transition: background 0.2s;
              "
              onmouseover="this.style.background='#e5e7eb'"
              onmouseout="this.style.background='#f3f4f6'"
            >
              🧭 Abrir en Google Maps
            </a>
          </div>
        `
      })

      googleMarker.addListener('click', () => {
        infoWindowsRef.current.forEach(iw => iw.close())
        infoWindow.open(mapInstanceRef.current, googleMarker)
      })

      markersRef.current.set(`entrega-${marker.id}`, googleMarker)
      infoWindowsRef.current.set(`entrega-${marker.id}`, infoWindow)
    })

    // Agregar marcador de GPS actual
    if (gpsPosition && showGpsTracking) {
      const position = new window.google.maps.LatLng(gpsPosition.lat, gpsPosition.lng)
      bounds.extend(position)
      hasPoints = true

      const gpsMarker = new window.google.maps.Marker({
        position,
        map: mapInstanceRef.current,
        icon: createGpsIcon(),
        title: 'Ubicación actual del repartidor'
      })

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; min-width: 150px;">
            <p style="font-weight: 600; font-size: 14px; margin: 0 0 4px 0; display: flex; align-items: center; gap: 6px;">
              🧭 Ubicación actual
            </p>
            <p style="font-size: 12px; color: #666; margin: 0;">
              ${gpsPosition.created_at
                ? new Date(gpsPosition.created_at).toLocaleTimeString('es-AR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Hace instantes'}
            </p>
          </div>
        `
      })

      gpsMarker.addListener('click', () => {
        infoWindowsRef.current.forEach(iw => iw.close())
        infoWindow.open(mapInstanceRef.current, gpsMarker)
      })

      markersRef.current.set('gps-actual', gpsMarker)
      infoWindowsRef.current.set('gps-actual', infoWindow)
    }

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
  }, [polylinePoints, historialPoints, markers, gpsPosition, showGpsTracking, convertToLatLngArray, createOrderIcon, createGpsIcon])

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
        console.error('[RutaMap] Google Maps API failed to load')
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
    <div className={className}>
      <div className="h-[500px] w-full rounded-lg overflow-hidden border relative">
        {(!mapsLoaded || loading) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {!mapsLoaded ? 'Cargando Google Maps...' : 'Cargando mapa...'}
            </div>
          </div>
        )}

        {error && !loading && mapsLoaded && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-destructive/10 text-destructive p-4 text-center">
            <AlertCircle className="h-6 w-6 mb-2" />
            <p className="font-medium">{error}</p>
            <p className="text-sm opacity-80">
              Intenta actualizar el mapa nuevamente.
            </p>
            <Button onClick={fetchRecorrido} size="sm" className="mt-3">
              Reintentar
            </Button>
          </div>
        )}

        {!error && !loading && mapsLoaded && markers.length === 0 && entregas.length > 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-yellow-50/90 text-yellow-900 p-4 text-center">
            <MapPin className="h-6 w-6 mb-2" />
            <p className="font-medium">No hay coordenadas disponibles</p>
            <p className="text-sm opacity-80 mt-1">
              {entregasSinCoordenadas > 0
                ? `${entregasSinCoordenadas} de ${entregas.length} entregas no tienen coordenadas asignadas. Asigna coordenadas a los clientes para verlos en el mapa.`
                : 'Las entregas asignadas no tienen coordenadas. Asigna coordenadas a los clientes para verlos en el mapa.'}
            </p>
          </div>
        )}

        {!error && !loading && mapsLoaded && entregas.length === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-blue-50/90 text-blue-900 p-4 text-center">
            <MapPin className="h-6 w-6 mb-2" />
            <p className="font-medium">Ruta sin entregas</p>
            <p className="text-sm opacity-80 mt-1">
              Esta ruta no tiene pedidos asignados aún. Asigna pedidos desde Almacén para verlos en el mapa.
            </p>
          </div>
        )}

        <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          {markers.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-[#2d6a4f]" />
              <span>{markers.length} cliente{markers.length !== 1 ? 's' : ''} en el mapa</span>
            </div>
          )}
          {polylinePoints.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-[#2d6a4f]" />
              <span>Ruta optimizada</span>
            </div>
          )}
          {historialPoints.length > 1 && (
            <div className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-[#0ea5e9]" />
              <span>Recorrido histórico</span>
            </div>
          )}
          {entregasSinCoordenadas > 0 && (
            <div className="flex items-center gap-1 text-yellow-600">
              <AlertCircle className="h-3 w-3" />
              <span>{entregasSinCoordenadas} sin coordenadas</span>
            </div>
          )}
        </div>

        {showGpsTracking && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
              <Navigation className="h-3 w-3" />
              GPS activo
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchGpsPosition}
              className="text-xs h-7"
            >
              Actualizar ubicación
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}