'use client'

/**
 * MonitorMap Component
 * 
 * Mapa Leaflet para visualizar vehículos en tiempo real, rutas planificadas y alertas
 */

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { AlertCircle, MapPin, Truck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// Importar Leaflet dinámicamente (solo en cliente)
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false })
const Polyline = dynamic(() => import('react-leaflet').then(mod => mod.Polyline), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false })

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

export default function MonitorMap({ zonaId, fecha }: MonitorMapProps) {
  const [ubicaciones, setUbicaciones] = useState<UbicacionVehiculo[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [rutas, setRutas] = useState<Map<string, { polyline: string; ordenVisita: any[] }>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Cargar ubicaciones y alertas
  const fetchData = async () => {
    try {
      const params = new URLSearchParams()
      if (fecha) params.append('fecha', fecha)
      if (zonaId) params.append('zona_id', zonaId)

      const [ubicacionesRes, alertasRes] = await Promise.all([
        fetch(`/api/reparto/ubicaciones?${params.toString()}`),
        fetch(`/api/reparto/alertas?${params.toString()}`)
      ])

      if (!ubicacionesRes.ok || !alertasRes.ok) {
        throw new Error('Error al cargar datos')
      }

      const ubicacionesData = await ubicacionesRes.json()
      const alertasData = await alertasRes.json()

      if (ubicacionesData.success) {
        setUbicaciones(ubicacionesData.data || [])
      }

      if (alertasData.success) {
        setAlertas(alertasData.data || [])
      }

      // Cargar polilíneas de rutas activas
      const rutasActivas = new Set(
        ubicacionesData.data
          ?.filter((u: UbicacionVehiculo) => u.ruta_activa_id)
          .map((u: UbicacionVehiculo) => u.ruta_activa_id)
      )

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
            }
          }
        } catch (err) {
          console.error(`Error al cargar ruta ${rutaId}:`, err)
        }
      }
      setRutas(rutasMap)

      setLoading(false)
      setError(null)
    } catch (err: any) {
      console.error('Error al cargar datos del monitor:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  // Polling cada 5 segundos
  useEffect(() => {
    fetchData()

    intervalRef.current = setInterval(() => {
      fetchData()
    }, 5000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [zonaId, fecha])

  // Parsear polyline simple (formato: "lat1,lng1;lat2,lng2;...")
  const parsePolyline = (polyline: string): [number, number][] => {
    if (!polyline) return []
    return polyline.split(';').map(p => {
      const [lat, lng] = p.split(',')
      return [parseFloat(lat), parseFloat(lng)]
    }).filter(([lat, lng]) => !isNaN(lat) && !isNaN(lng))
  }

  // Calcular centro del mapa
  const center: [number, number] = ubicaciones.length > 0
    ? [ubicaciones[0].lat, ubicaciones[0].lng]
    : [-34.6037, -58.3816] // Buenos Aires por defecto

  if (typeof window === 'undefined') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monitor de Reparto</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Cargando mapa...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Monitor de Reparto en Tiempo Real
            </CardTitle>
            <Badge variant={loading ? 'secondary' : 'default'}>
              {loading ? 'Cargando...' : `${ubicaciones.length} vehículos activos`}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md">
              {error}
            </div>
          )}

          <div className="h-[600px] w-full rounded-lg overflow-hidden border">
            <MapContainer
              center={center}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />

              {/* Marcadores de vehículos */}
              {ubicaciones.map((ubicacion) => {
                // Crear icono personalizado para vehículos
                const truckIcon = typeof window !== 'undefined' && L ? L.icon({
                  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
                  iconSize: [25, 41],
                  iconAnchor: [12, 41],
                  popupAnchor: [1, -34]
                }) : undefined

                return (
                  <Marker
                    key={ubicacion.vehiculo_id}
                    position={[ubicacion.lat, ubicacion.lng]}
                    icon={truckIcon}
                  >
                    <Popup>
                      <div className="p-2">
                        <p className="font-semibold">{ubicacion.repartidor_nombre}</p>
                        <p className="text-sm text-muted-foreground">
                          {ubicacion.ruta_numero || 'Sin ruta activa'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(ubicacion.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                )
              })}

              {/* Polilíneas de rutas */}
              {Array.from(rutas.entries()).map(([rutaId, ruta]) => {
                const points = parsePolyline(ruta.polyline)
                if (points.length === 0) return null

                return (
                  <Polyline
                    key={rutaId}
                    positions={points}
                    color="#2d6a4f"
                    weight={3}
                    opacity={0.7}
                  />
                )
              })}

              {/* Marcadores de alertas */}
              {alertas
                .filter(a => a.lat && a.lng)
                .map((alerta) => {
                  // Crear icono personalizado para alertas (rojo)
                  const alertIcon = typeof window !== 'undefined' && L ? L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34]
                  }) : undefined

                  return (
                    <Marker
                      key={alerta.id}
                      position={[alerta.lat!, alerta.lng!]}
                      icon={alertIcon}
                    >
                      <Popup>
                        <div className="p-2">
                          <div className="flex items-center gap-2 mb-1">
                            <AlertCircle className="h-4 w-4 text-destructive" />
                            <p className="font-semibold capitalize">{alerta.tipo}</p>
                          </div>
                          <p className="text-sm">{alerta.descripcion}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(alerta.created_at).toLocaleString()}
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                  )
                })}
            </MapContainer>
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

// Importar L de leaflet solo en cliente
let L: any = null
if (typeof window !== 'undefined') {
  L = require('leaflet')
  
  // Fix para iconos de Leaflet en Next.js
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
  })
}

