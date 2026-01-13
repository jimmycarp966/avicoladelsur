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
    retirosIniciales?: any[]
}

export function ValidarRutasRealtime({ rutasIniciales, cajas, retirosIniciales = [] }: ValidarRutasRealtimeProps) {
    const [rutas, setRutas] = useState(rutasIniciales)
    const [retiros, setRetiros] = useState(retirosIniciales)
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
                        // Para pedidos agrupados, usar entregas_individuales
                        const tieneEntregasIndividuales = ruta.entregas_individuales && ruta.entregas_individuales.length > 0

                        // Calcular entregas con pago
                        let entregasConPago: any[] = []
                        let pagosPorMetodo: Record<string, number> = {}

                        if (tieneEntregasIndividuales) {
                            // Usar datos calculados del servidor
                            pagosPorMetodo = ruta.pagos_por_metodo || {}
                            entregasConPago = ruta.entregas_individuales.filter(
                                (e: any) => ['pagado', 'cuenta_corriente', 'parcial'].includes(e.estado_pago)
                            )
                        } else {
                            // Pedidos simples - usar detalles_ruta
                            entregasConPago = ruta.detalles_ruta?.filter(
                                (d: any) => d.pago_registrado && d.monto_cobrado_registrado > 0
                            ) || []

                            entregasConPago.forEach((detalle: any) => {
                                const metodo = detalle.metodo_pago_registrado || 'efectivo'
                                pagosPorMetodo[metodo] = (pagosPorMetodo[metodo] || 0) + Number(detalle.monto_cobrado_registrado)
                            })
                        }

                        // Usar recaudación calculada si está disponible
                        const totalRegistrado = ruta.recaudacion_calculada || ruta.recaudacion_total_registrada || 0

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
                                            {entregasConPago.map((item: any, index: number) => {
                                                // Determinar si es entrega individual o detalle_ruta
                                                const esEntregaIndividual = !!item.cliente_id
                                                const clienteNombre = esEntregaIndividual
                                                    ? (item.cliente?.nombre || 'Cliente')
                                                    : (item.pedido?.cliente?.nombre || 'Cliente')
                                                const metodoPago = esEntregaIndividual
                                                    ? item.metodo_pago
                                                    : item.metodo_pago_registrado
                                                const estadoPago = esEntregaIndividual
                                                    ? item.estado_pago
                                                    : 'pagado'
                                                const montoCobrado = esEntregaIndividual
                                                    ? (item.monto_cobrado || 0)
                                                    : (item.monto_cobrado_registrado || 0)
                                                const montoTotal = esEntregaIndividual
                                                    ? (item.total || 0)
                                                    : (item.pedido?.total || 0)
                                                const numeroPedido = esEntregaIndividual
                                                    ? `ENT-${index + 1}`
                                                    : item.pedido?.numero_pedido

                                                return (
                                                    <div
                                                        key={item.id}
                                                        className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                                                    >
                                                        <div className="flex-1">
                                                            <span className="font-medium">
                                                                #{item.orden_entrega || index + 1} - {clienteNombre}
                                                            </span>
                                                            <span className="text-muted-foreground ml-2">
                                                                ({numeroPedido})
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <Badge
                                                                variant="outline"
                                                                className={`text-xs capitalize ${estadoPago === 'cuenta_corriente' ? 'bg-amber-100 text-amber-800' :
                                                                        estadoPago === 'parcial' ? 'bg-orange-100 text-orange-800' :
                                                                            'bg-green-100 text-green-800'
                                                                    }`}
                                                            >
                                                                {estadoPago === 'cuenta_corriente' ? '📒 Cuenta corriente' :
                                                                    estadoPago === 'parcial' ? `💰 Parcial` :
                                                                        metodoPago?.replace('_', ' ') || 'efectivo'}
                                                            </Badge>
                                                            <span className="font-semibold">
                                                                {estadoPago === 'cuenta_corriente'
                                                                    ? `$${Number(montoTotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                                                                    : estadoPago === 'parcial'
                                                                        ? `$${Number(montoCobrado).toLocaleString('es-AR', { minimumFractionDigits: 2 })} / $${Number(montoTotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                                                                        : `$${Number(montoCobrado).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                                                                }
                                                            </span>
                                                        </div>
                                                    </div>
                                                )
                                            })}
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

            {/* Separador entre rutas y retiros */}
            {rutas.length > 0 && retiros.length > 0 && (
                <Separator className="my-6" />
            )}

            {/* Retiros de sucursales pendientes */}
            {retiros.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <DollarSign className="h-6 w-6 text-green-600" />
                        Retiros de Sucursales Pendientes
                    </h2>
                    <p className="text-muted-foreground">
                        Dinero de sucursales que debe ser validado y acreditado en caja central
                    </p>

                    {retiros.map((retiro: any) => {
                        const formatearMoneda = (monto: number) => {
                            return new Intl.NumberFormat('es-AR', {
                                style: 'currency',
                                currency: 'ARS',
                                minimumFractionDigits: 2
                            }).format(monto)
                        }

                        const formatearFecha = (fecha: string) => {
                            return new Date(fecha).toLocaleDateString('es-AR', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })
                        }

                        return (
                            <Card key={retiro.id} className="border-l-4 border-l-green-500">
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <CardTitle className="flex items-center gap-2">
                                                <DollarSign className="h-5 w-5 text-green-600" />
                                                Retiro de {retiro.sucursal?.nombre}
                                            </CardTitle>
                                            <CardDescription className="mt-2">
                                                <div className="flex flex-wrap gap-4 text-sm">
                                                    <span>
                                                        Fecha: {formatearFecha(retiro.created_at)}
                                                    </span>
                                                    {retiro.vehiculo && (
                                                        <span>
                                                            Vehículo: {retiro.vehiculo?.patente}
                                                        </span>
                                                    )}
                                                    {retiro.chofer_nombre && (
                                                        <span>
                                                            Chofer: {retiro.chofer_nombre}
                                                        </span>
                                                    )}
                                                </div>
                                            </CardDescription>
                                        </div>
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                            Pendiente
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* Monto del retiro */}
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-semibold text-green-900 flex items-center gap-2">
                                                <DollarSign className="h-4 w-4" />
                                                Monto del Retiro
                                            </h4>
                                            <span className="text-2xl font-bold text-green-900">
                                                {formatearMoneda(retiro.monto)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Detalle de arqueo si existe */}
                                    {retiro.arqueo && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                            <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                                                <CheckCircle2 className="h-4 w-4" />
                                                Detalle de Arqueo
                                            </h4>
                                            <div className="grid grid-cols-3 gap-2 mb-3">
                                                <div className="p-2 bg-white rounded">
                                                    <p className="text-xs text-muted-foreground">Esperado</p>
                                                    <p className="font-semibold text-blue-900">{formatearMoneda(retiro.arqueo.esperado)}</p>
                                                </div>
                                                <div className="p-2 bg-white rounded">
                                                    <p className="text-xs text-muted-foreground">Real</p>
                                                    <p className="font-semibold text-blue-900">{formatearMoneda(retiro.arqueo.real)}</p>
                                                </div>
                                                <div className={`p-2 rounded ${
                                                    retiro.arqueo.diferencia > 0 ? 'bg-green-100' :
                                                    retiro.arqueo.diferencia < 0 ? 'bg-red-100' :
                                                    'bg-white'
                                                }`}>
                                                    <p className="text-xs text-muted-foreground">Diferencia</p>
                                                    <p className={`font-semibold ${
                                                        retiro.arqueo.diferencia > 0 ? 'text-green-900' :
                                                        retiro.arqueo.diferencia < 0 ? 'text-red-900' :
                                                        'text-blue-900'
                                                    }`}>
                                                        {retiro.arqueo.diferencia > 0 ? '+' : ''}{formatearMoneda(retiro.arqueo.diferencia)}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Desglose de billetes */}
                                            {retiro.arqueo.billetes && retiro.arqueo.billetes.length > 0 && (
                                                <div className="mt-3">
                                                    <p className="text-sm font-medium mb-2">Desglose de billetes:</p>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                        {retiro.arqueo.billetes.map((billete: any, idx: number) => (
                                                            <div key={idx} className="p-2 bg-white rounded text-sm">
                                                                <div className="flex justify-between">
                                                                    <span className="text-muted-foreground">
                                                                        ${billete.denominacion.toLocaleString('es-AR')}
                                                                    </span>
                                                                    <span className="font-medium">x{billete.cantidad}</span>
                                                                </div>
                                                                <div className="text-right font-semibold text-blue-900">
                                                                    {formatearMoneda(billete.subtotal)}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Observaciones */}
                                            {retiro.arqueo.observaciones && (
                                                <div className="mt-3 p-2 bg-white rounded">
                                                    <p className="text-sm font-medium mb-1">Observaciones:</p>
                                                    <p className="text-sm text-muted-foreground">{retiro.arqueo.observaciones}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Descripción del retiro */}
                                    {retiro.descripcion && (
                                        <div className="text-sm text-muted-foreground">
                                            <span className="font-medium">Descripción:</span> {retiro.descripcion}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
