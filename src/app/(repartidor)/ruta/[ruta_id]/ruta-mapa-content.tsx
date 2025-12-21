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
import NavigationView from '@/components/reparto/NavigationView'
import { ChecklistInicioForm } from './checklist-inicio-form'

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
    const [selectedEntrega, setSelectedEntrega] = useState<any>(null)
    const [showChecklistInicio, setShowChecklistInicio] = useState(false)
    const [showEntregaPanel, setShowEntregaPanel] = useState(false)
    const [showNavigation, setShowNavigation] = useState(false)
    const [loading, setLoading] = useState(false)
    const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null)

    // Estado local de entregas para actualización dinámica
    const [entregasLocales, setEntregasLocales] = useState<any[]>(ruta.detalles_ruta || [])

    // Ordenar entregas por orden_entrega (o entrega_orden si existe)
    const entregas = entregasLocales
    const entregasOrdenadas = useMemo(() => {
        return [...entregas].sort((a, b) => {
            const ordenA = a.entrega_orden ?? a.orden_entrega ?? 0
            const ordenB = b.entrega_orden ?? b.orden_entrega ?? 0
            return ordenA - ordenB
        })
    }, [entregas])

    // Convertir entregas al formato DeliveryStop para NavigationView
    const deliveryStops = useMemo(() => {
        return entregasOrdenadas.map((e: any, index: number) => ({
            id: e.id,
            orden: e.entrega_orden ?? e.orden_entrega ?? (index + 1),
            cliente_nombre: e.pedido?.cliente?.nombre || 'Cliente',
            direccion: e.pedido?.cliente?.direccion,
            telefono: e.pedido?.cliente?.telefono,
            lat: e.pedido?.cliente?.coordenadas?.lat || 0,
            lng: e.pedido?.cliente?.coordenadas?.lng || 0,
            estado: (e.estado_entrega === 'entregado' ? 'entregado' :
                e.estado_entrega === 'rechazado' ? 'ausente' : 'pendiente') as 'pendiente' | 'entregado' | 'ausente'
        }))
    }, [entregasOrdenadas])

    // Estadísticas
    const entregasCompletadas = entregas.filter((e: any) =>
        e.estado_entrega === 'entregado' || e.estado_entrega === 'rechazado'
    ).length
    const entregasPendientes = entregasOrdenadas.filter((e: any) =>
        e.estado_entrega === 'pendiente' || e.estado_entrega === 'en_camino' || !e.estado_entrega
    )
    const totalCobrar = entregas
        .filter((e: any) => e.pedido?.pago_estado !== 'pagado')
        .reduce((sum: number, e: any) => sum + (e.pedido?.total || 0), 0)
    const totalCobrado = entregas
        .filter((e: any) => e.pago_registrado)
        .reduce((sum: number, e: any) => sum + (e.monto_cobrado_registrado || 0), 0)

    // Próxima entrega pendiente
    const proximaEntrega = entregasPendientes[0]

    // Centro del mapa
    const mapCenter = useMemo(() => {
        if (proximaEntrega?.pedido?.cliente?.coordenadas) {
            return proximaEntrega.pedido.cliente.coordenadas
        }
        const primerCliente = entregasOrdenadas[0]?.pedido?.cliente?.coordenadas
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

    // Actualizar marcadores cuando cambian las entregas
    useEffect(() => {
        if (!mapInstanceRef.current || !window.google?.maps) return

        // Limpiar marcadores antiguos
        markersRef.current.forEach(marker => marker.setMap(null))
        markersRef.current.clear()

        // Crear marcadores
        const bounds = new window.google.maps.LatLngBounds()

        entregasOrdenadas.forEach((entrega: any, index: number) => {
            const coords = entrega.pedido?.cliente?.coordenadas
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

        // Usar la polyline real de la ruta si existe
        if (ruta.polyline && window.google?.maps?.geometry?.encoding) {
            try {
                const decodedPath = window.google.maps.geometry.encoding.decodePath(ruta.polyline)
                if (decodedPath && decodedPath.length > 0) {
                    polylineRef.current = new window.google.maps.Polyline({
                        path: decodedPath,
                        geodesic: true,
                        strokeColor: '#3b82f6',
                        strokeOpacity: 0.8,
                        strokeWeight: 4,
                        map: mapInstanceRef.current,
                    })
                    console.log('✅ Polyline real cargada con', decodedPath.length, 'puntos')
                }
            } catch (error) {
                console.error('Error decodificando polyline:', error)
                // Fallback: dibujar línea recta entre puntos
                drawFallbackPolyline()
            }
        } else {
            // Fallback: dibujar línea recta entre puntos pendientes
            drawFallbackPolyline()
        }

        function drawFallbackPolyline() {
            const pathCoords = entregasOrdenadas
                .filter((e: any) => e.estado_entrega !== 'entregado' && e.estado_entrega !== 'rechazado')
                .map((e: any) => e.pedido?.cliente?.coordenadas)
                .filter((c: any) => c && c.lat && c.lng)

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
    }, [entregasOrdenadas, proximaEntrega, mapLoaded, ruta.polyline])

    // Obtener y actualizar ubicación del usuario
    useEffect(() => {
        if (!navigator.geolocation) return

        const updateUserLocation = (position: GeolocationPosition) => {
            const coords = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            }
            setUserLocation(coords)

            if (mapInstanceRef.current && window.google?.maps) {
                if (userMarkerRef.current) {
                    userMarkerRef.current.setPosition(coords)
                } else {
                    userMarkerRef.current = new window.google.maps.Marker({
                        position: coords,
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
            }
        }

        navigator.geolocation.getCurrentPosition(updateUserLocation)
        const watchId = navigator.geolocation.watchPosition(updateUserLocation)

        return () => navigator.geolocation.clearWatch(watchId)
    }, [mapLoaded])

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
                                onClick={() => setShowNavigation(true)}
                                disabled={ruta.estado !== 'en_curso'}
                            >
                                <Volume2 className="mr-2 h-4 w-4" />
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

            {/* NavigationView - Navegación paso a paso con voz */}
            {showNavigation && (
                <NavigationView
                    rutaId={ruta.id}
                    stops={deliveryStops}
                    onClose={handleCloseNavigation}
                    onDeliveryComplete={handleDeliveryComplete}
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
                                key={entrega.id}
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
