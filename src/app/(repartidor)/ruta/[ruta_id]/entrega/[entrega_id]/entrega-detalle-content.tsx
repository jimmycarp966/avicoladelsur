'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  CheckCircle,
  DollarSign,
  MapPin,
  FileText,
  Navigation,
  Phone,
  Package,
  RefreshCw,
  ArrowLeft,
  RotateCcw,
  PartyPopper,
  Home,
} from 'lucide-react'
import Link from 'next/link'
import { actualizarEstadoEntrega, finalizarRutaAction } from '@/actions/reparto.actions'
import { createClient } from '@/lib/supabase/client'

interface EntregaDetalleContentProps {
  entrega: any
  resumenCuenta?: any
}

const motivosDevolucion = [
  { value: 'producto_dañado', label: 'Producto dañado' },
  { value: 'cantidad_erronea', label: 'Cantidad errónea' },
  { value: 'no_solicitado', label: 'No solicitado' },
  { value: 'cliente_ausente', label: 'Cliente ausente' },
  { value: 'otro', label: 'Otro' },
]

export function EntregaDetalleContent({ entrega, resumenCuenta }: EntregaDetalleContentProps) {
  const router = useRouter()
  const pedido = entrega.pedido
  const cliente = pedido?.cliente
  const productos = pedido?.detalle_pedido || []

  const [estadoPago, setEstadoPago] = useState<'pagado' | 'pendiente' | 'pagara_despues' | 'pago_parcial' | 'rechazado' | 'cuenta_corriente' | ''>(
    entrega.pago_registrado ? 'pagado' : ''
  )
  const [metodoPago, setMetodoPago] = useState(entrega.metodo_pago_registrado || 'efectivo')
  const [montoCobrado, setMontoCobrado] = useState<string>(
    String(entrega.monto_cobrado_registrado || pedido?.total || '')
  )
  const [numeroTransaccion, setNumeroTransaccion] = useState(entrega.numero_transaccion_registrado || '')
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null)
  const [comprobanteUrl, setComprobanteUrl] = useState(entrega.comprobante_url_registrado || '')
  const [notasEntrega, setNotasEntrega] = useState(entrega.notas_pago || entrega.notas_entrega || '')
  const [metodoPagoFuturo, setMetodoPagoFuturo] = useState('efectivo')
  const [montoParcial, setMontoParcial] = useState('')
  const [motivoRechazo, setMotivoRechazo] = useState('')
  const [pagoLoading, setPagoLoading] = useState(false)

  const [productoId, setProductoId] = useState(productos[0]?.producto_id || '')
  const [cantidadDevolucion, setCantidadDevolucion] = useState('')
  const [motivoDevolucion, setMotivoDevolucion] = useState('')
  const [observacionesDevolucion, setObservacionesDevolucion] = useState('')
  const [devolucionLoading, setDevolucionLoading] = useState(false)

  // Estado para selección de facturas
  const [facturasSeleccionadas, setFacturasSeleccionadas] = useState<string[]>([])
  const facturasPendientes = resumenCuenta?.facturas_pendientes || []

  const [estadoLoading, setEstadoLoading] = useState(false)

  // Estado para modal de ruta completada
  const [showRutaCompletadaModal, setShowRutaCompletadaModal] = useState(false)
  const [resumenRuta, setResumenRuta] = useState<{
    totalEntregas: number
    totalRecaudado: number
  } | null>(null)

  const handleRegistrarPago = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    console.log('[handleRegistrarPago] entrega:', entrega)
    console.log('[handleRegistrarPago] pedido:', pedido)
    console.log('[handleRegistrarPago] pedido?.id:', pedido?.id)
    console.log('[handleRegistrarPago] entrega.id:', entrega.id)
    console.log('[handleRegistrarPago] entrega.pedido_id:', (entrega as any).pedido_id)

    // Usar pedido?.id o fallback a entrega.pedido_id (para entregas individuales)
    const pedidoId = pedido?.id || (entrega as any).pedido_id

    if (!pedidoId) {
      toast.error('Error: No se encontró el ID del pedido')
      return
    }

    if (!estadoPago) {
      toast.error('Selecciona el estado del pago')
      return
    }

    setPagoLoading(true)

    // Preparar datos según el estado de pago
    const bodyData: any = {
      pedido_id: pedidoId, // Usar la variable con fallback
      entrega_id: entrega.id, // Para entregas individuales (pedidos agrupados)
      notas_entrega: notasEntrega || undefined,
    }

    if (estadoPago === 'pagado') {
      // Si ya pagó, incluir método y monto
      bodyData.metodo_pago = metodoPago
      bodyData.monto_cobrado = montoCobrado ? Number(montoCobrado) : 0
      bodyData.numero_transaccion = numeroTransaccion || undefined
      bodyData.comprobante_url = comprobanteUrl || undefined
    } else if (estadoPago === 'cuenta_corriente') {
      // Todo a cuenta corriente - no se cobra nada
      bodyData.metodo_pago = 'cuenta_corriente'
      bodyData.monto_cobrado = 0
      bodyData.monto_cuenta_corriente = pedido?.total || 0
      bodyData.es_cuenta_corriente = true
    } else if (estadoPago === 'pendiente') {
      // Si está pendiente, solo registrar método futuro
      bodyData.metodo_pago = metodoPagoFuturo
      bodyData.monto_cobrado = 0
    } else if (estadoPago === 'pagara_despues') {
      // Si pagará después, no registrar monto
      bodyData.monto_cobrado = 0
    } else if (estadoPago === 'pago_parcial') {
      // Pago parcial: registrar método y monto parcial, resto a cuenta corriente
      bodyData.metodo_pago = metodoPago
      bodyData.monto_cobrado = Number(montoParcial) || 0
      bodyData.monto_cuenta_corriente = (pedido?.total || 0) - (Number(montoParcial) || 0)
      bodyData.es_pago_parcial = true
    } else if (estadoPago === 'rechazado') {
      // Pedido rechazado: registrar motivo
      bodyData.monto_cobrado = 0
      bodyData.motivo_rechazo = motivoRechazo || 'Sin motivo especificado'
      bodyData.estado_entrega = 'rechazado'
    }

    // Agregar facturas adicionales si se seleccionaron
    if (facturasSeleccionadas.length > 0) {
      bodyData.facturas_pagadas = facturasSeleccionadas
    }

    const response = await fetch('/api/reparto/entrega', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData),
    })
    setPagoLoading(false)

    if (!response.ok) {
      const error = await response.json()
      toast.error(error.message || 'Error al registrar el pago')
      return
    }

    const result = await response.json()
    toast.success(result.data?.nota || 'Información de pago registrada correctamente')

    // Redirigir a la navegación interactiva tras el cobro
    setTimeout(() => {
      router.push(`/ruta/${entrega.ruta_id}/mapa`)
    }, 1500)
  }

  const handleRegistrarDevolucion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!pedido?.id || !productoId) {
      toast.error('Selecciona un producto válido')
      return
    }

    const cantidad = Number(cantidadDevolucion)
    if (!cantidad || cantidad <= 0) {
      toast.error('Ingresa una cantidad válida')
      return
    }

    setDevolucionLoading(true)
    const response = await fetch('/api/reparto/devoluciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pedido_id: pedido.id,
        detalle_ruta_id: entrega.id,
        producto_id: productoId,
        cantidad,
        motivo: motivoDevolucion,
        observaciones: observacionesDevolucion || undefined,
      }),
    })
    setDevolucionLoading(false)

    if (!response.ok) {
      const error = await response.json()
      toast.error(error.message || 'Error al registrar la devolución')
      return
    }

    toast.success('Devolución registrada')
    setCantidadDevolucion('')
    setObservacionesDevolucion('')
    router.refresh()
  }

  const handleMarcarEntregado = async () => {
    setEstadoLoading(true)
    const result = await actualizarEstadoEntrega(entrega.id, 'entregado')

    if (result.success) {
      // Verificar si era la última entrega pendiente
      const supabase = createClient()

      // Obtener todas las entregas de la ruta (tanto de detalles_ruta como entregas individuales)
      const { data: detallesRuta } = await supabase
        .from('detalles_ruta')
        .select('id, estado_entrega, pedido_id')
        .eq('ruta_id', entrega.ruta_id)

      // Para pedidos agrupados, verificar entregas individuales
      let todasCompletadas = true
      let totalEntregas = 0
      let totalRecaudado = 0

      if (detallesRuta) {
        for (const detalle of detallesRuta) {
          // Verificar si tiene entregas individuales (pedido agrupado)
          const { data: entregasIndividuales } = await supabase
            .from('entregas')
            .select('id, estado_entrega, monto_cobrado')
            .eq('pedido_id', detalle.pedido_id)

          if (entregasIndividuales && entregasIndividuales.length > 0) {
            // Es pedido agrupado - verificar cada entrega individual
            for (const ei of entregasIndividuales) {
              totalEntregas++
              totalRecaudado += ei.monto_cobrado || 0
              if (ei.estado_entrega !== 'entregado' && ei.estado_entrega !== 'rechazado') {
                todasCompletadas = false
              }
            }
          } else {
            // Es pedido individual
            totalEntregas++
            if (detalle.estado_entrega !== 'entregado' && detalle.estado_entrega !== 'rechazado') {
              todasCompletadas = false
            }
          }
        }
      }

      setEstadoLoading(false)

      if (todasCompletadas && totalEntregas > 0) {
        // ¡Última entrega! Mostrar modal de ruta completada
        setResumenRuta({
          totalEntregas,
          totalRecaudado
        })
        setShowRutaCompletadaModal(true)

        // Intentar finalizar la ruta automáticamente
        try {
          await finalizarRutaAction(entrega.ruta_id)
        } catch (err) {
          console.log('No se pudo finalizar la ruta automáticamente:', err)
        }
      } else {
        // Hay más entregas - ir al siguiente cliente
        toast.success('Entrega completada - Siguiente cliente')
        router.push(`/ruta/${entrega.ruta_id}`)
      }
    } else {
      setEstadoLoading(false)
      toast.error(result.error || 'No se pudo actualizar el estado')
    }
  }

  const metodosPagoArray = Array.isArray(pedido?.metodos_pago) ? pedido?.metodos_pago : []

  return (
    <div className="space-y-6 p-4 pb-32">
      <Button asChild variant="ghost" className="mb-2 w-fit">
        <Link href={`/ruta/${entrega.ruta_id}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a la ruta
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Pedido {pedido?.numero_pedido}
          </CardTitle>
          <CardDescription>
            Ruta {entrega.ruta?.numero_ruta} • Orden #{entrega.orden_entrega}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Cliente</p>
            <p className="text-lg font-semibold">{cliente?.nombre || 'Cliente'}</p>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {cliente?.direccion || 'Dirección no disponible'}
            </p>
            {cliente?.telefono && (
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                {cliente.telefono}
              </p>
            )}
          </div>

          <Separator />

          {metodosPagoArray.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Métodos de pago admitidos</p>
              <div className="flex flex-wrap gap-2">
                {metodosPagoArray.map((metodo: any, index: number) => (
                  <Badge key={`${metodo.metodo || metodo.tipo}-${index}`} variant="outline" className="text-xs">
                    {(metodo.metodo || metodo.tipo || 'metodo').replace('_', ' ')}
                    {metodo.recargo ? ` • +$${metodo.recargo}` : ''}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {pedido?.instrucciones_repartidor && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm flex gap-2">
              <FileText className="h-4 w-4 text-yellow-700" />
              <span>{pedido.instrucciones_repartidor}</span>
            </div>
          )}

          {productos.length > 0 ? (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Productos a entregar</p>
              <div className="space-y-2 text-sm bg-gray-50 p-3 rounded-lg border">
                {productos.map((detalle: any, index: number) => (
                  <div key={detalle.id || index} className="flex items-center justify-between py-1 border-b last:border-b-0">
                    <span className="font-medium">{detalle.producto?.nombre || detalle.producto?.codigo || 'Producto'}</span>
                    <Badge variant="secondary">
                      {detalle.cantidad} {detalle.producto?.unidad_medida || 'un'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">
              (Productos no disponibles para esta entrega)
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between bg-primary/5 p-4 rounded-lg">
            <p className="text-lg font-semibold">Total a cobrar</p>
            <p className="text-2xl font-bold text-primary">
              ${(pedido?.total || 0).toLocaleString('es-AR')}
            </p>
          </div>

          {cliente?.coordenadas && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              asChild
            >
              <Link
                href={`https://www.google.com/maps/dir/?api=1&destination=${cliente.coordenadas.lat},${cliente.coordenadas.lng}`}
                target="_blank"
              >
                <Navigation className="mr-2 h-4 w-4" />
                Abrir en Google Maps
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Acciones principales */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4" />
              Estado de pago
            </CardTitle>
            <CardDescription>
              Registra el estado del pago del cliente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleRegistrarPago}>
              <div className="space-y-1">
                <Label>Estado del pago *</Label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={estadoPago}
                  onChange={(e) => setEstadoPago(e.target.value as any)}
                  required
                >
                  <option value="">Selecciona un estado</option>
                  <option value="pagado">💵 Pagó total (efectivo/transferencia/QR/tarjeta)</option>
                  <option value="cuenta_corriente">📒 Todo a cuenta corriente</option>
                  <option value="pago_parcial">💰 Pago parcial + resto a cuenta corriente</option>
                  <option value="pendiente">⏳ Pendiente (pagará después)</option>
                  <option value="rechazado">❌ Rechazó el pedido</option>
                </select>
              </div>

              {/* Selector de facturas pendientes si existen */}
              {facturasPendientes.length > 0 && estadoPago !== 'rechazado' && (
                <div className="bg-slate-50 border rounded-md p-3 space-y-2">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    ¿Desea incluir facturas vencidas?
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    {facturasPendientes.map((factura: any) => (
                      <label key={factura.id} className="flex items-center justify-between p-2 hover:bg-white rounded border cursor-pointer">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={facturasSeleccionadas.includes(factura.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFacturasSeleccionadas([...facturasSeleccionadas, factura.id])
                                // Al seleccionar una factura, sumamos su saldo al monto cobrado si está en modo 'pagado'
                                if (estadoPago === 'pagado') {
                                  const actual = parseFloat(montoCobrado) || 0
                                  setMontoCobrado((actual + parseFloat(factura.saldo_pendiente)).toFixed(2))
                                }
                              } else {
                                setFacturasSeleccionadas(facturasSeleccionadas.filter(id => id !== factura.id))
                                if (estadoPago === 'pagado') {
                                  const actual = parseFloat(montoCobrado) || 0
                                  setMontoCobrado(Math.max(0, actual - parseFloat(factura.saldo_pendiente)).toFixed(2))
                                }
                              }
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{factura.numero_factura}</span>
                            <span className="text-xs text-muted-foreground">{new Date(factura.fecha_emision).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-red-600">
                          ${parseFloat(factura.saldo_pendiente).toLocaleString('es-AR')}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground italic">
                    Seleccione las facturas que el cliente abonará adicionalmente hoy.
                  </p>
                </div>
              )}

              {estadoPago === 'pagado' && (
                <>
                  <div className="space-y-1">
                    <Label>Método de pago *</Label>
                    <select
                      className="w-full rounded-md border px-3 py-2 text-sm"
                      value={metodoPago}
                      onChange={(e) => setMetodoPago(e.target.value)}
                      required
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="qr">QR</option>
                      <option value="tarjeta">Tarjeta</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label>Monto cobrado *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={montoCobrado}
                      onChange={(e) => setMontoCobrado(e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>

                  {metodoPago === 'transferencia' && (
                    <div className="space-y-1">
                      <Label>N.º de transacción</Label>
                      <Input
                        value={numeroTransaccion}
                        onChange={(e) => setNumeroTransaccion(e.target.value)}
                        placeholder="Banco Nación, etc."
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label>Comprobante (foto)</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setComprobanteFile(file)
                          // Crear URL temporal para preview
                          setComprobanteUrl(URL.createObjectURL(file))
                        }
                      }}
                    />
                    {comprobanteUrl && (
                      <img
                        src={comprobanteUrl}
                        alt="Comprobante"
                        className="mt-2 max-h-32 rounded border"
                      />
                    )}
                  </div>
                </>
              )}

              {/* Cuenta corriente - Todo el monto va a deuda del cliente */}
              {estadoPago === 'cuenta_corriente' && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                  <p className="font-medium text-amber-800">📒 Cargar a cuenta corriente</p>
                  <p className="text-sm text-amber-700 mt-1">
                    El monto de <strong>${pedido?.total?.toLocaleString('es-AR')}</strong> se cargará
                    como deuda a la cuenta corriente del cliente.
                  </p>
                  <p className="text-xs text-amber-600 mt-2">
                    El repartidor no recibe dinero. La factura quedará como pendiente de pago.
                  </p>
                </div>
              )}

              {estadoPago === 'pendiente' && (
                <div className="space-y-1">
                  <Label>Método de pago previsto</Label>
                  <select
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={metodoPagoFuturo}
                    onChange={(e) => setMetodoPagoFuturo(e.target.value)}
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="qr">QR</option>
                    <option value="tarjeta">Tarjeta</option>
                  </select>
                </div>
              )}

              {estadoPago === 'pago_parcial' && (
                <>
                  <div className="space-y-1">
                    <Label>Método de pago del monto cobrado *</Label>
                    <select
                      className="w-full rounded-md border px-3 py-2 text-sm"
                      value={metodoPago}
                      onChange={(e) => setMetodoPago(e.target.value)}
                      required
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="qr">QR</option>
                      <option value="tarjeta">Tarjeta</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label>Monto cobrado ahora *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={montoParcial}
                      onChange={(e) => setMontoParcial(e.target.value)}
                      placeholder={`Total del pedido: $${pedido?.total || 0}`}
                      required
                    />
                  </div>

                  {/* Resumen de pago parcial */}
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm">
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>Total del pedido:</span>
                        <span className="font-medium">${pedido?.total?.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between text-green-700">
                        <span>💵 Pagó ahora:</span>
                        <span className="font-medium">${(parseFloat(montoParcial) || 0).toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between text-amber-700 border-t pt-1">
                        <span>📒 A cuenta corriente:</span>
                        <span className="font-bold">${((pedido?.total || 0) - (parseFloat(montoParcial) || 0)).toLocaleString('es-AR')}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {estadoPago === 'rechazado' && (
                <div className="space-y-1">
                  <Label>Motivo del rechazo *</Label>
                  <select
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={motivoRechazo}
                    onChange={(e) => setMotivoRechazo(e.target.value)}
                    required
                  >
                    <option value="">Selecciona un motivo</option>
                    <option value="cliente_ausente">Cliente ausente</option>
                    <option value="no_tiene_dinero">No tiene dinero</option>
                    <option value="producto_incorrecto">Producto incorrecto</option>
                    <option value="cambio_de_opinion">Cambió de opinión</option>
                    <option value="direccion_incorrecta">Dirección incorrecta</option>
                    <option value="otro">Otro motivo</option>
                  </select>
                  <div className="bg-red-50 border border-red-200 rounded-md p-2 text-xs text-red-800 mt-2">
                    ⚠️ El pedido quedará registrado como rechazado y el stock se repondrá automáticamente.
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label>Notas</Label>
                <Textarea
                  value={notasEntrega}
                  onChange={(e) => setNotasEntrega(e.target.value)}
                  placeholder="Observaciones sobre el pago o entrega"
                  rows={3}
                />
              </div>

              {entrega.pago_registrado && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-2 text-sm text-blue-800">
                  <p className="font-semibold">Pago ya registrado</p>
                  <p className="text-xs">
                    Método: {entrega.metodo_pago_registrado || 'N/A'} |
                    Monto: ${entrega.monto_cobrado_registrado || 0}
                  </p>
                  <p className="text-xs mt-1">
                    {entrega.pago_validado ? '✓ Validado por tesorería' : '⏳ Pendiente de validación'}
                  </p>
                </div>
              )}

              {/* Factura asociada */}
              {entrega.factura && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-green-800 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Factura {entrega.factura.numero_factura}
                      </p>
                      <p className="text-xs text-green-600">
                        Total: ${entrega.factura.total} | Estado: {entrega.factura.estado}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-green-700 border-green-300 hover:bg-green-100"
                      onClick={() => {
                        // Abrir factura en nueva pestaña (o implementar vista previa)
                        window.open(`/factura/${entrega.factura.id}`, '_blank')
                      }}
                    >
                      Ver Factura
                    </Button>
                  </div>
                </div>
              )}

              <Button type="submit" disabled={pagoLoading} className="w-full">
                {pagoLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <DollarSign className="mr-2 h-4 w-4" />
                    {entrega.pago_registrado ? 'Actualizar información' : 'Registrar estado de pago'}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RotateCcw className="h-4 w-4" />
              Registrar devolución
            </CardTitle>
            <CardDescription>
              Genera un registro formal de devolución para almacén
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleRegistrarDevolucion}>
              <div className="space-y-1">
                <Label>Motivo *</Label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={motivoDevolucion}
                  onChange={(e) => setMotivoDevolucion(e.target.value)}
                  required
                >
                  <option value="">Selecciona un motivo</option>
                  {motivosDevolucion.map(motivo => (
                    <option key={motivo.value} value={motivo.value}>
                      {motivo.label}
                    </option>
                  ))}
                </select>
              </div>

              {motivoDevolucion && (
                <>
                  <div className="space-y-1">
                    <Label>Producto</Label>
                    <select
                      className="w-full rounded-md border px-3 py-2 text-sm"
                      value={productoId}
                      onChange={(e) => setProductoId(e.target.value)}
                      disabled={productos.length === 0}
                    >
                      {productos.length === 0 && <option>No hay productos en el pedido</option>}
                      {productos.map((detalle: any) => (
                        <option key={detalle.id} value={detalle.producto_id}>
                          {detalle.producto?.nombre} ({detalle.cantidad} {detalle.producto?.unidad_medida || 'un'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label>Cantidad a devolver</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={cantidadDevolucion}
                      onChange={(e) => setCantidadDevolucion(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Observaciones</Label>
                    <Textarea
                      value={observacionesDevolucion}
                      onChange={(e) => setObservacionesDevolucion(e.target.value)}
                      placeholder="Detalle la razón de la devolución"
                      rows={3}
                    />
                  </div>
                </>
              )}

              <Button
                type="submit"
                disabled={devolucionLoading || productos.length === 0}
                className="w-full"
                variant="outline"
              >
                {devolucionLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Registrar devolución
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Estado de entrega */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle className="h-4 w-4" />
            Estado de la entrega
          </CardTitle>
          <CardDescription>
            Actualiza el estado una vez que completes la visita
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Badge variant={entrega.estado_entrega === 'entregado' ? 'default' : 'secondary'}>
            {entrega.estado_entrega === 'entregado' ? 'Entregado' : 'Pendiente'}
          </Badge>

          {entrega.estado_entrega !== 'entregado' && (
            <>
              <Button
                onClick={handleMarcarEntregado}
                disabled={estadoLoading || !entrega.pago_registrado}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {estadoLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Marcar como entregado
                  </>
                )}
              </Button>
              {!entrega.pago_registrado && (
                <p className="text-xs text-orange-600 text-center">
                  ⚠️ Debes registrar el estado de pago antes de marcar como entregado
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de Ruta Completada */}
      <Dialog open={showRutaCompletadaModal} onOpenChange={setShowRutaCompletadaModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl">
              <PartyPopper className="h-8 w-8 text-green-500" />
              ¡Ruta Completada!
            </DialogTitle>
            <DialogDescription>
              Has completado todas las entregas de esta ruta
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 space-y-4">
            {/* Resumen */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-3xl font-bold text-green-700">
                    {resumenRuta?.totalEntregas || 0}
                  </p>
                  <p className="text-sm text-green-600">Entregas realizadas</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-green-700">
                    ${resumenRuta?.totalRecaudado?.toLocaleString('es-AR') || 0}
                  </p>
                  <p className="text-sm text-green-600">Total recaudado</p>
                </div>
              </div>
            </div>

            {/* Mensaje */}
            <p className="text-center text-muted-foreground">
              La ruta ha sido marcada como completada. Puedes volver al inicio o revisar el resumen.
            </p>

            {/* Botones */}
            <div className="flex flex-col gap-2">
              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={() => router.push('/home')}
              >
                <Home className="mr-2 h-4 w-4" />
                Ir al Inicio
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setShowRutaCompletadaModal(false)
                  router.push(`/ruta/${entrega.ruta_id}`)
                }}
              >
                Ver resumen de la ruta
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div >
  )
}
