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
import { AlertCircle, Truck, Loader2, RefreshCw, Pause, Play, MapPin, Navigation, User, Phone, Package, Clock, X, DollarSign, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getRouteColor, getColorName } from '@/lib/colors'
import RutasSidebar from './RutasSidebar'
import { toast } from 'sonner'
import { config } from '@/lib/config'
import { useRealtime } from '@/lib/hooks/useRealtime'

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
  cliente_id?: string
  cliente_nombre: string
  direccion?: string
  telefono?: string
  lat: number
  lng: number
  orden: number
  estado: 'pendiente' | 'entregado' | 'ausente' | 'saltado'
  hora_estimada?: string
  productos?: Array<{ nombre: string; cantidad: number }>
  pago_registrado?: boolean
  monto_cobrado_registrado?: number
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

interface GoogleDirectionsApiResponse {
  success: boolean
  data?: {
    orderedStops?: Array<{ lat: number; lng: number; waypointIndex?: number }>
    polyline?: string
    distance?: number
    duration?: number
  }
  error?: string
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

  // Ref para controlar el zoom inicial
  const initialZoomDone = useRef(false)

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
  const [selectedCliente, setSelectedCliente] = useState<{ cliente: ClientePunto; rutaId: string } | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [panelCollapsed, setPanelCollapsed] = useState(false)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Verificar API Key (solo como fallback si después de los reintentos no carga)
  // La verificación principal está en el useEffect de inicialización
  useEffect(() => {
    const checkTimer = setTimeout(() => {
      if (typeof window !== 'undefined' && !window.google && !mapsLoaded && !error) {
        console.error('[MonitorMap] Google Maps no detectado después de tiempo de espera')
        setGoogleMapsApiKeyMissing(true)
        setError('Google Maps no está configurado correctamente. Verifica NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.')
        setLoading(false)
      }
    }, 10000) // Aumentado a 10 segundos para dar tiempo a la carga asíncrona
    return () => clearTimeout(checkTimer)
  }, [mapsLoaded, error])

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

      // 2.5 Cargar rutas planificadas - buscar de las últimas 24 horas
      const fechaActual = fecha || new Date().toISOString().split('T')[0]
      const fechaParam = fechaActual
      const ayer = new Date(fechaActual)
      ayer.setDate(ayer.getDate() - 1)
      const fechaDesde = ayer.toISOString().split('T')[0]

      console.log('🔍 [DEBUG] Buscando rutas planificadas desde:', fechaDesde, 'hasta:', fechaParam)

      const rutasPlanificadasRes = await fetch(`/api/reparto/rutas-planificadas?fecha=${fechaParam}${zonaId ? `&zona_id=${zonaId}` : ''}`)

      // 3. Procesar rutas
      const nuevasRutas = new Map<string, RutaData>()

      // Primero procesar rutas planificadas
      if (rutasPlanificadasRes.ok) {
        const rutasPlanificadasData = await rutasPlanificadasRes.json()
        console.log('🔍 [DEBUG] Respuesta rutas planificadas:', rutasPlanificadasData)

        if (rutasPlanificadasData.success && Array.isArray(rutasPlanificadasData.data)) {
          console.log('🔍 [DEBUG] Procesando rutas planificadas:', rutasPlanificadasData.data.length)
          rutasPlanificadasData.data.forEach((rutaPlanificada: any, index: number) => {
            console.log(`🔍 [DEBUG] Ruta planificada ${index + 1}:`, {
              id: rutaPlanificada.id,
              numero: rutaPlanificada.numero_ruta,
              polyline: rutaPlanificada.polyline?.substring(0, 50),
              polylineLength: rutaPlanificada.polyline?.length,
              ordenVisita: rutaPlanificada.orden_visita?.length
            })
            const color = getRouteColor(rutaPlanificada.id)
            const ordenVisita = rutaPlanificada.orden_visita || []

            // Los datos ya vienen enriquecidos del endpoint, mantener todos los campos
            const ordenVisitaFormateado = ordenVisita.map((cliente: any) => ({
              id: cliente.id || cliente.detalle_ruta_id || cliente.cliente_id,
              orden: cliente.orden,
              lat: cliente.lat,
              lng: cliente.lng,
              cliente_nombre: cliente.cliente_nombre,
              direccion: cliente.direccion,
              telefono: cliente.telefono,
              estado: cliente.estado_entrega || cliente.estado || 'pendiente',
              productos: cliente.productos || [],
              pago_registrado: cliente.pago_registrado || false,
              monto_cobrado_registrado: cliente.monto_cobrado_registrado || 0,
            }))

            // Calcular progreso
            const total = ordenVisitaFormateado.length
            const completadas = ordenVisitaFormateado.filter((c: any) => c.estado === 'entregado').length

            // Determinar estado: solo completada si hay entregas Y todas están completadas
            let estadoRuta: 'en_curso' | 'completada' | 'retrasada' = 'en_curso'
            if (total > 0 && completadas === total) {
              estadoRuta = 'completada'
            } else if (total === 0) {
              // Si no hay entregas, mantener como en_curso (no completada)
              estadoRuta = 'en_curso'
            }

            nuevasRutas.set(rutaPlanificada.id, {
              id: rutaPlanificada.id,
              numero: rutaPlanificada.numero_ruta || 'S/N',
              repartidor: rutaPlanificada.repartidor ?
                `${rutaPlanificada.repartidor.nombre} ${rutaPlanificada.repartidor.apellido || ''}`.trim() :
                'Sin asignar',
              polyline: rutaPlanificada.polyline,
              ordenVisita: ordenVisitaFormateado,
              color: color,
              progreso: { completadas, total },
              estado: estadoRuta
            })

            // Agregar a rutas activas para que se procesen los vehículos
            rutasActivasIds.add(rutaPlanificada.id)
          })
        }
      }

      // Si no hay rutas planificadas, buscar rutas activas tradicionales
      if (nuevasRutas.size === 0) {
        console.log('🔍 [DEBUG] No hay rutas planificadas, buscando rutas activas tradicionales')

        // Desde ubicaciones
        ubicacionesData.data?.forEach((u: UbicacionVehiculo) => {
          if (u.ruta_activa_id) rutasActivasIds.add(u.ruta_activa_id)
        })

        // Si no hay desde ubicaciones, buscar en endpoint de rutas activas
        if (rutasActivasIds.size === 0) {
          const rutasRes = await fetch(`/api/reparto/rutas-activas?fecha=${fechaParam}${zonaId ? `&zona_id=${zonaId}` : ''}`)
          if (rutasRes.ok) {
            const rutasData = await rutasRes.json()
            if (rutasData.success && Array.isArray(rutasData.data)) {
              rutasData.data.forEach((r: any) => rutasActivasIds.add(r.id))
            }
          }
        }

        // Cargar detalles de rutas activas tradicionales
        for (const rutaId of rutasActivasIds) {
          try {
            const rutaRes = await fetch(`/api/rutas/${rutaId}/recorrido`)
            if (rutaRes.ok) {
              const res = await rutaRes.json()
              if (res.success && res.data) {
                const color = getRouteColor(rutaId)
                const ordenVisita = res.data.ordenVisita || []

                // Calcular progreso
                const total = ordenVisita.length
                const completadas = ordenVisita.filter((c: any) => c.estado === 'entregado').length

                // Determinar estado: solo completada si hay entregas Y todas están completadas
                let estadoRuta: 'en_curso' | 'completada' | 'retrasada' = 'en_curso'
                if (total > 0 && completadas === total) {
                  estadoRuta = 'completada'
                } else if (total === 0) {
                  // Si no hay entregas, mantener como en_curso (no completada)
                  estadoRuta = 'en_curso'
                }

                nuevasRutas.set(rutaId, {
                  id: rutaId,
                  numero: res.data.numero_ruta || 'S/N',
                  repartidor: res.data.repartidor_nombre || 'Sin asignar',
                  polyline: res.data.polyline,
                  ordenVisita: ordenVisita,
                  color: color,
                  progreso: { completadas, total },
                  estado: estadoRuta
                })
              }
            }
          } catch (e) {
            console.error(`Error cargando ruta ${rutaId}`, e)
          }
        }
      }

