'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
    MapPin,
    Navigation,
    CheckCircle,
    Phone,
    DollarSign,
    ChevronUp,
    ChevronDown,
    Truck,
    Clock,
    Package,
    AlertCircle,
    X,
    ExternalLink,
    Loader2,
    Volume2
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { iniciarRutaAction } from '@/actions/reparto.actions'
import GpsTracker from '@/components/reparto/GpsTracker'
import NavigationInteractivo from '@/components/reparto/NavigationInteractivo'
import { ChecklistInicioForm } from './checklist-inicio-form'
import { useLocationTracker } from '@/hooks/useLocationTracker'
import { config } from '@/lib/config'
import { getDirectionsWithFallback } from '@/lib/rutas/ors-directions'
import {
    calcularMontoPorCobrar,
    esEntregaTerminal,
    normalizarEstadoPago,
} from '@/lib/utils/estado-pago'

interface RutaMapaContentProps {
    ruta: any
}

declare global {
    interface Window {
        google: any
    }
}

// Función para agrupar productos por nombre
function agruparProductos(detalles: any[]) {
    const agrupados: Record<string, { nombre: string; cantidad: number; unidad: string }> = {}

    detalles?.forEach((detalle: any) => {
        const nombre = detalle.producto?.nombre || 'Producto'
        const unidad = detalle.producto?.unidad_medida || 'un'

        if (agrupados[nombre]) {
            agrupados[nombre].cantidad += detalle.cantidad
        } else {
            agrupados[nombre] = { nombre, cantidad: detalle.cantidad, unidad }
        }
    })

    return Object.values(agrupados)
}

