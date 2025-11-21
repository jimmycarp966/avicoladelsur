"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { AlertCircle, Loader2, MapPin, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  LatLngTuple,
  buildGoogleMapsDirectionsUrl,
  normalizeCoordinates,
  parsePolyline,
} from '@/lib/utils/rutas'

const MapContainer = dynamic(
  () => import('react-leaflet').then(mod => mod.MapContainer),
  { ssr: false },
)
const TileLayer = dynamic(
  () => import('react-leaflet').then(mod => mod.TileLayer),
  { ssr: false },
)
const Marker = dynamic(
  () => import('react-leaflet').then(mod => mod.Marker),
  { ssr: false },
)
const Polyline = dynamic(
  () => import('react-leaflet').then(mod => mod.Polyline),
  { ssr: false },
)
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), {
  ssr: false,
})

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

export default function RutaMap({
  rutaId,
  entregas,
  showGpsTracking = false,
  repartidorId,
  vehiculoId,
  className,
}: RutaMapProps) {
  const [polylinePoints, setPolylinePoints] = useState<LatLngTuple[]>([])
  const [historialPoints, setHistorialPoints] = useState<LatLngTuple[]>([])
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
    const sorted = [...entregas].sort(
      (a, b) => (a.orden_entrega || 0) - (b.orden_entrega || 0),
    )

    return sorted
      .map(entrega => {
        let coords =
          normalizeCoordinates(entrega.coordenadas_entrega) ||
          normalizeCoordinates(entrega.pedido?.cliente?.coordenadas)

        if (!coords && ordenVisitaLookup.size > 0) {
          const fallback = ordenVisitaLookup.get(entrega.id)
          if (fallback && Number.isFinite(fallback.lat) && Number.isFinite(fallback.lng)) {
            coords = { lat: fallback.lat, lng: fallback.lng }
          }
        }

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
  }, [entregas, ordenVisitaLookup])

  const mapCenter: LatLngTuple = useMemo(() => {
    if (gpsPosition) {
      return [gpsPosition.lat, gpsPosition.lng]
    }
    if (markers.length > 0) {
      return [markers[0].coords.lat, markers[0].coords.lng]
    }
    if (polylinePoints.length > 0) {
      return polylinePoints[0]
    }
    return [-34.603722, -58.381592] // Buenos Aires
  }, [gpsPosition, markers, polylinePoints])

  const renderMarkerPopup = (marker: (typeof markers)[number]) => (
    <div className="space-y-1 min-w-[180px]">
      <p className="text-sm font-semibold">
        {marker.pedido?.cliente?.nombre || 'Cliente'}
      </p>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <MapPin className="h-3 w-3" />
        {marker.pedido?.cliente?.direccion || 'Dirección no disponible'}
      </p>
      {marker.pedido?.numero_pedido && (
        <p className="text-xs text-muted-foreground">
          Pedido: {marker.pedido.numero_pedido}
        </p>
      )}
      <Button
        variant="secondary"
        size="sm"
        className="w-full mt-2"
        asChild
      >
        <a
          href={buildGoogleMapsDirectionsUrl(
            marker.coords.lat,
            marker.coords.lng,
          )}
          target="_blank"
          rel="noreferrer"
        >
          <Navigation className="mr-2 h-4 w-4" />
          Abrir en Google Maps
        </a>
      </Button>
    </div>
  )

  if (typeof window === 'undefined') {
    return null
  }

  return (
    <div className={className}>
      <div className="h-[500px] w-full rounded-lg overflow-hidden border relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Cargando mapa...
            </div>
          </div>
        )}

        {error && !loading && (
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

        <MapContainer
          center={mapCenter}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {polylinePoints.length > 0 && (
            <Polyline
              positions={polylinePoints}
              color="#2d6a4f"
              weight={4}
              opacity={0.8}
            />
          )}

          {historialPoints.length > 1 && (
            <Polyline
              positions={historialPoints}
              color="#0ea5e9"
              dashArray="6 6"
              weight={3}
              opacity={0.6}
            />
          )}

          {markers.map(marker => (
            <Marker
              key={marker.id}
              position={[marker.coords.lat, marker.coords.lng]}
              icon={createOrderIcon(marker.order)}
            >
              <Popup>{renderMarkerPopup(marker)}</Popup>
            </Marker>
          ))}

          {gpsPosition && showGpsTracking && (
            <Marker
              position={[gpsPosition.lat, gpsPosition.lng]}
              icon={createGpsIcon()}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold flex items-center gap-1">
                    <Navigation className="h-3.5 w-3.5" />
                    Ubicación actual
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {gpsPosition.created_at
                      ? new Date(gpsPosition.created_at).toLocaleTimeString('es-AR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Hace instantes'}
                  </p>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-[#2d6a4f]" />
            <span>Ruta optimizada</span>
          </div>
          {historialPoints.length > 1 && (
            <div className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-[#0ea5e9]" />
              <span>Recorrido histórico</span>
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

// Helper icons
let L: any = null
if (typeof window !== 'undefined') {
  L = require('leaflet')
  if (L?.Icon?.Default) {
    delete (L.Icon.Default.prototype as any)._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    })
  }
}

function createOrderIcon(order: number | undefined) {
  if (!L) return undefined
  const label = order ?? '?'
  return L.divIcon({
    className: '',
    html: `
      <div style="
        background:#2d6a4f;
        color:#fff;
        border-radius:9999px;
        width:28px;
        height:28px;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:12px;
        font-weight:600;
        border:2px solid #fff;
        box-shadow:0 4px 10px rgba(0,0,0,0.2);
      ">
        ${label}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  })
}

function createGpsIcon() {
  if (!L) return undefined
  return L.divIcon({
    className: '',
    html: `
      <div style="
        background:#0ea5e9;
        color:#fff;
        border-radius:9999px;
        width:24px;
        height:24px;
        display:flex;
        align-items:center;
        justify-content:center;
        border:2px solid #fff;
        box-shadow:0 4px 10px rgba(14,165,233,0.45);
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 11h2m7-8v2m7 6h2m-9 7v2m-6.364-3.636l1.414-1.414m8.486 0 1.414 1.414m0-8.486-1.414 1.414m-8.486 0-1.414-1.414M12 8a4 4 0 104 4 4 4 0 00-4-4z"/>
        </svg>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
  })
}