      console.log('✅ [DEBUG] Rutas finales procesadas:', nuevasRutas.size)

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

  // Función helper para actualizar marcador de vehículo en el mapa
  const actualizarMarcadorVehiculo = useCallback((ubicacion: UbicacionVehiculo) => {
    if (!mapInstanceRef.current || !window.google) return

    const markerKey = `vehiculo-${ubicacion.vehiculo_id}`
    const existingMarker = markersRef.current.get(markerKey)

    if (existingMarker) {
      // Actualizar posición del marcador existente
      existingMarker.setPosition({
        lat: ubicacion.lat,
        lng: ubicacion.lng
      })
    }
    // Si no existe, se creará en el efecto que renderiza los marcadores
  }, [])

  // Ref para mantener referencia actualizada de rutas
  const rutasRef = useRef<Map<string, RutaData>>(new Map())
  useEffect(() => {
    rutasRef.current = rutas
  }, [rutas])

  // Cargar datos iniciales
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Realtime: Suscribirse a nuevas ubicaciones GPS
  useRealtime({
    table: 'ubicaciones_repartidores',
    event: 'INSERT',
    onInsert: (payload) => {
      const nuevaUbicacion = payload.new as UbicacionVehiculo

      // Actualizar ubicaciones en tiempo real
      setUbicaciones((prev) => {
        // Buscar si ya existe una ubicación para este vehículo
        const index = prev.findIndex((u) => u.vehiculo_id === nuevaUbicacion.vehiculo_id)

        if (index >= 0) {
          // Actualizar ubicación existente
          const nuevas = [...prev]
          nuevas[index] = nuevaUbicacion
          return nuevas
        } else {
          // Agregar nueva ubicación
          return [...prev, nuevaUbicacion]
        }
      })

      // Actualizar marcador en el mapa si está cargado
      if (mapInstanceRef.current && window.google) {
        actualizarMarcadorVehiculo(nuevaUbicacion)
      }
    },
    onError: (error) => {
      console.error('[MonitorMap] Error en Realtime de ubicaciones:', error)
      // Fallback a polling si Realtime falla
      if (!intervalRef.current) {
        const interval = setInterval(() => {
          if (!isPollingPaused && document.visibilityState === 'visible') {
            fetchData()
          }
        }, 30000)
        intervalRef.current = interval
      }
    }
  })

  // Realtime: Suscribirse a actualizaciones de entregas (para actualizar estado de clientes)
  useRealtime({
    table: 'entregas',
    event: 'UPDATE',
    onUpdate: (payload) => {
      // Cuando una entrega cambia de estado, actualizar el mapa
      // Esto requiere recargar los datos de la ruta afectada
      const entrega = payload.new as any

      // Si hay una ruta activa, recargar sus datos
      if (entrega.pedido_id) {
        // Buscar la ruta que contiene esta entrega usando la ref
        const ruta = Array.from(rutasRef.current.values()).find((r) =>
          r.ordenVisita.some((c) => c.id === entrega.id)
        )

        if (ruta) {
          // Recargar datos de la ruta específica
          fetch(`/api/rutas/${ruta.id}/recorrido`)
            .then((res) => res.json())
            .then((res) => {
              if (res.success && res.data) {
                const ordenVisita = res.data.ordenVisita || []
                const total = ordenVisita.length
                const completadas = ordenVisita.filter((c: any) => c.estado === 'entregado').length

                // Determinar estado: solo completada si hay entregas Y todas están completadas
                let estadoRuta: 'en_curso' | 'completada' | 'retrasada' = 'en_curso'
                if (total > 0 && completadas === total) {
                  estadoRuta = 'completada'
                } else if (total === 0) {
                  // Si no hay entregas, mantener como en_curso (no completada)
                  estadoRuta = 'en_curso'
                }

                setRutas((prev) => {
                  const nuevas = new Map(prev)
                  nuevas.set(ruta.id, {
                    ...ruta,
                    ordenVisita: ordenVisita,
                    progreso: { completadas, total },
                    estado: estadoRuta
                  })
                  return nuevas
                })
              }
            })
            .catch((err) => console.error('Error recargando ruta:', err))
        }
      }
    }
  })

  // Realtime: Suscribirse a actualizaciones de detalles_ruta (para pagos y entregas completadas)
  useRealtime({
    table: 'detalles_ruta',
    event: 'UPDATE',
    onUpdate: (payload) => {
      const detalleRuta = payload.new as any

      // Si la ruta cambió de estado o se registró pago, recargar datos
      if (detalleRuta.ruta_id) {
        // Buscar si tenemos esta ruta cargada
        const rutaExistente = rutasRef.current.get(detalleRuta.ruta_id)

        if (rutaExistente) {
          // Recargar datos de la ruta específica
          fetch(`/api/rutas/${detalleRuta.ruta_id}/recorrido`)
            .then((res) => res.json())
            .then((res) => {
              if (res.success && res.data) {
                const ordenVisita = res.data.ordenVisita || []
                const total = ordenVisita.length
                const completadas = ordenVisita.filter((c: any) => c.estado === 'entregado').length

                let estadoRuta: 'en_curso' | 'completada' | 'retrasada' = 'en_curso'
                if (total > 0 && completadas === total) {
                  estadoRuta = 'completada'
                }

                setRutas((prev) => {
                  const nuevas = new Map(prev)
                  nuevas.set(detalleRuta.ruta_id, {
                    ...rutaExistente,
                    ordenVisita: ordenVisita,
                    progreso: { completadas, total },
                    estado: estadoRuta
                  })
                  return nuevas
                })
              }
            })
            .catch((err) => console.error('[MonitorMap] Error recargando ruta:', err))
        }
      }
    }
  })

