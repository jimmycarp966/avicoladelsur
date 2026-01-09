'use client'

/**
 * RutaAlternativasSelector - Selector visual de rutas alternativas
 * 
 * Muestra mapa con 2-3 rutas coloreadas y permite al repartidor
 * elegir cuál tomar para llegar al próximo cliente.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Clock, MapPin, Star, ChevronRight, User, Phone } from 'lucide-react'
import type { RutaAlternativa } from '@/lib/rutas/google-directions'
import type { ClienteCalificado } from '@/lib/rutas/next-client-selector'

interface RutaAlternativasSelectorProps {
    clienteDestino: ClienteCalificado
    rutasAlternativas: RutaAlternativa[]
    posicionActual: { lat: number; lng: number }
    onSeleccionarRuta: (ruta: RutaAlternativa) => void
    onCambiarCliente?: () => void
    isLoading?: boolean
}

// Colores para las rutas
const COLORES_RUTAS = [
    { color: '#3B82F6', nombre: 'Azul', label: '🔵' },   // Principal
    { color: '#22C55E', nombre: 'Verde', label: '🟢' },  // Alternativa 1
    { color: '#F97316', nombre: 'Naranja', label: '🟠' } // Alternativa 2
]

export default function RutaAlternativasSelector({
    clienteDestino,
    rutasAlternativas,
    posicionActual,
    onSeleccionarRuta,
    onCambiarCliente,
    isLoading = false
}: RutaAlternativasSelectorProps) {
    const mapRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<google.maps.Map | null>(null)
    const polylinesRef = useRef<google.maps.Polyline[]>([])
    const markersRef = useRef<google.maps.Marker[]>([])

    const [rutaSeleccionada, setRutaSeleccionada] = useState<number>(0)
    const [mapaCargado, setMapaCargado] = useState(false)

    // Formatear duración
    const formatearDuracion = (segundos: number): string => {
        const minutos = Math.round(segundos / 60)
        if (minutos < 60) return `${minutos} min`
        const horas = Math.floor(minutos / 60)
        const mins = minutos % 60
        return `${horas}h ${mins}min`
    }

    // Formatear distancia
    const formatearDistancia = (metros: number): string => {
        if (metros < 1000) return `${Math.round(metros)} m`
        return `${(metros / 1000).toFixed(1)} km`
    }

    // Encontrar índice de ruta preferida
    const indicePreferida = rutasAlternativas.findIndex(r => r.esPreferida)

    useEffect(() => {
        if (indicePreferida >= 0 && indicePreferida !== rutaSeleccionada) {
            setRutaSeleccionada(indicePreferida)
        }
    }, [indicePreferida])

    // Inicializar mapa
    const initMap = useCallback(() => {
        if (!mapRef.current || !window.google?.maps) return

        // Limpiar mapa anterior
        polylinesRef.current.forEach(p => p.setMap(null))
        markersRef.current.forEach(m => m.setMap(null))
        polylinesRef.current = []
        markersRef.current = []

        // Crear mapa centrado entre origen y destino
        const bounds = new google.maps.LatLngBounds()
        bounds.extend(new google.maps.LatLng(posicionActual.lat, posicionActual.lng))
        bounds.extend(new google.maps.LatLng(clienteDestino.lat, clienteDestino.lng))

        if (!mapInstanceRef.current) {
            mapInstanceRef.current = new google.maps.Map(mapRef.current, {
                zoom: 14,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
                zoomControl: true,
                styles: [
                    { featureType: 'poi', stylers: [{ visibility: 'off' }] }
                ]
            })
        }

        const map = mapInstanceRef.current
        map.fitBounds(bounds, { top: 50, right: 50, bottom: 150, left: 50 })

        // Dibujar todas las rutas (primero las no seleccionadas, más opacas)
        rutasAlternativas.forEach((ruta, index) => {
            if (!ruta.polyline) return

            try {
                const path = google.maps.geometry.encoding.decodePath(ruta.polyline)
                const isSelected = index === rutaSeleccionada

                const polyline = new google.maps.Polyline({
                    path,
                    strokeColor: COLORES_RUTAS[index]?.color || '#888888',
                    strokeOpacity: isSelected ? 1.0 : 0.4,
                    strokeWeight: isSelected ? 6 : 4,
                    zIndex: isSelected ? 10 : 1,
                    map
                })

                // Click para seleccionar ruta
                polyline.addListener('click', () => {
                    setRutaSeleccionada(index)
                })

                polylinesRef.current.push(polyline)
            } catch (e) {
                console.error('[RutaAlternativasSelector] Error decodificando polyline:', e)
            }
        })

        // Marker de posición actual
        const markerOrigen = new google.maps.Marker({
            position: posicionActual,
            map,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: '#3B82F6',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 3
            },
            title: 'Tu ubicación'
        })
        markersRef.current.push(markerOrigen)

        // Marker de destino
        const markerDestino = new google.maps.Marker({
            position: { lat: clienteDestino.lat, lng: clienteDestino.lng },
            map,
            icon: {
                path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                scale: 8,
                fillColor: '#EF4444',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
                rotation: 180
            },
            title: clienteDestino.nombre
        })
        markersRef.current.push(markerDestino)

        setMapaCargado(true)
    }, [posicionActual, clienteDestino, rutasAlternativas, rutaSeleccionada])

    // Cargar script de Google Maps
    useEffect(() => {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

        if (window.google?.maps?.geometry) {
            initMap()
            return
        }

        // Cargar script si no existe
        if (!document.getElementById('google-maps-script')) {
            const script = document.createElement('script')
            script.id = 'google-maps-script'
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`
            script.async = true
            script.defer = true
            script.onload = () => initMap()
            document.head.appendChild(script)
        } else {
            // Script ya cargándose, esperar
            const checkLoaded = setInterval(() => {
                if (window.google?.maps?.geometry) {
                    clearInterval(checkLoaded)
                    initMap()
                }
            }, 100)
            return () => clearInterval(checkLoaded)
        }
    }, [initMap])

    // Re-renderizar cuando cambia la selección
    useEffect(() => {
        if (mapaCargado && mapInstanceRef.current) {
            initMap()
        }
    }, [rutaSeleccionada, mapaCargado])

    const handleConfirmar = () => {
        if (rutasAlternativas[rutaSeleccionada]) {
            onSeleccionarRuta(rutasAlternativas[rutaSeleccionada])
        }
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground">Calculando rutas alternativas...</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header con info del cliente */}
            <div className="p-4 border-b bg-card">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <MapPin className="h-4 w-4 text-primary" />
                            <span className="font-semibold">Próximo cliente</span>
                            {clienteDestino.esUrgente && (
                                <Badge variant="destructive" className="text-xs">⚡ Urgente</Badge>
                            )}
                        </div>
                        <h2 className="text-xl font-bold">{clienteDestino.nombre}</h2>
                        <p className="text-sm text-muted-foreground mt-1">{clienteDestino.razon}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {clienteDestino.distanciaKm} km
                            </span>
                            {clienteDestino.horarioApertura && (
                                <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {clienteDestino.horarioApertura}
                                </span>
                            )}
                        </div>
                    </div>
                    {onCambiarCliente && (
                        <Button variant="outline" size="sm" onClick={onCambiarCliente}>
                            <User className="h-4 w-4 mr-1" />
                            Cambiar
                        </Button>
                    )}
                </div>
            </div>

            {/* Mapa */}
            <div ref={mapRef} className="flex-1 min-h-[300px]" />

            {/* Selector de rutas */}
            <div className="p-4 border-t bg-card space-y-2">
                <p className="text-sm font-medium mb-3">Elegí cómo llegar:</p>

                {rutasAlternativas.map((ruta, index) => (
                    <Card
                        key={index}
                        className={`cursor-pointer transition-all ${index === rutaSeleccionada
                                ? 'ring-2 ring-primary border-primary'
                                : 'hover:border-primary/50'
                            }`}
                        onClick={() => setRutaSeleccionada(index)}
                    >
                        <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{COLORES_RUTAS[index]?.label || '⚪'}</span>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold">
                                                {formatearDuracion(ruta.duracion)}
                                            </span>
                                            <span className="text-muted-foreground">•</span>
                                            <span className="text-muted-foreground">
                                                {formatearDistancia(ruta.distancia)}
                                            </span>
                                            {ruta.esPreferida && (
                                                <Badge variant="secondary" className="text-xs">
                                                    <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                                                    Preferida
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            via {ruta.resumen}
                                        </p>
                                    </div>
                                </div>
                                {index === rutaSeleccionada && (
                                    <ChevronRight className="h-5 w-5 text-primary" />
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {/* Botón confirmar */}
                <Button
                    className="w-full mt-4"
                    size="lg"
                    onClick={handleConfirmar}
                >
                    Iniciar navegación
                    <ChevronRight className="h-5 w-5 ml-2" />
                </Button>
            </div>
        </div>
    )
}
