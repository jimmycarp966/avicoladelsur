'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ValidarRutaForm } from './validar-ruta-form'
import { CheckCircle2, Clock, DollarSign, Truck, User, Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface ValidarRutasRealtimeProps {
    rutasIniciales: any[]
    cajas: any[]
}

export function ValidarRutasRealtime({ rutasIniciales, cajas }: ValidarRutasRealtimeProps) {
    const [rutas, setRutas] = useState(rutasIniciales)
    const [isConnected, setIsConnected] = useState(false)
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
    const supabase = createClient()

    // Función para recargar los datos
    const refetchData = async () => {
        try {
            // Obtener rutas completadas no validadas con sus detalles
            const { data: rutasData, error } = await supabase
                .from('rutas_reparto')
                .select(`
          id,
          numero_ruta,
          fecha_ruta,
          estado,
          cobros_validados,
          recaudacion_total_registrada,
          zona:zonas_entrega(id, nombre),
          vehiculo:vehiculos(id, patente, marca, modelo),
          repartidor:usuarios!rutas_reparto_repartidor_id_fkey(id, nombre, apellido),
          detalles_ruta(
            id,
            orden_entrega,
            estado_entrega,
            pago_registrado,
            monto_cobrado_registrado,
            metodo_pago_registrado,
            pedido:pedidos(
              id,
              numero_pedido,
              total,
              pago_estado,
              cliente:clientes(id, nombre)
            )
          )
        `)
                .eq('estado', 'completada')
                .eq('cobros_validados', false)
                .order('fecha_ruta', { ascending: false })

            if (error) {
                console.error('Error refetching rutas:', error)
                return
            }

            setRutas(rutasData || [])
            setLastUpdate(new Date())
        } catch (error) {
            console.error('Error en refetch:', error)
        }
    }

    useEffect(() => {
        // Suscribirse a cambios en detalles_ruta (cuando el repartidor registra un pago)
        const channel = supabase
            .channel('validar-rutas-realtime')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'detalles_ruta',
                    filter: 'pago_registrado=eq.true'
                },
                async (payload) => {
                    console.log('[Realtime] Pago registrado:', payload)
                    toast.info('💰 Nuevo pago registrado por repartidor', {
                        description: 'Actualizando datos...',
                        duration: 3000
                    })
                    await refetchData()
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'rutas_reparto'
                },
                async (payload) => {
                    console.log('[Realtime] Ruta actualizada:', payload)
                    // Solo refrescar si cambió el estado a completada
                    if (payload.new && (payload.new as any).estado === 'completada') {
                        toast.info('🚛 Ruta completada', {
                            description: 'Nueva ruta lista para validar',
                            duration: 3000
                        })
                    }
                    await refetchData()
                }
            )
            .subscribe((status) => {
                console.log('[Realtime] Estado conexión:', status)
                setIsConnected(status === 'SUBSCRIBED')
            })

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    // Auto-refresh cada 30 segundos como fallback
    useEffect(() => {
        const interval = setInterval(() => {
            refetchData()
        }, 30000)

        return () => clearInterval(interval)
    }, [])

    return (
        <div className="space-y-4">
            {/* Indicador de conexión realtime */}
            <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                    {isConnected ? (
                        <>
                            <Wifi className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-green-700 font-medium">Conectado en tiempo real</span>
                        </>
                    ) : (
                        <>
                            <WifiOff className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm text-yellow-700 font-medium">Conectando...</span>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {lastUpdate && (
                        <span className="text-xs text-muted-foreground">
                            Última actualización: {lastUpdate.toLocaleTimeString('es-AR')}
                        </span>
                    )}
                    <button
                        onClick={refetchData}
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                        <RefreshCw className="h-3 w-3" />
                        Actualizar
                    </button>
                </div>
            </div>

            {rutas.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center">
                        <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">No hay rutas pendientes de validación</h3>
                        <p className="text-muted-foreground">
                            Todas las rutas completadas han sido validadas
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {rutas.map((ruta: any) => {
                        const entregasConPago = ruta.detalles_ruta?.filter(
                            (d: any) => d.pago_registrado && d.monto_cobrado_registrado > 0
                        ) || []

                        const totalRegistrado = ruta.recaudacion_total_registrada || 0

                        // Agrupar por método de pago
                        const pagosPorMetodo: Record<string, number> = {}
                        entregasConPago.forEach((detalle: any) => {
                            const metodo = detalle.metodo_pago_registrado || 'efectivo'
                            pagosPorMetodo[metodo] = (pagosPorMetodo[metodo] || 0) + Number(detalle.monto_cobrado_registrado)
                        })

                        // Separar totales
                        const totalCaja = Object.entries(pagosPorMetodo)
                            .filter(([metodo]) => metodo !== 'cuenta_corriente')
                            .reduce((sum, [, monto]) => sum + monto, 0)
                        const totalCuentaCorriente = pagosPorMetodo['cuenta_corriente'] || 0

                        return (
                            <Card key={ruta.id} className="border-l-4 border-l-primary">
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <CardTitle className="flex items-center gap-2">
                                                <Truck className="h-5 w-5" />
                                                Ruta {ruta.numero_ruta}
                                            </CardTitle>
                                            <CardDescription className="mt-2">
                                                <div className="flex flex-wrap gap-4 text-sm">
                                                    <span className="flex items-center gap-1">
                                                        <User className="h-4 w-4" />
                                                        {ruta.repartidor?.nombre} {ruta.repartidor?.apellido}
                                                    </span>
                                                    <span>
                                                        Vehículo: {ruta.vehiculo?.patente} ({ruta.vehiculo?.marca} {ruta.vehiculo?.modelo})
                                                    </span>
                                                    <span>
                                                        Fecha: {new Date(ruta.fecha_ruta).toLocaleDateString('es-AR')}
                                                    </span>
                                                    {ruta.zona?.nombre && (
                                                        <span>Zona: {ruta.zona.nombre}</span>
                                                    )}
                                                </div>
                                            </CardDescription>
                                        </div>
                                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                            <Clock className="h-3 w-3 mr-1" />
                                            Pendiente
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* Resumen de recaudación */}
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                                                <DollarSign className="h-4 w-4" />
                                                Recaudación Registrada
                                            </h4>
                                            <span className="text-2xl font-bold text-blue-900">
                                                ${totalRegistrado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>

                                        {totalCaja > 0 && (
                                            <div className="mb-2 p-2 bg-blue-100 rounded text-sm">
                                                <span className="font-medium text-blue-900">Total para caja: </span>
                                                <span className="font-bold text-blue-900">
                                                    ${totalCaja.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        )}

                                        {totalCuentaCorriente > 0 && (
                                            <div className="mb-2 p-2 bg-green-100 rounded text-sm">
                                                <span className="font-medium text-green-900">Total cuenta corriente: </span>
                                                <span className="font-bold text-green-900">
                                                    ${totalCuentaCorriente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                </span>
                                                <span className="text-xs text-green-700 ml-2">(no afecta caja)</span>
                                            </div>
                                        )}

                                        {Object.keys(pagosPorMetodo).length > 0 && (
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                                                {Object.entries(pagosPorMetodo).map(([metodo, monto]) => (
                                                    <div key={metodo} className={`text-sm ${metodo === 'cuenta_corriente' ? 'bg-green-50 p-1 rounded' : ''}`}>
                                                        <span className={`font-medium capitalize ${metodo === 'cuenta_corriente' ? 'text-green-700' : 'text-blue-700'}`}>
                                                            {metodo.replace('_', ' ')}:
                                                        </span>
                                                        <span className={`ml-1 font-semibold ${metodo === 'cuenta_corriente' ? 'text-green-900' : 'text-blue-900'}`}>
                                                            ${Number(monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Lista de entregas con pagos */}
                                    <div>
                                        <h4 className="font-semibold mb-2">Entregas con pago registrado ({entregasConPago.length})</h4>
                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                            {entregasConPago.map((detalle: any) => (
                                                <div
                                                    key={detalle.id}
                                                    className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                                                >
                                                    <div className="flex-1">
                                                        <span className="font-medium">
                                                            #{detalle.orden_entrega} - {detalle.pedido?.cliente?.nombre || 'Cliente'}
                                                        </span>
                                                        <span className="text-muted-foreground ml-2">
                                                            ({detalle.pedido?.numero_pedido})
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <Badge variant="outline" className="text-xs capitalize">
                                                            {detalle.metodo_pago_registrado?.replace('_', ' ') || 'efectivo'}
                                                        </Badge>
                                                        <span className="font-semibold">
                                                            ${Number(detalle.monto_cobrado_registrado).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <Separator />

                                    {/* Formulario de validación */}
                                    <ValidarRutaForm ruta={ruta} cajas={cajas || []} />
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