export function RutaMapaContent({ ruta }: RutaMapaContentProps) {
    const router = useRouter()
    const mapRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<any>(null)
    const markersRef = useRef<Map<string, any>>(new Map())
    const polylineRef = useRef<any>(null)
    const userMarkerRef = useRef<any>(null)

    const [mapLoaded, setMapLoaded] = useState(false)
    const [geometryReady, setGeometryReady] = useState(false)
    const [selectedEntrega, setSelectedEntrega] = useState<any>(null)
    const [showChecklistInicio, setShowChecklistInicio] = useState(false)
    const [showEntregaPanel, setShowEntregaPanel] = useState(false)
    const [showNavigation, setShowNavigation] = useState(false)
    const [loading, setLoading] = useState(false)

    const unwrap = (v: any) => (Array.isArray(v) ? v[0] : v)

    const getClienteFromEntrega = (entrega: any) => {
        const pedido = unwrap(entrega?.pedido)
        return unwrap(pedido?.cliente) || null
    }

    const getCoordsFromValue = (value: any): { lat: number; lng: number } | null => {
        if (!value) return null

        // {lat, lng}
        if (typeof value === 'object' && 'lat' in value && 'lng' in value) {
            const lat = Number((value as any).lat)
            const lng = Number((value as any).lng)
            if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
        }

        // GeoJSON {type, coordinates:[lng,lat]}
        if (typeof value === 'object' && 'coordinates' in value && Array.isArray((value as any).coordinates)) {
            const coords = (value as any).coordinates
            const lng = Number(coords[0])
            const lat = Number(coords[1])
            if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
        }

        return null
    }

    const getClienteCoords = (entrega: any): { lat: number; lng: number } | null => {
        const cliente = getClienteFromEntrega(entrega)
        return getCoordsFromValue(cliente?.coordenadas)
    }

    const isLatLng = (v: any): v is { lat: number; lng: number } => {
        return !!v && Number.isFinite(v.lat) && Number.isFinite(v.lng)
    }

    const decodeEncodedPolyline = (encoded: string, precision: 5 | 6): Array<{ lat: number; lng: number }> => {
        const factor = precision === 6 ? 1e6 : 1e5
        const points: Array<{ lat: number; lng: number }> = []
        let index = 0
        let lat = 0
        let lng = 0

        while (index < encoded.length) {
            let b
            let shift = 0
            let result = 0
            do {
                b = encoded.charCodeAt(index++) - 63
                result |= (b & 0x1f) << shift
                shift += 5
            } while (b >= 0x20)
            const dlat = (result & 1) ? ~(result >> 1) : (result >> 1)
            lat += dlat

            shift = 0
            result = 0
            do {
                b = encoded.charCodeAt(index++) - 63
                result |= (b & 0x1f) << shift
                shift += 5
            } while (b >= 0x20)
            const dlng = (result & 1) ? ~(result >> 1) : (result >> 1)
            lng += dlng

            points.push({ lat: lat / factor, lng: lng / factor })
        }

        return points
    }

    const decodeEncodedPolylineAuto = (encoded: string): Array<{ lat: number; lng: number }> => {
        const p5 = decodeEncodedPolyline(encoded, 5)
        const p6 = decodeEncodedPolyline(encoded, 6)

        const homeBase = config.rutas.homeBase

        const score = (pts: Array<{ lat: number; lng: number }>) => {
            if (pts.length === 0) return Number.POSITIVE_INFINITY
            const p = pts[0]
            if (Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) return Number.POSITIVE_INFINITY
            // Distancia simple (no Haversine) suficiente para elegir escala correcta
            const dLat = p.lat - homeBase.lat
            const dLng = p.lng - homeBase.lng
            return Math.abs(dLat) + Math.abs(dLng)
        }

        return score(p5) <= score(p6) ? p5 : p6
    }

    // Tracking GPS continuo desde que se abre la página
    const {
        location: userLocation,
        accuracy: gpsAccuracy,
        error: gpsError,
        isLoading: isGpsLoading,
        isReady: isGpsReady,
        isTracking: isGpsTracking
    } = useLocationTracker({
        autoStart: true,
        repartidorId: ruta.repartidor_id,
        vehiculoId: ruta.vehiculo_id,
        rutaId: ruta.id,
        sendInterval: 5000
    })

    // Estado local de entregas para actualización dinámica
    const [entregasLocales, setEntregasLocales] = useState<any[]>(ruta.detalles_ruta || [])

    // Ordenar entregas por orden_entrega (o entrega_orden si existe)
    const entregas = entregasLocales
    const entregasOrdenadas = useMemo(() => {
        const ordenVisita = Array.isArray((ruta as any)?.orden_visita) ? (ruta as any).orden_visita : []

        console.log('🔍 [DEBUG CLIENT] orden_visita recibido:', ordenVisita)
        console.log('🔍 [DEBUG CLIENT] entregas antes de ordenar:', entregas.map((e: any) => ({
            id: e.id,
            orden_entrega: e.orden_entrega,
            pedido_id: e.pedido_id,
            cliente_id: e.cliente_id,
            cliente_nombre: e.pedido?.cliente?.nombre || 'N/A'
        })))

        const orderByKey = new Map<string, number>()
        for (const p of ordenVisita) {
            const orden = typeof p?.orden === 'number' ? p.orden : null
            const clienteId = typeof p?.cliente_id === 'string' ? p.cliente_id : null
            const pedidoId = typeof p?.pedido_id === 'string' ? p.pedido_id : null
            if (orden === null) continue
            if (pedidoId && clienteId) orderByKey.set(`${pedidoId}:${clienteId}`, orden)
            if (clienteId) orderByKey.set(clienteId, orden)
        }

        console.log('🔍 [DEBUG CLIENT] orderByKey:', Array.from(orderByKey.entries()))

        const getPlannedOrder = (e: any): number | null => {
            const pedido = Array.isArray(e?.pedido) ? e.pedido[0] : e?.pedido
            const cliente = Array.isArray(pedido?.cliente) ? pedido.cliente[0] : pedido?.cliente
            const pedidoId = typeof e?.pedido_id === 'string' ? e.pedido_id : (typeof pedido?.id === 'string' ? pedido.id : null)
            const clienteId = typeof e?.cliente_id === 'string' ? e.cliente_id : (typeof cliente?.id === 'string' ? cliente.id : null)

            const orden = pedidoId && clienteId
                ? orderByKey.get(`${pedidoId}:${clienteId}`) ?? null
                : (clienteId ? orderByKey.get(clienteId) ?? null : null)

            console.log(`🔍 [DEBUG CLIENT] getPlannedOrder para ${e.pedido?.cliente?.nombre}:`, {
                pedidoId,
                clienteId,
                ordenEncontrado: orden
            })

            return orden
        }

        const sorted = [...entregas].sort((a, b) => {
            const plannedA = getPlannedOrder(a)
            const plannedB = getPlannedOrder(b)
            if (plannedA !== null || plannedB !== null) {
                return (plannedA ?? Number.MAX_SAFE_INTEGER) - (plannedB ?? Number.MAX_SAFE_INTEGER)
            }
            const ordenA = a.entrega_orden ?? a.orden_entrega ?? 0
            const ordenB = b.entrega_orden ?? b.orden_entrega ?? 0
            return ordenA - ordenB
        })

        console.log('🔍 [DEBUG CLIENT] entregas después de ordenar:', sorted.map((e: any) => ({
            id: e.id,
            orden_entrega: e.orden_entrega,
            pedido_id: e.pedido_id,
            cliente_id: e.cliente_id,
            cliente_nombre: e.pedido?.cliente?.nombre || 'N/A'
        })))

        return sorted.map((e: any) => {
            const planned = getPlannedOrder(e)
            if (planned === null) return e
            return {
                ...e,
                orden_entrega: planned,
                entrega_orden: planned,
            }
        })
    }, [entregas, ruta])

    // Convertir entregas al formato DeliveryStop para NavigationView
    const deliveryStops = useMemo(() => {
        return entregasOrdenadas.map((e: any, index: number) => ({
            id: e.id,
            orden: e.entrega_orden ?? e.orden_entrega ?? (index + 1),
            cliente_nombre: getClienteFromEntrega(e)?.nombre || 'Cliente',
            direccion: getClienteFromEntrega(e)?.direccion,
            telefono: getClienteFromEntrega(e)?.telefono,
            lat: getClienteCoords(e)?.lat || 0,
            lng: getClienteCoords(e)?.lng || 0,
            estado: (e.estado_entrega === 'entregado' ? 'entregado' :
                e.estado_entrega === 'rechazado' ? 'ausente' : 'pendiente') as 'pendiente' | 'entregado' | 'ausente'
        }))
    }, [entregasOrdenadas])

    // Estadísticas
    const entregasCompletadas = entregas.filter((e: any) => esEntregaTerminal(e)).length
    const entregasPendientes = entregasOrdenadas.filter((e: any) => !esEntregaTerminal(e))
    const totalCobrar = entregas.reduce(
        (sum: number, e: any) => sum + calcularMontoPorCobrar(e),
        0,
    )
    const totalCobrado = entregas
        .filter((e: any) => ['pagado', 'parcial', 'cuenta_corriente'].includes(normalizarEstadoPago(e) || ''))
        .reduce((sum: number, e: any) => sum + (e.monto_cobrado_registrado || 0), 0)

    // Próxima entrega pendiente
    const proximaEntrega = entregasPendientes[0]

    // Centro del mapa
    const mapCenter = useMemo(() => {
        const coordsProxima = proximaEntrega ? getClienteCoords(proximaEntrega) : null
        if (coordsProxima) {
            return coordsProxima
        }
        const primerCliente = entregasOrdenadas[0] ? getClienteCoords(entregasOrdenadas[0]) : null
        if (primerCliente) return primerCliente
        return { lat: -27.1725, lng: -65.4992 }
    }, [proximaEntrega, entregasOrdenadas])

    // Inicializar mapa
    useEffect(() => {
        const initMap = () => {
            if (!mapRef.current || !window.google?.maps) return

            const map = new window.google.maps.Map(mapRef.current, {
                center: mapCenter,
                zoom: 14,
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
                gestureHandling: 'greedy',
                styles: [
                    {
                        featureType: 'poi',
                        elementType: 'labels',
                        stylers: [{ visibility: 'off' }]
                    }
                ]
            })

            mapInstanceRef.current = map
            setMapLoaded(true)
        }

        // Esperar a que Google Maps esté disponible
        const checkGoogleMaps = () => {
            if (window.google?.maps?.Map) {
                initMap()
            } else {
                setTimeout(checkGoogleMaps, 200)
            }
        }

        checkGoogleMaps()

        return () => {
            // Cleanup
            markersRef.current.forEach(marker => marker.setMap(null))
            markersRef.current.clear()
            if (polylineRef.current) polylineRef.current.setMap(null)
            if (userMarkerRef.current) userMarkerRef.current.setMap(null)
        }
    }, [mapCenter])

    useEffect(() => {
        if (!mapLoaded) return
        if (geometryReady) return

        let tries = 0
        const maxTries = 50
        const interval = setInterval(() => {
            const ready = !!window.google?.maps?.geometry?.encoding?.decodePath
            if (ready) {
                setGeometryReady(true)
                clearInterval(interval)
                return
            }
            tries += 1
            if (tries >= maxTries) {
                clearInterval(interval)
            }
        }, 200)

        return () => clearInterval(interval)
    }, [mapLoaded, geometryReady])

    // Actualizar marcadores cuando cambian las entregas
    useEffect(() => {
        if (!mapInstanceRef.current || !window.google?.maps) return

        // Limpiar marcadores antiguos
        markersRef.current.forEach(marker => marker.setMap(null))
        markersRef.current.clear()

        // Crear marcadores
        const bounds = new window.google.maps.LatLngBounds()

        entregasOrdenadas.forEach((entrega: any, index: number) => {
            const coords = getClienteCoords(entrega)
            if (!coords || !coords.lat || !coords.lng) return

            const isCompleted = entrega.estado_entrega === 'entregado' || entrega.estado_entrega === 'rechazado'
            const isNext = entrega.id === proximaEntrega?.id
            const orden = entrega.entrega_orden ?? entrega.orden_entrega ?? (index + 1)

            // Color del marcador
            let fillColor = '#3b82f6' // azul
            if (isCompleted) fillColor = '#22c55e' // verde
            else if (isNext) fillColor = '#f97316' // naranja

            const marker = new window.google.maps.Marker({
                position: coords,
                map: mapInstanceRef.current,
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: isNext ? 14 : isCompleted ? 10 : 12,
                    fillColor,
                    fillOpacity: isCompleted ? 0.6 : 1,
                    strokeColor: '#ffffff',
                    strokeWeight: isNext ? 3 : 2,
                },
                label: {
                    text: String(orden),
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 'bold',
                },
                zIndex: isNext ? 100 : isCompleted ? 1 : 50,
            })

            marker.addListener('click', () => {
                setSelectedEntrega(entrega)
                setShowEntregaPanel(true)
            })

            markersRef.current.set(entrega.id, marker)
            bounds.extend(coords)
        })

        // Crear polyline usando la polyline codificada de la ruta
        if (polylineRef.current) {
            polylineRef.current.setMap(null)
        }

        let cancelled = false

        const decodePolylineToPath = (polylineString: string): any[] | null => {
            if (!polylineString || typeof polylineString !== 'string') return null
            const trimmed = polylineString.trim()
            if (!trimmed) return null

            // Formato simple lat,lng;lat,lng
            if (trimmed.includes(';')) {
                const pts = trimmed
                    .split(';')
                    .map((coord: string) => {
                        const [lat, lng] = coord.split(',').map(Number)
                        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
                        return new window.google.maps.LatLng(lat, lng)
                    })
                    .filter(Boolean)
                return pts.length >= 2 ? pts : null
            }

            // Formato encoded polyline
            try {
                const decoded = decodeEncodedPolylineAuto(trimmed)
                const pts = decoded
                    .map(p => {
                        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return null
                        if (Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) return null
                        return new window.google.maps.LatLng(p.lat, p.lng)
                    })
                    .filter(Boolean)
                return pts.length >= 2 ? pts : null
            } catch {
                return null
            }
        }

        const drawPolylinePath = (path: any[], label: string) => {
            if (!path || path.length < 2) return
            polylineRef.current = new window.google.maps.Polyline({
                path,
                geodesic: true,
                strokeColor: '#3b82f6',
                strokeOpacity: 0.8,
                strokeWeight: 4,
                map: mapInstanceRef.current,
            })
            console.log(label, path.length)
        }

        const drawRutaPolyline = async () => {
            // 1) Intentar polyline guardada
            if (ruta.polyline) {
                const path = decodePolylineToPath(ruta.polyline)
                if (path) {
                    drawPolylinePath(path, '✅ Polyline cargada con puntos:')
                    return
                }
            }

            // 2) Si no se puede decodificar, recalcular ruta real (ORS/Google/local)
            const stopsCoords = entregasOrdenadas
                .map((e: any) => getClienteCoords(e))
                .filter(isLatLng)

            if (stopsCoords.length >= 2) {
                const homeBase = config.rutas.homeBase
                const returnToBase = config.rutas.returnToBase
                const destination = returnToBase ? { lat: homeBase.lat, lng: homeBase.lng } : stopsCoords[stopsCoords.length - 1]
                const waypoints = returnToBase ? stopsCoords : stopsCoords.slice(0, -1)

                const { response, provider } = await getDirectionsWithFallback({
                    origin: { lat: homeBase.lat, lng: homeBase.lng },
                    destination,
                    waypoints,
                    vehicle: 'driving-car',
                })

                if (cancelled) return

                if (response.success && response.polyline) {
                    const path = decodePolylineToPath(response.polyline)
                    if (path) {
                        drawPolylinePath(path, `✅ Polyline recalculada (${provider}) con puntos:`)
                        return
                    }
                }
            }

            // 3) Último recurso: dibujar línea recta entre puntos pendientes
            drawFallbackPolyline()
        }

        void drawRutaPolyline()

        return () => {
            cancelled = true
        }

        function drawFallbackPolyline() {
            const pathCoords = entregasOrdenadas
                .filter((e: any) => e.estado_entrega !== 'entregado' && e.estado_entrega !== 'rechazado')
                .map((e: any) => getClienteCoords(e))
                .filter(isLatLng)

            if (pathCoords.length > 1) {
                polylineRef.current = new window.google.maps.Polyline({
                    path: pathCoords,
                    geodesic: true,
                    strokeColor: '#3b82f6',
                    strokeOpacity: 0.6,
                    strokeWeight: 3,
                    strokePattern: [10, 5], // Línea punteada para indicar fallback
                    map: mapInstanceRef.current,
                })
                console.log('⚠️ Usando polyline fallback (línea recta)')
            }
        }

        // Ajustar bounds si hay marcadores
        if (markersRef.current.size > 0) {
            mapInstanceRef.current.fitBounds(bounds, { padding: 50 })
        }
    }, [entregasOrdenadas, proximaEntrega, mapLoaded, geometryReady, ruta.polyline])

    // Actualizar marcador de usuario en el mapa cuando cambia la ubicación
    useEffect(() => {
        if (!mapInstanceRef.current || !window.google?.maps || !userLocation) return

        if (userMarkerRef.current) {
            userMarkerRef.current.setPosition(userLocation)
        } else {
            userMarkerRef.current = new window.google.maps.Marker({
                position: userLocation,
                map: mapInstanceRef.current,
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: '#22c55e',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 3,
                },
                title: 'Tu ubicación',
                zIndex: 200,
            })
        }
    }, [userLocation, mapLoaded])

    const handleIniciarRuta = async () => {
        if (!ruta.checklist_inicio_id) {
            toast.error('Debes completar el checklist de inicio antes de iniciar la ruta')
            setShowChecklistInicio(true)
            return
        }

        setLoading(true)
        const result = await iniciarRutaAction(ruta.id)
        setLoading(false)

        if (result.success) {
            toast.success('Ruta iniciada exitosamente')
            router.refresh()
        } else {
            toast.error(result.error || 'Error al iniciar la ruta')
        }
    }

    const openGoogleMapsNavigation = (entrega: any) => {
        const coords = entrega.pedido?.cliente?.coordenadas
        if (coords) {
            window.open(
                `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}&travelmode=driving`,
                '_blank'
            )
        }
    }

    // Manejar entrega completada desde NavigationView
    const handleDeliveryComplete = async (stopId: string) => {
        try {
            // Actualizar estado local inmediatamente para UI responsiva
            setEntregasLocales(prev => prev.map(e =>
                e.id === stopId
                    ? { ...e, estado_entrega: 'entregado' }
                    : e
            ))

            // Llamar a la acción del servidor (si existe)
            // await marcarEntregaCompletaAction(stopId)

            toast.success('Entrega marcada como completada')
        } catch (error) {
            console.error('Error marcando entrega:', error)
            toast.error('Error al marcar la entrega')
        }
    }

    // Cerrar navegación y refrescar datos
    const handleCloseNavigation = () => {
        setShowNavigation(false)
        router.refresh() // Refrescar para obtener datos actualizados
    }

    // Si necesita checklist
    if (ruta.estado === 'planificada' && !ruta.checklist_inicio_id) {
        return (
            <div className="min-h-screen bg-gray-50 p-4">
                <Card className="border-yellow-200 bg-yellow-50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-yellow-800">
                            <AlertCircle className="h-5 w-5" />
                            Checklist de Inicio Requerido
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-yellow-700 mb-4">
                            Debes completar el checklist antes de iniciar la ruta
                        </p>
                        {showChecklistInicio ? (
                            <ChecklistInicioForm
                                rutaId={ruta.id}
                                vehiculoId={ruta.vehiculo_id}
                                onComplete={() => {
                                    setShowChecklistInicio(false)
                                    router.refresh()
                                }}
                            />
                        ) : (
                            <Button
                                onClick={() => setShowChecklistInicio(true)}
                                className="w-full"
                            >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Completar Checklist de Inicio
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            {/* Header compacto */}
            <div className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="font-bold text-lg">{ruta.numero_ruta}</h1>
                        <p className="text-xs text-muted-foreground">
                            {ruta.vehiculo?.patente} • {ruta.turno === 'mañana' ? '🌅 Mañana' : '🌆 Tarde'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Indicador de GPS */}
                    {isGpsLoading && (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            GPS...
                        </Badge>
                    )}
                    {gpsError && !isGpsLoading && (
                        <Badge variant="destructive" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            GPS
                        </Badge>
                    )}
                    {isGpsReady && (
                        <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-300">
                            <Navigation className="h-3 w-3 mr-1" />
                            GPS
                        </Badge>
                    )}
                    <Badge variant={ruta.estado === 'en_curso' ? 'default' : 'secondary'}>
                        {ruta.estado === 'en_curso' ? 'En Curso' : 'Planificada'}
                    </Badge>
                </div>
            </div>

            {/* Estadísticas compactas */}
            <div className="bg-white border-b px-4 py-2 grid grid-cols-4 gap-2 text-center shrink-0">
                <div>
                    <div className="text-lg font-bold text-blue-600">{entregas.length}</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                </div>
                <div>
                    <div className="text-lg font-bold text-green-600">{entregasCompletadas}</div>
                    <div className="text-xs text-muted-foreground">Entregadas</div>
                </div>
                <div>
                    <div className="text-lg font-bold text-orange-600">{entregasPendientes.length}</div>
                    <div className="text-xs text-muted-foreground">Pendientes</div>
                </div>
                <div>
                    <div className="text-sm font-bold text-emerald-600">
                        ${totalCobrado.toLocaleString('es-AR')}
                    </div>
                    <div className="text-xs text-muted-foreground">Cobrado</div>
                </div>
            </div>

            {/* Mapa */}
            <div className="flex-1 relative">
                <div ref={mapRef} className="w-full h-full" />

                {!mapLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                )}

                {/* GPS Tracker flotante */}
                {ruta.estado === 'en_curso' && (
                    <div className="absolute top-2 right-2 z-10">
                        <GpsTracker
                            repartidorId={ruta.repartidor_id}
                            vehiculoId={ruta.vehiculo_id}
                            rutaId={ruta.id}
                            compact
                        />
                    </div>
                )}
            </div>

            {/* Panel de próxima entrega */}
            {proximaEntrega && !showEntregaPanel && (
                <div className="bg-white border-t shadow-lg shrink-0">
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                                    #{proximaEntrega.entrega_orden ?? proximaEntrega.orden_entrega} Próxima
                                </Badge>
                                <span className="font-semibold">{proximaEntrega.pedido?.cliente?.nombre}</span>
                            </div>
                            <span className="text-lg font-bold text-primary">
                                ${proximaEntrega.pedido?.total?.toLocaleString('es-AR')}
                            </span>
                        </div>

                        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
                            <MapPin className="h-3 w-3" />
                            {proximaEntrega.pedido?.cliente?.direccion || 'Sin dirección'}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                variant="default"
                                className="bg-blue-600 hover:bg-blue-700"
                                onClick={() => {
                                    if (!userLocation) {
                                        toast.error('Esperando ubicación GPS... Por favor, espera un momento.')
                                        return
                                    }
                                    setShowNavigation(true)
                                }}
                                disabled={ruta.estado !== 'en_curso' || isGpsLoading}
                            >
                                {isGpsLoading ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Volume2 className="mr-2 h-4 w-4" />
                                )}
                                Iniciar Navegación
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setSelectedEntrega(proximaEntrega)
                                    setShowEntregaPanel(true)
                                }}
                            >
                                <Package className="mr-2 h-4 w-4" />
                                Ver Detalles
                            </Button>
                        </div>
                    </div>

                    {/* Botón de iniciar ruta si está planificada */}
                    {ruta.estado === 'planificada' && ruta.checklist_inicio_id && (
                        <div className="px-4 pb-4">
                            <Button
                                onClick={handleIniciarRuta}
                                disabled={loading}
                                className="w-full bg-green-600 hover:bg-green-700"
                            >
                                <Truck className="mr-2 h-4 w-4" />
                                {loading ? 'Iniciando...' : 'Iniciar Ruta'}
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Panel deslizable de detalle de entrega */}
            {showEntregaPanel && selectedEntrega && (
                <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-2xl z-20 max-h-[70vh] overflow-y-auto animate-in slide-in-from-bottom">
                    <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline">
                                #{selectedEntrega.entrega_orden ?? selectedEntrega.orden_entrega}
                            </Badge>
                            <span className="font-semibold">{selectedEntrega.pedido?.cliente?.nombre}</span>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowEntregaPanel(false)}
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>

                    <div className="p-4 space-y-4">
                        {/* Información del cliente */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span>{selectedEntrega.pedido?.cliente?.direccion || 'Sin dirección'}</span>
                            </div>
                            {selectedEntrega.pedido?.cliente?.telefono && (
                                <a
                                    href={`tel:${selectedEntrega.pedido.cliente.telefono}`}
                                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                                >
                                    <Phone className="h-4 w-4" />
                                    {selectedEntrega.pedido.cliente.telefono}
                                </a>
                            )}
                            {selectedEntrega.pedido?.cliente?.zona_entrega && (
                                <Badge variant="secondary" className="text-xs">
                                    {selectedEntrega.pedido.cliente.zona_entrega}
                                </Badge>
                            )}
                        </div>

                        <Separator />

                        {/* Productos agrupados */}
                        <div>
                            <h4 className="font-medium text-sm mb-2">Productos</h4>
                            <div className="space-y-1 bg-gray-50 p-3 rounded-lg">
                                {agruparProductos(selectedEntrega.pedido?.detalle_pedido).map((prod, i) => (
                                    <div key={i} className="flex items-center justify-between text-sm">
                                        <span>{prod.nombre}</span>
                                        <span className="font-medium">{prod.cantidad} {prod.unidad}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Separator />

                        {/* Total y estado de pago */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Total:</span>
                                <span className="text-xl font-bold">
                                    ${selectedEntrega.pedido?.total?.toLocaleString('es-AR')}
                                </span>
                            </div>
                            {selectedEntrega.pedido?.pago_estado === 'pagado' ? (
                                <Badge className="bg-green-100 text-green-700 border-green-300 w-full justify-center py-1">
                                    <CheckCircle className="mr-1 h-3 w-3" /> Pagado
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 w-full justify-center py-1">
                                    <DollarSign className="mr-1 h-3 w-3" /> Pendiente de cobro
                                </Badge>
                            )}
                        </div>

                        {/* Instrucciones del repartidor */}
                        {selectedEntrega.pedido?.instrucciones_repartidor && (
                            <div className="bg-yellow-50 p-3 rounded-lg">
                                <p className="text-xs text-yellow-800">
                                    <strong>Instrucciones:</strong> {selectedEntrega.pedido.instrucciones_repartidor}
                                </p>
                            </div>
                        )}

                        <Separator />

                        {/* Acciones */}
                        <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    className="bg-blue-600 hover:bg-blue-700"
                                    onClick={() => openGoogleMapsNavigation(selectedEntrega)}
                                >
                                    <Navigation className="mr-2 h-4 w-4" />
                                    Navegar
                                </Button>
                                {selectedEntrega.pedido?.cliente?.telefono && (
                                    <Button variant="outline" asChild>
                                        <a href={`tel:${selectedEntrega.pedido.cliente.telefono}`}>
                                            <Phone className="mr-2 h-4 w-4" />
                                            Llamar
                                        </a>
                                    </Button>
                                )}
                            </div>

                            {ruta.estado === 'en_curso' &&
                                selectedEntrega.estado_entrega !== 'entregado' &&
                                selectedEntrega.estado_entrega !== 'rechazado' && (
                                    <Button
                                        className="w-full bg-green-600 hover:bg-green-700"
                                        asChild
                                    >
                                        <Link href={`/ruta/${ruta.id}/entrega/${selectedEntrega.id}`}>
                                            <CheckCircle className="mr-2 h-4 w-4" />
                                            Registrar Entrega y Pago
                                        </Link>
                                    </Button>
                                )}

                            {(selectedEntrega.estado_entrega === 'entregado' ||
                                selectedEntrega.estado_entrega === 'rechazado') && (
                                    <Badge className="w-full justify-center py-2 bg-green-100 text-green-700">
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        Entrega completada
                                    </Badge>
                                )}
                        </div>
                    </div>
                </div>
            )}

            {/* Lista de entregas colapsable */}
            <EntregasListPanel
                entregas={entregasOrdenadas}
                rutaId={ruta.id}
                rutaEstado={ruta.estado}
                onSelectEntrega={(entrega) => {
                    setSelectedEntrega(entrega)
                    setShowEntregaPanel(true)
                }}
            />

            {/* NavigationInteractivo - Navegación paso a paso con selección de rutas */}
            {showNavigation && (
                <NavigationInteractivo
                    rutaId={ruta.id}
                    stops={deliveryStops}
                    onClose={handleCloseNavigation}
                    onDeliveryComplete={handleDeliveryComplete}
                    initialPosition={userLocation}
                    repartidorId={ruta.repartidor_id}
                />
            )}
        </div>
    )
}

// Componente para la lista de entregas
function EntregasListPanel({
    entregas,
    rutaId,
    rutaEstado,
    onSelectEntrega
}: {
    entregas: any[]
    rutaId: string
    rutaEstado: string
    onSelectEntrega: (entrega: any) => void
}) {
    const [expanded, setExpanded] = useState(false)

    return (
        <div className={`bg-white border-t transition-all duration-300 ${expanded ? 'max-h-[50vh]' : 'max-h-14'} overflow-hidden`}>
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
            >
                <span className="font-medium">Todas las entregas ({entregas.length})</span>
                {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
            </button>

            {expanded && (
                <div className="overflow-y-auto max-h-[calc(50vh-3.5rem)]">
                    {entregas.map((entrega, index) => {
                        const isCompleted = entrega.estado_entrega === 'entregado' || entrega.estado_entrega === 'rechazado'
                        const orden = entrega.entrega_orden ?? entrega.orden_entrega ?? (index + 1)

                        return (
                            <button
                                key={`${entrega.id}-${entrega.entrega_id || index}`}
                                onClick={() => onSelectEntrega(entrega)}
                                className={`w-full px-4 py-3 flex items-center gap-3 border-b hover:bg-gray-50 text-left ${isCompleted ? 'opacity-50 bg-gray-50' : ''
                                    }`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${isCompleted ? 'bg-green-500' : 'bg-blue-500'
                                    }`}>
                                    {isCompleted ? <CheckCircle className="h-4 w-4" /> : orden}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{entrega.pedido?.cliente?.nombre}</div>
                                    <div className="text-xs text-muted-foreground truncate">
                                        {entrega.pedido?.cliente?.direccion}
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="font-medium">${entrega.pedido?.total?.toLocaleString('es-AR')}</div>
                                    {isCompleted && (
                                        <Badge variant="secondary" className="text-xs">Entregado</Badge>
                                    )}
                                </div>
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