  // Polling fallback: Solo si Realtime no está disponible o está pausado
  useEffect(() => {
    // Mantener polling como fallback pero con intervalo más largo (60s)
    // Solo se ejecuta si está pausado o como respaldo
    if (isPollingPaused) {
      return
    }

    const interval = setInterval(() => {
      // Solo hacer polling si la pestaña está visible
      // Esto es un fallback, Realtime debería manejar las actualizaciones
      if (document.visibilityState === 'visible') {
        // Recargar datos completos cada 60 segundos como respaldo
        fetchData()
      }
    }, 60000) // 60 segundos (más largo porque Realtime maneja las actualizaciones)

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

  const createClientIcon = useCallback((orden: number, color: string, estado: string, pagoRegistrado?: boolean) => {
    if (!window.google) return null

    // Colores por estado
    let fillColor = color
    let strokeColor = '#ffffff'
    let textColor = '#ffffff'

    // Si está entregado Y cobrado, usar negro
    if (estado === 'entregado' && pagoRegistrado) {
      fillColor = '#000000' // Negro
      textColor = '#ffffff' // Texto blanco sobre negro
    } else if (estado === 'entregado') {
      fillColor = '#10B981' // Verde para entregado sin cobrar
    } else if (estado === 'ausente' || estado === 'problema') {
      fillColor = '#EF4444' // Rojo
    } else if (estado === 'saltado') {
      fillColor = '#9CA3AF' // Gris
    }

    // SVG string para el marcador
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
        <circle cx="15" cy="15" r="12" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>
        <text x="15" y="20" font-family="Arial" font-size="14" font-weight="bold" fill="${textColor}" text-anchor="middle">${orden}</text>
      </svg>
    `

    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new window.google.maps.Size(30, 30),
      anchor: new window.google.maps.Point(15, 15)
    }
  }, [])

  // Función helper para determinar color del número
  const getNumeroColor = useCallback((cliente: ClientePunto, rutaColor: string): string => {
    if (cliente.estado === 'entregado' && cliente.pago_registrado) {
      return '#000000' // Negro
    }
    if (cliente.estado === 'entregado') {
      return '#808080' // Gris (opcional)
    }
    return rutaColor // Color de la ruta
  }, [])

  // Inicializar mapa
  const initializeMap = useCallback(() => {
    try {
      console.log('🗺️ [DEBUG] Iniciando initializeMap...')
      console.log('🗺️ [DEBUG] Estado:', {
        mapRef: !!mapRef.current,
        mapInstance: !!mapInstanceRef.current,
        google: !!window.google,
        googleMaps: !!(window.google && window.google.maps)
      })

      if (!mapRef.current || mapInstanceRef.current || !window.google || !window.google.maps) {
        console.warn('⚠️ [DEBUG] No se puede inicializar mapa:', {
          mapRef: !!mapRef.current,
          mapInstance: !!mapInstanceRef.current,
          google: !!window.google,
          googleMaps: !!(window.google && window.google.maps)
        })
        return
      }

      console.log('🗺️ [DEBUG] Creando instancia del mapa...')

      const defaultCenter = {
        lat: config.rutas.homeBase.lat,
        lng: config.rutas.homeBase.lng
      } // Casa Central Monteros

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

      console.log('🗺️ [DEBUG] Mapa creado, agregando listeners...')

      // Agregar listener para deseleccionar ruta al hacer clic en el mapa
      mapInstanceRef.current.addListener('click', () => {
        setSelectedRutaId(undefined)
        console.log('🗺️ [DEBUG] Deseleccionada ruta, vista general activada')
      })

      console.log('✅ Mapa inicializado correctamente')
    } catch (error: any) {
      console.error('❌ Error fatal inicializando mapa:', error)
      if (error?.stack) {
        console.error('❌ Stack trace:', error.stack)
      }
    }
  }, [setSelectedRutaId])

  // Actualizar elementos del mapa
  const updateMapElements = useCallback(async () => {
    // Verificación mejorada: asegurar que mapInstance esté completamente inicializado
    if (!mapInstanceRef.current) {
      console.warn('[MonitorMap] mapInstanceRef no está disponible aún')
      return
    }

    // Verificación robusta de todas las APIs necesarias
    if (!window.google || !window.google.maps) {
      console.warn('[MonitorMap] Google Maps no está disponible')
      return
    }

    // Verificar APIs básicas
    const requiredAPIs = [
      window.google.maps.Map,
      window.google.maps.Marker,
      window.google.maps.Polyline,
      window.google.maps.InfoWindow,
      window.google.maps.LatLng,
      window.google.maps.LatLngBounds
    ]

    const missingAPIs = requiredAPIs.filter(api => !api)
    if (missingAPIs.length > 0) {
      console.warn('[MonitorMap] Faltan APIs básicas de Google Maps:', missingAPIs.length)
      return
    }

    // Verificar geometry.encoding con validación más robusta
    if (!window.google.maps.geometry || !window.google.maps.geometry.encoding) {
      console.warn('[MonitorMap] Geometry.encoding no está disponible aún')
      return
    }

    // Verificar que decodePath sea una función
    if (typeof window.google.maps.geometry.encoding.decodePath !== 'function') {
      console.warn('[MonitorMap] decodePath no es una función')
      return
    }

    // Limpiar todo - Cerrar InfoWindows primero para evitar overlays residuales
    infoWindowsRef.current.forEach(iw => iw.close())
    markersRef.current.forEach(m => m.setMap(null))
    polylinesRef.current.forEach(p => p.setMap(null))
    markersRef.current.clear()
    polylinesRef.current.clear()
    infoWindowsRef.current.clear()

    // Limitar ubicaciones para rendimiento
    const ubicacionesLimitadas = getUbicacionesLimitadas(ubicaciones)

    console.log('🎨 [DEBUG] Dibujando mapa - Rutas:', rutas.size, 'Ubicaciones GPS:', ubicaciones.length, '-> Limitado a:', ubicacionesLimitadas.length)

    const bounds = new window.google.maps.LatLngBounds()
    let hasPoints = false

    // 1. Dibujar Rutas (Polylines y Clientes)
    for (const [rutaIndex, ruta] of Array.from(rutas.entries())) {
      console.log(`🎨 [DEBUG] Dibujando ruta ${rutaIndex + 1}:`, {
        id: ruta.id,
        numero: ruta.numero,
        color: ruta.color,
        polylineLength: ruta.polyline?.length,
        polylineType: typeof ruta.polyline,
        polylineTruthy: !!ruta.polyline,
        polylineValue: ruta.polyline,
        clientes: ruta.ordenVisita?.length,
        ordenVisitaType: typeof ruta.ordenVisita,
        rutaCompleta: ruta
      })

      // Polyline - Intentar usar el existente o generar uno desde los puntos
      console.log(`🎨 [DEBUG] Verificando polyline para ruta ${ruta.numero}: ${!!ruta.polyline}`)
      let path: any[] | null = null

      // Intentar decodificar polyline existente
      if (ruta.polyline && typeof ruta.polyline === 'string' && ruta.polyline.trim().length > 0) {
        try {
          console.log(`🎨 [DEBUG] Decodificando polyline para ruta ${ruta.numero}...`)

          // Verificar si es formato simple (lat,lng;lat,lng) o formato codificado de Google
          if (ruta.polyline.includes(';')) {
            // Formato simple: convertir a array de puntos
            console.log(`🎨 [DEBUG] Polyline en formato simple, convirtiendo...`)
            const puntos = ruta.polyline.split(';').map(segment => {
              const [latStr, lngStr] = segment.trim().split(',')
              const lat = parseFloat(latStr)
              const lng = parseFloat(lngStr)
              if (!isNaN(lat) && !isNaN(lng)) {
                return new window.google.maps.LatLng(lat, lng)
              }
              return null
            }).filter(p => p !== null)
            path = puntos
          } else {
            // Formato codificado de Google Maps
            path = window.google.maps.geometry.encoding.decodePath(ruta.polyline)
          }

          if (!path || !Array.isArray(path) || path.length === 0) {
            console.warn(`⚠️ [DEBUG] Polyline decodificada está vacía o inválida para ruta ${ruta.numero}`)
            path = null
          } else {
            console.log(`🎨 [DEBUG] Polyline decodificada: ${path.length} puntos`)
          }
        } catch (error: any) {
          console.warn(`⚠️ [DEBUG] Error decodificando polyline para ruta ${ruta.numero}:`, error?.message)
          path = null
        }
      }

      // Si no hay polyline válido o tiene menos de 2 puntos (se necesitan al menos 2 para dibujar línea)
      if (!path || path.length < 2) {
        console.log(`🎨 [DEBUG] Polyline insuficiente, solicitando ruta real con Google Directions para ${ruta.numero}`)

        // Construir waypoints desde: casa central -> clientes (en orden) -> casa central
        const homeBase = config.rutas.homeBase
        const clientesOrdenados = [...ruta.ordenVisita].sort((a, b) => (a.orden || 0) - (b.orden || 0))
        const clientesValidos = clientesOrdenados.filter(c => c.lat && c.lng && !isNaN(c.lat) && !isNaN(c.lng))

        if (clientesValidos.length > 0) {
          try {
            const depot = { lat: homeBase.lat, lng: homeBase.lng }

            // Preparar paradas con IDs para optimización
            const stops = clientesValidos.map(c => ({
              id: c.cliente_id || c.id || `stop-${c.lat}-${c.lng}`,
              lat: c.lat,
              lng: c.lng
            }))

            console.log(`🗺️ [DEBUG] Solicitando ruta OPTIMIZADA con Google: depot=${JSON.stringify(depot)}, paradas=${stops.length}`)

            const directionsResponse = await fetch('/api/integrations/google/directions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                origin: depot,
                destination: config.rutas.returnToBase !== false ? depot : stops[stops.length - 1],
                waypoints: config.rutas.returnToBase !== false ? stops : stops.slice(0, -1),
                optimize: true,
              }),
            })
            const directionsData = await directionsResponse.json() as GoogleDirectionsApiResponse

            console.log('🗺️ [DEBUG] Google Directions status:', {
              ok: directionsResponse.ok,
              success: directionsData.success,
              error: directionsData.error,
            })

            // Actualizar el orden de visita según la optimización
            if (directionsData.data?.orderedStops && directionsData.data.orderedStops.length > 0) {
              const ordenOptimizado = new Map<string, number>()
              directionsData.data.orderedStops.forEach((stop, index) => {
                if (typeof stop.waypointIndex === 'number') {
                  const originalStop = stops[stop.waypointIndex]
                  if (originalStop) {
                    ordenOptimizado.set(originalStop.id, index + 1)
                  }
                }
              })

              if (config.rutas.returnToBase === false && stops.length > 0) {
                const destinoFinal = stops[stops.length - 1]
                ordenOptimizado.set(destinoFinal.id, directionsData.data.orderedStops.length + 1)
              }

              // Actualizar el orden de cada cliente según la optimización
              ruta.ordenVisita.forEach(cliente => {
                const clienteId = cliente.cliente_id || cliente.id || `stop-${cliente.lat}-${cliente.lng}`
                const nuevoOrden = ordenOptimizado.get(clienteId)
                if (nuevoOrden !== undefined) {
                  cliente.orden = nuevoOrden
                }
              })

              // Reordenar la lista de clientes según el nuevo orden
              ruta.ordenVisita.sort((a, b) => (a.orden || 0) - (b.orden || 0))

              console.log(`🎯 [DEBUG] Orden de visita actualizado para ruta ${ruta.numero}:`,
                ruta.ordenVisita.map(c => `${c.orden}. ${c.cliente_nombre}`).join(' → '))
            }

            if (directionsResponse.ok && directionsData.success && directionsData.data?.polyline) {
              console.log(`✅ [DEBUG] Ruta obtenida para ruta ${ruta.numero} (provider: google)`)

              // Decodificar polyline si está codificado
              let routePath: any[] = []

              if (window.google?.maps?.geometry?.encoding) {
                // Intentar decodificar como polyline de Google
                try {
                  routePath = window.google.maps.geometry.encoding.decodePath(directionsData.data.polyline)
                } catch (e) {
                  // Si falla, intentar formato simple
                  routePath = directionsData.data.polyline.split(';').map((coord: string) => {
                    const [lat, lng] = coord.split(',').map(Number)
                    return new window.google.maps.LatLng(lat, lng)
                  })
                }
              } else {
                // Fallback: formato simple
                routePath = directionsData.data.polyline.split(';').map((coord: string) => {
                  const [lat, lng] = coord.split(',').map(Number)
                  return new window.google.maps.LatLng(lat, lng)
                })
              }

              if (routePath && routePath.length > 0) {
                const directionsPolyline = new window.google.maps.Polyline({
                  path: routePath,
                  geodesic: true,
                  strokeColor: ruta.color,
                  strokeOpacity: selectedRutaId === ruta.id ? 0.9 : 0.7,
                  strokeWeight: selectedRutaId === ruta.id ? 6 : 4,
                  zIndex: selectedRutaId === ruta.id ? 10 : 1,
                  map: mapInstanceRef.current
                })

                polylinesRef.current.set(`ruta-directions-${ruta.id}`, directionsPolyline)
                console.log(`🎨 [DEBUG] Polyline dibujada con ${routePath.length} puntos (provider: google)`)
              }
            } else {
              console.warn(`⚠️ [DEBUG] Ruta falló para ruta ${ruta.numero}: ${directionsData.error || 'Error desconocido de Google Directions'}`)
              // Fallback: dibujar línea recta
              drawStraightLineFallback()
            }
          } catch (err: any) {
            console.error(`❌ [DEBUG] Error solicitando ruta:`, err)
            drawStraightLineFallback()
          }

          // Función para dibujar línea recta como fallback
          function drawStraightLineFallback() {
            const puntosRuta: any[] = []
            puntosRuta.push(new window.google.maps.LatLng(homeBase.lat, homeBase.lng))
            clientesValidos.forEach(cliente => {
              puntosRuta.push(new window.google.maps.LatLng(cliente.lat, cliente.lng))
            })
            if (config.rutas.returnToBase) {
              puntosRuta.push(new window.google.maps.LatLng(homeBase.lat, homeBase.lng))
            }
            path = puntosRuta
            console.log(`🎨 [DEBUG] Fallback: línea recta con ${path.length} puntos`)
          }
        } else {
          // Si no hay clientes válidos o no está disponible DirectionsService, usar línea recta
          const puntosRuta: any[] = []
          puntosRuta.push(new window.google.maps.LatLng(homeBase.lat, homeBase.lng))
          clientesOrdenados.forEach(cliente => {
            if (cliente.lat && cliente.lng && !isNaN(cliente.lat) && !isNaN(cliente.lng)) {
              puntosRuta.push(new window.google.maps.LatLng(cliente.lat, cliente.lng))
            }
          })
          if (config.rutas.returnToBase) {
            puntosRuta.push(new window.google.maps.LatLng(homeBase.lat, homeBase.lng))
          }
          if (puntosRuta.length > 0) {
            path = puntosRuta
            console.log(`🎨 [DEBUG] Polyline simple generado con ${path.length} puntos`)
          }
        }
      }

      // Dibujar polyline si hay path válido
      if (path && path.length > 0) {
        try {
          // Si la ruta está seleccionada, la resaltamos
          const isSelected = selectedRutaId === ruta.id
          const opacity = selectedRutaId && !isSelected ? 0.3 : 0.8
          const weight = isSelected ? 6 : 4
          const zIndex = isSelected ? 10 : 1

          console.log(`🎨 [DEBUG] Creando polyline - Color: ${ruta.color}, Opacity: ${opacity}, Weight: ${weight}`)

          // Asegurar que el color sea válido
          const validColor = /^#[0-9A-F]{6}$/i.test(ruta.color) ? ruta.color : '#FF0000'
          if (validColor !== ruta.color) {
            console.warn(`⚠️ [DEBUG] Color inválido ${ruta.color}, usando ${validColor}`)
          }

          const polyline = new window.google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: validColor,
            strokeOpacity: opacity,
            strokeWeight: weight,
            zIndex: zIndex,
            map: mapInstanceRef.current
          })

          console.log(`🎨 [DEBUG] Polyline creada exitosamente para ruta ${ruta.numero} con ${path.length} puntos`)
          polylinesRef.current.set(`ruta-${ruta.id}`, polyline)

          // Extender bounds
          path.forEach((p: any) => {
            bounds.extend(p)
            console.log(`📍 [DEBUG] Punto agregado a bounds: ${p.lat()}, ${p.lng()}`)

            // Verificar si las coordenadas están en zona razonable (Argentina/Tucumán)
            const lat = p.lat()
            const lng = p.lng()
            if (lat < -60 || lat > 10 || lng < -80 || lng > -50) {
              console.warn(`⚠️ [DEBUG] Coordenada sospechosa: ${lat}, ${lng} - podría estar fuera de Argentina`)
            }
          })
          hasPoints = true

          console.log(`🎨 [DEBUG] Bounds finales para ruta ${ruta.numero}:`, {
            northEast: bounds.getNorthEast().toString(),
            southWest: bounds.getSouthWest().toString(),
            center: bounds.getCenter().toString()
          })
        } catch (error: any) {
          console.error(`❌ [ERROR] Error dibujando polyline para ruta ${ruta.numero}:`, error)
          console.error(`❌ [ERROR] Detalles del error:`, {
            message: error?.message,
            polylineLength: ruta.polyline?.length,
            polylinePreview: ruta.polyline?.substring(0, 50)
          })
          // No lanzar el error, simplemente omitir esta ruta
        }
      } else {
        console.warn(`⚠️ [DEBUG] Ruta ${ruta.numero} no tiene polyline válido para dibujar`)
      }

      // Marcadores de Clientes
      // Si la ruta está seleccionada, mostrar TODOS los clientes
      // Si no está seleccionada, limitar a 10 por rendimiento
      const clientesLimitados = selectedRutaId === ruta.id
        ? ruta.ordenVisita
        : ruta.ordenVisita.slice(0, 10)

      clientesLimitados.forEach((cliente) => {
        if (!cliente.lat || !cliente.lng) return

        const position = { lat: cliente.lat, lng: cliente.lng }
        bounds.extend(position)

        const isSelected = selectedRutaId === ruta.id
        const opacity = selectedRutaId && !isSelected ? 0.4 : 1

        const marker = new window.google.maps.Marker({
          position,
          map: mapInstanceRef.current,
          icon: createClientIcon(cliente.orden, ruta.color, cliente.estado || 'pendiente', cliente.pago_registrado),
          title: `${cliente.orden}. ${cliente.cliente_nombre} ${ruta.ordenVisita.length > 10 ? '(+' + (ruta.ordenVisita.length - 10) + ' más)' : ''}`,
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
              <p class="text-xs mb-1">📍 ${cliente.direccion || 'Sin dirección registrada'}</p>
              ${cliente.hora_estimada ? `<p class="text-xs">⏰ Est: ${cliente.hora_estimada}</p>` : ''}
            </div>
          `
        })

        marker.addListener('click', () => {
          infoWindowsRef.current.forEach(iw => iw.close())
          infoWindow.open(mapInstanceRef.current, marker)
          setSelectedRutaId(ruta.id)
          // Abrir modal con información completa
          setSelectedCliente({ cliente, rutaId: ruta.id })
          setIsModalOpen(true)
          // Centrar mapa en el cliente
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setCenter(position)
            mapInstanceRef.current.setZoom(15)
          }
        })

        markersRef.current.set(`cliente-${cliente.id}`, marker)
        infoWindowsRef.current.set(`cliente-${cliente.id}`, infoWindow)
      })
    }

    // 2. Dibujar Marcador de Casa Central (homeBase) para todas las rutas visibles
    if (rutas.size > 0 && window.google.maps.Marker) {
      const homeBase = config.rutas.homeBase
      const homeBaseMarkerId = 'home-base'

      // Verificar si ya existe el marcador para no duplicarlo
      if (!markersRef.current.has(homeBaseMarkerId)) {
        const homeBaseMarker = new window.google.maps.Marker({
          position: { lat: homeBase.lat, lng: homeBase.lng },
          map: mapInstanceRef.current,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#2F7058',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
          title: homeBase.nombre,
          zIndex: 200, // Siempre visible encima de todo
        })

        const homeBaseInfoWindow = new window.google.maps.InfoWindow({
          content: `
            <div class="p-3 min-w-[200px]">
              <div class="flex items-center gap-2 mb-2 border-b pb-2">
                <span style="font-size: 20px;">🏠</span>
                <div>
                  <p class="font-bold text-sm">${homeBase.nombre}</p>
                  <p class="text-xs text-gray-500">Punto de origen</p>
                </div>
              </div>
            </div>
          `
        })

        homeBaseMarker.addListener('click', () => {
          infoWindowsRef.current.forEach(iw => iw.close())
          homeBaseInfoWindow.open(mapInstanceRef.current, homeBaseMarker)
        })

        markersRef.current.set(homeBaseMarkerId, homeBaseMarker)
        infoWindowsRef.current.set(homeBaseMarkerId, homeBaseInfoWindow)
      }
    }

    // 3. Dibujar Vehículos (encima de todo) - limitado para rendimiento
    ubicacionesLimitadas.forEach((ubicacion, vehIndex) => {
      const ruta = ubicacion.ruta_activa_id ? rutas.get(ubicacion.ruta_activa_id) : null
      const color = ruta ? ruta.color : '#333333'
      console.log(`🚛 [DEBUG] Dibujando vehículo ${vehIndex + 1}/${ubicacionesLimitadas.length}:`, ubicacion.patente || 'Sin patente', 'Ruta:', ruta?.numero || 'Sin ruta')

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

    // NOTA: Eliminamos fitBounds de aquí para evitar saltos
  }, [rutas, ubicaciones, selectedRutaId, createClientIcon, createTruckIcon, config])

  // Función auxiliar para limitar ubicaciones por rendimiento
  const getUbicacionesLimitadas = useCallback((ubicaciones: UbicacionVehiculo[]) => {
    const ubicacionesPorVehiculo = new Map<string, UbicacionVehiculo>()
    ubicaciones.forEach((ubicacion) => {
      const vehiculoId = ubicacion.vehiculo_id
      const existing = ubicacionesPorVehiculo.get(vehiculoId)
      if (!existing || new Date(ubicacion.created_at) > new Date(existing.created_at)) {
        ubicacionesPorVehiculo.set(vehiculoId, ubicacion)
      }
    })
    return Array.from(ubicacionesPorVehiculo.values()).slice(0, 20)
  }, [])

  // Función para calcular zoom óptimo basado en bounds
  const calculateOptimalZoom = useCallback((bounds: any) => {
    try {
      if (!bounds || bounds.isEmpty()) {
        console.warn('⚠️ [DEBUG] Bounds vacío o inválido en calculateOptimalZoom')
        return 14 // zoom por defecto
      }

      const northEast = bounds.getNorthEast()
      const southWest = bounds.getSouthWest()

      if (!northEast || !southWest) {
        console.warn('⚠️ [DEBUG] NorthEast o SouthWest inválidos en calculateOptimalZoom')
        return 14 // zoom por defecto
      }

      // Calcular distancia diagonal aproximada en grados
      const latDiff = Math.abs(northEast.lat() - southWest.lat())
      const lngDiff = Math.abs(northEast.lng() - southWest.lng())

      console.log('🔍 [DEBUG] Diferencias calculadas - lat:', latDiff.toFixed(6), 'lng:', lngDiff.toFixed(6))

      // Estimar zoom basado en la distancia
      const maxDiff = Math.max(latDiff, lngDiff)

      let zoom
      if (maxDiff < 0.005) zoom = 17 // Muy cerca (< 500m)
      else if (maxDiff < 0.01) zoom = 16  // Cerca (< 1km)
      else if (maxDiff < 0.05) zoom = 15  // Pequeño (< 5km)
      else if (maxDiff < 0.1) zoom = 14   // Mediano (< 10km)
      else if (maxDiff < 0.2) zoom = 13   // Grande (< 20km)
      else if (maxDiff < 0.5) zoom = 12   // Muy grande (< 50km)
      else zoom = 11 // Enorme (> 50km)

      console.log('🔍 [DEBUG] Zoom calculado:', zoom, 'para maxDiff:', maxDiff.toFixed(6))
      return zoom
    } catch (error: any) {
      console.error('❌ [ERROR] Error en calculateOptimalZoom:', error)
      return 14 // zoom seguro por defecto
    }
  }, [])

  // Efecto para inicializar mapa cuando Google Maps está disponible
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null
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
        window.google.maps.LatLngBounds &&
        window.google.maps.geometry &&
        window.google.maps.geometry.encoding
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
        console.error('[MonitorMap] Google Maps API failed to load after retries')
        setError('Google Maps no se pudo cargar después de múltiples intentos')
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
            window.google.maps.LatLngBounds &&
            window.google.maps.geometry &&
            window.google.maps.geometry.encoding
          ) {
            setMapsLoaded(true)
            initializeMap()
          }
        }, 100)
      }
    }

    // Escuchar el evento personalizado de carga de Google Maps
    window.addEventListener('google-maps-loaded', handleGoogleMapsLoaded)

    // Intentar verificar inmediatamente si ya está cargado
    if (checkGoogleMaps()) {
      return () => {
        window.removeEventListener('google-maps-loaded', handleGoogleMapsLoaded)
      }
    }

    // Si no está disponible, iniciar loop de verificación después de un delay
    const initialDelay = setTimeout(() => {
      if (!window.google) {
        setError('Google Maps script no se cargó. Verifica la configuración de la API key.')
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

  // Efecto para actualizar elementos visuales
  useEffect(() => {
    // Verificar que el mapa esté completamente inicializado antes de actualizar
    if (mapsLoaded && mapInstanceRef.current) {
      // Pequeño delay para asegurar que el mapa esté completamente listo
      const timeoutId = setTimeout(() => {
        if (mapInstanceRef.current) {
          updateMapElements()
        }
      }, 50)

      return () => clearTimeout(timeoutId)
    }
  }, [mapsLoaded, updateMapElements])

  // Efecto para Control de Cámara (Zoom Inicial)
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google || !window.google.maps || initialZoomDone.current) return

    // Verificar que geometry.encoding esté disponible
    if (!window.google.maps.geometry || !window.google.maps.geometry.encoding) {
      return
    }

    // Verificar que haya datos para mostrar (rutas o ubicaciones)
    const hasRutas = rutas.size > 0
    const hasUbicaciones = ubicaciones.length > 0

    if (!hasRutas && !hasUbicaciones) {
      // Si no hay datos, usar zoom por defecto pero no marcar como completado
      // para que se ejecute nuevamente cuando lleguen los datos
      return
    }

    const bounds = new window.google.maps.LatLngBounds()
    let hasPoints = false

    // 1. Procesar rutas (polylines y clientes)
    rutas.forEach(r => {
      if (r.polyline) {
        try {
          const path = window.google.maps.geometry.encoding.decodePath(r.polyline)
          if (path && path.length > 0) {
            path.forEach((p: any) => bounds.extend(p))
            hasPoints = true
          }
        } catch (error: any) {
          console.warn(`⚠️ [DEBUG] Error decodificando polyline en zoom inicial para ruta ${r.numero}:`, error)
        }
      }
      r.ordenVisita.forEach(c => {
        // Validar que las coordenadas estén en un rango razonable para Argentina
        // Argentina: lat entre -55 y -21, lng entre -73 y -53
        if (c.lat && c.lng &&
          c.lat >= -60 && c.lat <= -15 &&
          c.lng >= -80 && c.lng <= -50) {
          bounds.extend({ lat: c.lat, lng: c.lng })
          hasPoints = true
        } else if (c.lat && c.lng) {
          console.warn(`⚠️ [DEBUG] Coordenada inválida filtrada: lat=${c.lat}, lng=${c.lng} para cliente ${c.cliente_nombre}`)
        }
      })
    })

    // 2. Procesar ubicaciones GPS (si no hay rutas o para incluir todos los puntos)
    const ubicacionesLimitadas = getUbicacionesLimitadas(ubicaciones)
    ubicacionesLimitadas.forEach(ubicacion => {
      // Validar coordenadas GPS también
      if (ubicacion.lat >= -60 && ubicacion.lat <= -15 &&
        ubicacion.lng >= -80 && ubicacion.lng <= -50) {
        bounds.extend({ lat: ubicacion.lat, lng: ubicacion.lng })
        hasPoints = true
      } else {
        console.warn(`⚠️ [DEBUG] Coordenada GPS inválida filtrada: lat=${ubicacion.lat}, lng=${ubicacion.lng}`)
      }
    })

    if (hasPoints) {
      console.log('🎯 [DEBUG] Aplicando fitBounds con bounds:', {
        northEast: bounds.getNorthEast().toString(),
        southWest: bounds.getSouthWest().toString(),
        center: bounds.getCenter().toString()
      })

      mapInstanceRef.current.fitBounds(bounds)

      // Limitar zoom para vista general (no demasiado alejado ni cercano)
      setTimeout(() => {
        if (mapInstanceRef.current) {
          const currentZoom = mapInstanceRef.current.getZoom()
          const center = mapInstanceRef.current.getCenter()

          console.log('📍 [DEBUG] Zoom y centro actuales:', {
            zoom: currentZoom,
            center: center.toString(),
            mapInstance: !!mapInstanceRef.current
          })

          if (currentZoom) {
            let adjustedZoom = currentZoom
            if (currentZoom > 13) {
              adjustedZoom = 13 // máximo para vista general
            } else if (currentZoom < 10) {
              adjustedZoom = 10 // mínimo para vista general
            }

            if (adjustedZoom !== currentZoom) {
              mapInstanceRef.current.setZoom(adjustedZoom)
              console.log('📍 [DEBUG] Zoom ajustado de', currentZoom, 'a', adjustedZoom)
            }
          }
        }
      }, 100)

      initialZoomDone.current = true
      console.log('📍 [DEBUG] Zoom inicial completado, ajustado para vista general')
    } else {
      console.warn('⚠️ [DEBUG] No hay puntos para centrar el mapa')
      // Si no hay puntos pero hay ubicaciones, usar ubicación por defecto con zoom apropiado
      if (ubicaciones.length > 0) {
        const primeraUbicacion = ubicaciones[0]
        mapInstanceRef.current.setCenter({ lat: primeraUbicacion.lat, lng: primeraUbicacion.lng })
        mapInstanceRef.current.setZoom(13)
        initialZoomDone.current = true
        console.log('📍 [DEBUG] Centrado en primera ubicación GPS disponible')
      }
    }
  }, [rutas, ubicaciones, mapsLoaded, getUbicacionesLimitadas])

  // Efecto para centrar cuando se selecciona una ruta
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google || !window.google.maps) return

    if (selectedRutaId && rutas.has(selectedRutaId)) {
      const ruta = rutas.get(selectedRutaId)
      if (!ruta) return

      console.log('🎯 [DEBUG] Ruta seleccionada:', selectedRutaId, '- centrando mapa y mostrando trazo completo')

      const bounds = new window.google.maps.LatLngBounds()
      let hasPoints = false

      // Función helper para validar coordenadas (Argentina/Tucumán)
      const isValidCoordinate = (lat: number, lng: number): boolean => {
        // Coordenadas válidas para Argentina (Tucumán aproximadamente -27.5 a -26, -66 a -64)
        return (
          lat >= -28 && lat <= -25 &&
          lng >= -67 && lng <= -63 &&
          !isNaN(lat) && !isNaN(lng) &&
          isFinite(lat) && isFinite(lng)
        )
      }

      // Agregar polyline de la ruta a bounds
      if (ruta.polyline && window.google.maps.geometry?.encoding) {
        try {
          const path = window.google.maps.geometry.encoding.decodePath(ruta.polyline)
          if (path && path.length > 0) {
            path.forEach((p: any) => {
              const lat = typeof p.lat === 'function' ? p.lat() : p.lat
              const lng = typeof p.lng === 'function' ? p.lng() : p.lng
              if (isValidCoordinate(lat, lng)) {
                bounds.extend({ lat, lng })
                hasPoints = true
              }
            })
          }
        } catch (error: any) {
          console.warn(`⚠️ Error decodificando polyline para centrar:`, error)
        }
      }

      // Agregar clientes de la ruta a bounds (solo coordenadas válidas)
      ruta.ordenVisita.forEach(cliente => {
        if (cliente.lat && cliente.lng && isValidCoordinate(cliente.lat, cliente.lng)) {
          bounds.extend({ lat: cliente.lat, lng: cliente.lng })
          hasPoints = true
        }
      })

      // Agregar vehículos de esta ruta si están disponibles (solo coordenadas válidas)
      ubicaciones.forEach(ubicacion => {
        if (ubicacion.ruta_activa_id === selectedRutaId &&
          isValidCoordinate(ubicacion.lat, ubicacion.lng)) {
          bounds.extend({ lat: ubicacion.lat, lng: ubicacion.lng })
          hasPoints = true
        }
      })

      // Centrar el mapa en la ruta seleccionada
      if (hasPoints) {
        // Validar que los bounds sean válidos y no demasiado grandes
        const northEast = bounds.getNorthEast()
        const southWest = bounds.getSouthWest()

        // Calcular la diferencia en grados
        const latDiff = Math.abs(northEast.lat() - southWest.lat())
        const lngDiff = Math.abs(northEast.lng() - southWest.lng())

        // Si los bounds son demasiado grandes (>1 grado = ~111km), usar fallback
        const boundsTooLarge = latDiff > 1.0 || lngDiff > 1.0

        if (boundsTooLarge) {
          console.warn('⚠️ [DEBUG] Bounds demasiado grandes, usando fallback centrado en clientes')
          // Usar el primer cliente o primer punto de polyline como centro
          if (ruta.ordenVisita.length > 0 && ruta.ordenVisita[0].lat && ruta.ordenVisita[0].lng) {
            mapInstanceRef.current.setCenter({
              lat: ruta.ordenVisita[0].lat,
              lng: ruta.ordenVisita[0].lng
            })
            mapInstanceRef.current.setZoom(13) // Zoom apropiado para vista de ruta
          }
        } else {
          // Aplicar fitBounds con límites de zoom
          mapInstanceRef.current.fitBounds(bounds, {
            padding: 50 // Padding en píxeles alrededor de los bounds
          })

          // Ajustar zoom después de fitBounds con límites
          setTimeout(() => {
            if (mapInstanceRef.current) {
              const currentZoom = mapInstanceRef.current.getZoom()

              if (currentZoom) {
                let adjustedZoom = currentZoom

                // Límite superior: no más de zoom 15 (muy cercano)
                if (currentZoom > 15) {
                  adjustedZoom = 15
                }
                // Límite inferior: no menos de zoom 11 (vista de ciudad/área)
                else if (currentZoom < 11) {
                  adjustedZoom = 11
                }

                if (adjustedZoom !== currentZoom) {
                  mapInstanceRef.current.setZoom(adjustedZoom)
                  console.log('📍 [DEBUG] Zoom ajustado de', currentZoom, 'a', adjustedZoom)
                }
              }
            }
          }, 300)
        }
      } else {
        // Si no hay puntos, centrar en el primer cliente si existe
        if (ruta.ordenVisita.length > 0 && ruta.ordenVisita[0].lat && ruta.ordenVisita[0].lng) {
          mapInstanceRef.current.setCenter({
            lat: ruta.ordenVisita[0].lat,
            lng: ruta.ordenVisita[0].lng
          })
          mapInstanceRef.current.setZoom(13)
        }
      }
    } else {
      console.log('ℹ️ [DEBUG] Ruta deseleccionada o no encontrada')
    }
  }, [selectedRutaId, rutas, ubicaciones])

  // Efecto para visibilidad de página
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageHidden(document.hidden)
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  const handleRutaClick = (rutaId: string) => {
    setSelectedRutaId(rutaId === selectedRutaId ? undefined : rutaId)
  }

  const handleClienteClick = (cliente: ClientePunto, rutaId: string) => {
    setSelectedCliente({ cliente, rutaId })
    setIsModalOpen(true)
    setSelectedRutaId(rutaId)

    // Centrar mapa en el cliente
    if (mapInstanceRef.current && cliente.lat && cliente.lng) {
      const position = { lat: cliente.lat, lng: cliente.lng }
      mapInstanceRef.current.setCenter(position)
      mapInstanceRef.current.setZoom(15)
    }
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedCliente(null)
  }

  // Obtener clientes de la ruta seleccionada, ordenados
  const clientesRutaSeleccionada = selectedRutaId && rutas.has(selectedRutaId)
    ? [...rutas.get(selectedRutaId)!.ordenVisita].sort((a, b) => a.orden - b.orden)
    : []

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-140px)]">
      {/* Sidebar - Desktop: Left, Mobile: Top (collapsible maybe, but for now stacked) */}
      <div className="w-full lg:w-80 flex-shrink-0 h-48 lg:h-full">
        <RutasSidebar
          rutas={Array.from(rutas.values())}
          onRutaClick={handleRutaClick}
          selectedRutaId={selectedRutaId}
        />
      </div>

      {/* Panel lateral de números de clientes */}
      {selectedRutaId && clientesRutaSeleccionada.length > 0 && (
        <div className={`w-full lg:w-64 flex-shrink-0 h-64 lg:h-full transition-all ${panelCollapsed ? 'lg:w-12' : ''}`}>
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3 flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Clientes</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPanelCollapsed(!panelCollapsed)}
                  className="h-6 w-6 p-0"
                >
                  {panelCollapsed ? (
                    <Navigation className="h-4 w-4" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
            {!panelCollapsed && (
              <ScrollArea className="flex-1 px-3">
                <div className="space-y-2 pb-4">
                  {clientesRutaSeleccionada.map((cliente, index) => {
                    const numeroColor = getNumeroColor(cliente, rutas.get(selectedRutaId)?.color || '#000000')
                    const isEntregadoYCobrado = cliente.estado === 'entregado' && cliente.pago_registrado

                    return (
                      <button
                        key={`${cliente.id}-${cliente.orden}-${index}`}
                        onClick={() => handleClienteClick(cliente, selectedRutaId)}
                        className={`w-full p-3 rounded-lg border-2 transition-all hover:shadow-md ${isEntregadoYCobrado
                          ? 'border-black bg-black/5'
                          : cliente.estado === 'entregado'
                            ? 'border-gray-400 bg-gray-50'
                            : 'border-primary/20 bg-background hover:border-primary/40'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                            style={{ backgroundColor: numeroColor }}
                          >
                            {cliente.orden}
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <p className="font-medium text-sm truncate">{cliente.cliente_nombre}</p>
                            {isEntregadoYCobrado && (
                              <p className="text-xs text-muted-foreground">Entregado y cobrado</p>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </ScrollArea>
            )}
          </Card>
        </div>
      )}

      {/* Map Container */}
      <div className="flex-1 relative rounded-xl overflow-hidden border shadow-sm">
        {/* Header Flotante */}
        <div className="absolute top-4 left-4 right-14 z-10 flex gap-2 overflow-x-auto pb-2 pointer-events-none">
          <div className="pointer-events-auto flex gap-2">
            <Card className="h-10 flex items-center px-3 shadow-lg bg-background/90 backdrop-blur">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                <span className="font-bold text-sm">
                  {new Set(ubicaciones.map(u => u.vehiculo_id)).size}
                </span>
                <span className="text-xs text-muted-foreground hidden sm:inline">vehículos</span>
              </div>
            </Card>

            <Button
              size="sm"
              variant="secondary"
              className="h-10 shadow-lg pointer-events-auto"
              onClick={() => setIsPollingPaused(!isPollingPaused)}
            >
              {isPollingPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </Button>

            <Button
              size="sm"
              variant="secondary"
              className="h-10 shadow-lg pointer-events-auto"
              onClick={() => fetchData()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Loading Overlay */}
        {(!mapsLoaded || (loading && ubicaciones.length === 0)) && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="font-medium text-muted-foreground">
                {!mapsLoaded ? 'Cargando Google Maps...' : 'Sincronizando flota...'}
              </p>
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 max-w-md w-full px-4">
            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg shadow-lg backdrop-blur-md flex items-start gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Error de conexión</p>
                <p className="text-sm opacity-90">{error}</p>
                {googleMapsApiKeyMissing && (
                  <p className="text-xs mt-2 bg-background/50 p-2 rounded">
                    Falta configurar NEXT_PUBLIC_GOOGLE_MAPS_API_KEY en Vercel
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Map Div */}
        <div ref={mapRef} className="w-full h-full bg-muted/20" />
      </div>

      {/* Modal de Vista Previa de Cliente */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col">
          {selectedCliente && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: getNumeroColor(selectedCliente.cliente, rutas.get(selectedCliente.rutaId)?.color || '#000000') }}
                  >
                    {selectedCliente.cliente.orden}
                  </span>
                  {selectedCliente.cliente.cliente_nombre}
                </DialogTitle>
                <DialogDescription>
                  Cliente de la ruta {rutas.get(selectedCliente.rutaId)?.numero || 'N/A'}
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4">
                  {/* Información del Cliente */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Información del Cliente
                    </h4>
                    <div className="space-y-1 text-sm">
                      {selectedCliente.cliente.direccion ? (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">{selectedCliente.cliente.direccion}</span>
                        </div>
                      ) : null}
                      {selectedCliente.cliente.telefono ? (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground">{selectedCliente.cliente.telefono}</span>
                        </div>
                      ) : null}
                      {!selectedCliente.cliente.direccion && !selectedCliente.cliente.telefono && (
                        <p className="text-muted-foreground italic">Sin información de contacto registrada</p>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Estado */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Estado
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant={selectedCliente.cliente.estado === 'entregado' ? 'default' : 'secondary'}
                        className={
                          selectedCliente.cliente.estado === 'entregado'
                            ? 'bg-green-600'
                            : ''
                        }
                      >
                        {selectedCliente.cliente.estado === 'entregado' ? (
                          <>
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Entregado
                          </>
                        ) : (
                          'Pendiente'
                        )}
                      </Badge>
                      {selectedCliente.cliente.pago_registrado && (
                        <Badge variant="default" className="bg-blue-600">
                          <DollarSign className="mr-1 h-3 w-3" />
                          Cobrado
                        </Badge>
                      )}
                      {selectedCliente.cliente.monto_cobrado_registrado && Number(selectedCliente.cliente.monto_cobrado_registrado) > 0 && (
                        <Badge variant="outline">
                          ${Number(selectedCliente.cliente.monto_cobrado_registrado).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Productos */}
                  {selectedCliente.cliente.productos && selectedCliente.cliente.productos.length > 0 && (() => {
                    // Agrupar productos por nombre y sumar cantidades
                    const productosAgrupados = selectedCliente.cliente.productos.reduce((acc: Record<string, number>, producto: any) => {
                      const nombre = producto.nombre || 'Producto'
                      acc[nombre] = (acc[nombre] || 0) + (producto.cantidad || 0)
                      return acc
                    }, {})

                    return (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          Productos
                        </h4>
                        <div className="space-y-1">
                          {Object.entries(productosAgrupados).map(([nombre, cantidad], index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                            >
                              <span className="font-medium">{nombre}</span>
                              <span className="text-muted-foreground">x {cantidad}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}

                  {(!selectedCliente.cliente.productos || selectedCliente.cliente.productos.length === 0) && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      No hay productos disponibles
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleCloseModal} variant="outline">
                  Cerrar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
