'use client'

/**
 * RutaMapaClient - Client wrapper for driver's map page with navigation toggle
 */

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Navigation } from 'lucide-react'
import RutaMap from '@/components/reparto/RutaMap'
import NavigationView from '@/components/reparto/NavigationView'
import GpsTracker from '@/components/reparto/GpsTracker'

interface DetalleRuta {
    id: string
    orden_entrega: number
    estado_entrega: string
    pedido?: {
        cliente?: {
            id: string
            nombre: string
            direccion?: string
            telefono?: string
            coordenadas?: { lat: number; lng: number } | null
        }
    }
}

interface RutaData {
    id: string
    numero_ruta: string
    fecha_ruta: string
    turno: 'mañana' | 'tarde'
    estado: string
    repartidor_id: string
    vehiculo_id: string
    zona?: { nombre: string }
    vehiculo?: { patente: string; marca: string; modelo: string }
    detalles_ruta?: DetalleRuta[]
}

interface RutaMapaClientProps {
    ruta: RutaData
    puedeTrackear: boolean
}

export default function RutaMapaClient({ ruta, puedeTrackear }: RutaMapaClientProps) {
    const [isNavigating, setIsNavigating] = useState(false)
    const [deliveredStops, setDeliveredStops] = useState<Set<string>>(new Set())

    // Transform detalles_ruta to navigation stops format
    const stops = (ruta.detalles_ruta || [])
        .filter(d => d.pedido?.cliente?.coordenadas)
        .map(d => ({
            id: d.id,
            orden: d.orden_entrega,
            cliente_nombre: d.pedido?.cliente?.nombre || 'Cliente',
            direccion: d.pedido?.cliente?.direccion,
            telefono: d.pedido?.cliente?.telefono,
            lat: d.pedido?.cliente?.coordenadas?.lat || 0,
            lng: d.pedido?.cliente?.coordenadas?.lng || 0,
            estado: deliveredStops.has(d.id)
                ? 'entregado' as const
                : (d.estado_entrega === 'entregado' ? 'entregado' as const : 'pendiente' as const)
        }))
        .sort((a, b) => a.orden - b.orden)

    const handleDeliveryComplete = useCallback(async (stopId: string) => {
        // Mark as delivered locally
        setDeliveredStops(prev => new Set([...prev, stopId]))

        // Update in database
        try {
            await fetch(`/api/reparto/entregas/${stopId}/completar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: 'entregado' })
            })
        } catch (err) {
            console.error('Error updating delivery:', err)
        }
    }, [])

    const handleCloseNavigation = useCallback(() => {
        setIsNavigating(false)
    }, [])

    // If navigating, show full-screen navigation
    if (isNavigating) {
        return (
            <NavigationView
                rutaId={ruta.id}
                stops={stops}
                onClose={handleCloseNavigation}
                onDeliveryComplete={handleDeliveryComplete}
            />
        )
    }

    return (
        <>
            <Card>
                <CardHeader className="border-b bg-muted/50">
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            Mapa de Ruta
                            <Badge variant={ruta.estado === 'en_curso' ? 'default' : 'secondary'}>
                                {ruta.estado}
                            </Badge>
                        </CardTitle>

                        {/* Navigation button */}
                        {puedeTrackear && stops.length > 0 && (
                            <Button
                                onClick={() => setIsNavigating(true)}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                <Navigation className="mr-2 h-4 w-4" />
                                Iniciar Navegación
                            </Button>
                        )}
                    </div>

                    <div className="grid grid-cols-4 gap-4 pt-2 text-muted-foreground text-sm">
                        <div>
                            <span className="text-xs uppercase tracking-wide block">Vehículo</span>
                            <p className="font-semibold text-foreground">
                                {ruta.vehiculo?.patente || 'N/A'}
                            </p>
                        </div>
                        <div>
                            <span className="text-xs uppercase tracking-wide block">Turno</span>
                            <p className="font-semibold text-foreground">
                                {ruta.turno === 'mañana' ? 'Mañana' : 'Tarde'}
                            </p>
                        </div>
                        <div>
                            <span className="text-xs uppercase tracking-wide block">Zona</span>
                            <p className="font-semibold text-foreground">
                                {ruta.zona?.nombre || 'Sin zona'}
                            </p>
                        </div>
                        <div>
                            <span className="text-xs uppercase tracking-wide block">Entregas</span>
                            <p className="font-semibold text-foreground">
                                {stops.filter(s => s.estado === 'entregado').length} / {stops.length}
                            </p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <RutaMap
                        rutaId={ruta.id}
                        entregas={ruta.detalles_ruta || []}
                        showGpsTracking={puedeTrackear}
                        repartidorId={ruta.repartidor_id}
                        vehiculoId={ruta.vehiculo_id}
                    />
                </CardContent>
            </Card>

            {puedeTrackear && (
                <GpsTracker
                    repartidorId={ruta.repartidor_id}
                    vehiculoId={ruta.vehiculo_id}
                    rutaId={ruta.id}
                />
            )}
        </>
    )
}
