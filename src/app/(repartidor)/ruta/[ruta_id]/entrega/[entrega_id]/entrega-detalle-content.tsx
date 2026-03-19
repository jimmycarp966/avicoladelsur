'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CheckCircle,
  DollarSign,
  FileText,
  Home,
  MapPin,
  Navigation,
  Package,
  PartyPopper,
  Phone,
  RefreshCw,
  RotateCcw,
} from 'lucide-react'

import { actualizarEstadoEntrega } from '@/actions/reparto.actions'
import { createClient } from '@/lib/supabase/client'
import { normalizarEstadoPago, tieneEstadoPagoDefinido, type EstadoPagoType } from '@/lib/utils/estado-pago'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'

interface EntregaDetalleContentProps {
  entrega: any
  resumenCuenta?: any
}

type EstadoPagoForm =
  | Exclude<EstadoPagoType, 'pendiente'>
  | ''

const motivosDevolucion = [
  { value: 'producto_danado', label: 'Producto danado' },
  { value: 'cantidad_erronea', label: 'Cantidad erronea' },
  { value: 'no_solicitado', label: 'No solicitado' },
  { value: 'cliente_ausente', label: 'Cliente ausente' },
  { value: 'otro', label: 'Otro' },
]

function agruparProductos(productos: any[]) {
  return productos.map((producto) => ({
    id: producto.producto_id || producto.id,
    nombre: producto.producto?.nombre || producto.producto?.codigo || 'Producto',
    cantidad: producto.cantidad,
    unidad: producto.producto?.unidad_medida || 'un',
  }))
}

export function EntregaDetalleContent({ entrega, resumenCuenta }: EntregaDetalleContentProps) {
  const router = useRouter()
  const pedido = entrega.pedido
  const cliente = pedido?.cliente
  const productos = agruparProductos(pedido?.detalle_pedido || [])
  const entregaEsAgrupada = Boolean(entrega.detalle_ruta_id_padre || entrega.es_pedido_agrupado)
  const facturasPendientes = resumenCuenta?.facturas_pendientes || []
  const estadoPagoInicial = normalizarEstadoPago(entrega) as Exclude<EstadoPagoType, 'pendiente'> | null

  const [estadoPago, setEstadoPago] = useState<EstadoPagoForm>(estadoPagoInicial || '')
  const [metodoPago, setMetodoPago] = useState(entrega.metodo_pago_registrado || 'efectivo')
  const [metodoPagoFuturo, setMetodoPagoFuturo] = useState(entrega.metodo_pago_registrado || 'efectivo')
  const [montoCobrado, setMontoCobrado] = useState(
    String(entrega.monto_cobrado_registrado || pedido?.total || ''),
  )
  const [montoParcial, setMontoParcial] = useState(
    estadoPagoInicial === 'parcial' ? String(entrega.monto_cobrado_registrado || '') : '',
  )
  const [numeroTransaccion, setNumeroTransaccion] = useState(entrega.numero_transaccion_registrado || '')
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null)
  const [comprobanteUrl, setComprobanteUrl] = useState(entrega.comprobante_url_registrado || '')
  const [notasEntrega, setNotasEntrega] = useState(entrega.notas_pago || entrega.notas_entrega || '')
  const [motivoRechazo, setMotivoRechazo] = useState(entrega.motivo_rechazo || '')
  const [pagoLoading, setPagoLoading] = useState(false)

  const [productoId, setProductoId] = useState(productos[0]?.id || '')
  const [cantidadDevolucion, setCantidadDevolucion] = useState('')
  const [motivoDevolucion, setMotivoDevolucion] = useState('')
  const [observacionesDevolucion, setObservacionesDevolucion] = useState('')
  const [devolucionLoading, setDevolucionLoading] = useState(false)

  const [facturasSeleccionadas, setFacturasSeleccionadas] = useState<string[]>([])
  const [estadoLoading, setEstadoLoading] = useState(false)
  const [showRutaCompletadaModal, setShowRutaCompletadaModal] = useState(false)
  const [resumenRuta, setResumenRuta] = useState<{
    totalEntregas: number
    totalRecaudado: number
  } | null>(null)

  const estadoPagoDefinido = tieneEstadoPagoDefinido({
    ...entrega,
    estado_pago: estadoPago || entrega.estado_pago,
    metodo_pago_registrado: estadoPago === 'pagara_despues' ? metodoPagoFuturo : metodoPago,
    monto_cobrado_registrado: estadoPago === 'parcial'
      ? Number(montoParcial || 0)
      : Number(montoCobrado || entrega.monto_cobrado_registrado || 0),
    notas_pago: notasEntrega,
  })

  const totalPedido = Number(pedido?.total || 0)
  const saldoCuentaCorriente = useMemo(() => {
    if (estadoPago !== 'parcial') return 0
    return Math.max(totalPedido - (Number(montoParcial) || 0), 0)
  }, [estadoPago, montoParcial, totalPedido])

  useEffect(() => {
    return () => {
      if (comprobanteUrl.startsWith('blob:')) {
        URL.revokeObjectURL(comprobanteUrl)
      }
    }
  }, [comprobanteUrl])

  async function handleRegistrarPago(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const pedidoId = pedido?.id || entrega.pedido_id
    if (!pedidoId) {
      toast.error('No se encontro el pedido de esta entrega')
      return
    }

    if (!estadoPago) {
      toast.error('Selecciona un estado de pago')
      return
    }

    setPagoLoading(true)

    try {
      const requestBody = new FormData()
      requestBody.append('pedido_id', pedidoId)
      const notasRegistradas =
        estadoPago === 'pagara_despues' && !notasEntrega.trim()
          ? 'Pagará después'
          : notasEntrega

      requestBody.append('notas_entrega', notasRegistradas || '')

      if (entregaEsAgrupada) {
        requestBody.append('entrega_id', entrega.id)
      }

      if (estadoPago === 'pagado') {
        requestBody.append('metodo_pago', metodoPago)
        requestBody.append('monto_cobrado', String(Number(montoCobrado) || 0))
        if (numeroTransaccion) requestBody.append('numero_transaccion', numeroTransaccion)
      }

      if (estadoPago === 'cuenta_corriente') {
        requestBody.append('metodo_pago', 'cuenta_corriente')
        requestBody.append('monto_cobrado', '0')
        requestBody.append('monto_cuenta_corriente', String(totalPedido))
        requestBody.append('es_cuenta_corriente', 'true')
      }

      if (estadoPago === 'pagara_despues') {
        requestBody.append('metodo_pago', metodoPagoFuturo)
        requestBody.append('monto_cobrado', '0')
      }

      if (estadoPago === 'parcial') {
        requestBody.append('metodo_pago', metodoPago)
        requestBody.append('monto_cobrado', String(Number(montoParcial) || 0))
        requestBody.append('monto_cuenta_corriente', String(saldoCuentaCorriente))
        requestBody.append('es_pago_parcial', 'true')
        if (numeroTransaccion) requestBody.append('numero_transaccion', numeroTransaccion)
      }

      if (estadoPago === 'rechazado') {
        requestBody.append('monto_cobrado', '0')
        requestBody.append('motivo_rechazo', motivoRechazo || 'Sin motivo especificado')
        requestBody.append('estado_entrega', 'rechazado')
      }

      facturasSeleccionadas.forEach((facturaId) => requestBody.append('facturas_pagadas', facturaId))
      if (comprobanteFile) requestBody.append('comprobante_file', comprobanteFile)

      const response = await fetch('/api/reparto/entrega', {
        method: 'POST',
        body: requestBody,
      })

      const result = await response.json()
      if (!response.ok) {
        toast.error(result.message || 'Error al registrar el pago')
        return
      }

      toast.success(result.data?.nota || 'Estado de pago registrado correctamente')
      router.push(`/ruta/${entrega.ruta_id}`)
      router.refresh()
    } finally {
      setPagoLoading(false)
    }
  }

  async function handleRegistrarDevolucion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!pedido?.id || !productoId) {
      toast.error('Selecciona un producto valido')
      return
    }

    const cantidad = Number(cantidadDevolucion)
    if (!cantidad || cantidad <= 0) {
      toast.error('Ingresa una cantidad valida')
      return
    }

    setDevolucionLoading(true)

    try {
      const response = await fetch('/api/reparto/devoluciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedido_id: pedido.id,
          detalle_ruta_id: entrega.detalle_ruta_id_padre || entrega.id,
          producto_id: productoId,
          cantidad,
          motivo: motivoDevolucion,
          observaciones: observacionesDevolucion || undefined,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        toast.error(result.message || 'Error al registrar la devolucion')
        return
      }

      toast.success('Devolucion registrada')
      setCantidadDevolucion('')
      setObservacionesDevolucion('')
      router.refresh()
    } finally {
      setDevolucionLoading(false)
    }
  }

  async function handleMarcarEntregado() {
    setEstadoLoading(true)

    try {
      const result = await actualizarEstadoEntrega(entrega.id, 'entregado')
      if (!result.success) {
        toast.error(result.error || 'No se pudo actualizar el estado')
        return
      }

      const supabase = createClient()
      const { data: detallesRuta } = await supabase
        .from('detalles_ruta')
        .select('id, pedido_id, estado_entrega')
        .eq('ruta_id', entrega.ruta_id)

      let totalEntregas = 0
      let totalRecaudado = 0
      let todasCompletadas = true

      for (const detalle of detallesRuta || []) {
        const { data: entregasIndividuales } = await supabase
          .from('entregas')
          .select('id, estado_entrega, monto_cobrado')
          .eq('pedido_id', detalle.pedido_id)

        if (entregasIndividuales && entregasIndividuales.length > 0) {
          totalEntregas += entregasIndividuales.length
          totalRecaudado += entregasIndividuales.reduce(
            (sum, item) => sum + Number(item.monto_cobrado || 0),
            0,
          )
          if (
            entregasIndividuales.some(
              (item) => !['entregado', 'rechazado'].includes(item.estado_entrega || ''),
            )
          ) {
            todasCompletadas = false
          }
          continue
        }

        totalEntregas += 1
        if (!['entregado', 'rechazado'].includes(detalle.estado_entrega || '')) {
          todasCompletadas = false
        }
      }

      if (todasCompletadas && totalEntregas > 0) {
        setResumenRuta({
          totalEntregas,
          totalRecaudado,
        })
        setShowRutaCompletadaModal(true)
        return
      }

      toast.success('Entrega completada')
      router.push(`/ruta/${entrega.ruta_id}`)
      router.refresh()
    } finally {
      setEstadoLoading(false)
    }
  }

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
            Ruta {entrega.ruta?.numero_ruta} · Orden #{entrega.orden_entrega}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Cliente</p>
            <p className="text-lg font-semibold">{cliente?.nombre || 'Cliente'}</p>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {cliente?.direccion || 'Direccion no disponible'}
            </p>
            {cliente?.telefono && (
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                {cliente.telefono}
              </p>
            )}
          </div>

          {(pedido?.instruccion_repartidor || pedido?.instrucciones_repartidor) && (
            <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm">
              {pedido?.instruccion_repartidor || pedido?.instrucciones_repartidor}
            </div>
          )}

          <Separator />

          {productos.length > 0 ? (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
              {productos.map((producto) => (
                <div key={producto.id} className="flex items-center justify-between">
                  <span className="font-medium">{producto.nombre}</span>
                  <Badge variant="secondary">
                    {producto.cantidad} {producto.unidad}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No hay productos visibles para esta entrega.
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg bg-primary/5 p-4">
            <p className="text-lg font-semibold">Total a resolver</p>
            <p className="text-2xl font-bold text-primary">
              ${totalPedido.toLocaleString('es-AR')}
            </p>
          </div>

          {cliente?.coordenadas && (
            <Button variant="outline" size="sm" className="w-full" asChild>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4" />
              Estado de pago
            </CardTitle>
            <CardDescription>
              Registra como queda resuelto el cobro de esta entrega.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleRegistrarPago}>
              <div className="space-y-1">
                <Label>Estado del pago *</Label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={estadoPago}
                  onChange={(event) => setEstadoPago(event.target.value as EstadoPagoForm)}
                  required
                >
                  <option value="">Selecciona un estado</option>
                  <option value="pagado">Pago total</option>
                  <option value="cuenta_corriente">Todo a cuenta corriente</option>
                  <option value="parcial">Pago parcial + resto a cuenta corriente</option>
                  <option value="pagara_despues">Pagará después</option>
                  <option value="rechazado">Rechazo el pedido</option>
                </select>
              </div>

              {facturasPendientes.length > 0 && estadoPago !== 'rechazado' && (
                <div className="space-y-2 rounded-md border bg-slate-50 p-3">
                  <p className="text-sm font-semibold">Facturas vencidas opcionales</p>
                  <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                    {facturasPendientes.map((factura: any) => (
                      <label
                        key={factura.id}
                        className="flex cursor-pointer items-center justify-between rounded border p-2 hover:bg-white"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={facturasSeleccionadas.includes(factura.id)}
                            onChange={(event) => {
                              if (event.target.checked) {
                                setFacturasSeleccionadas((current) => [...current, factura.id])
                                if (estadoPago === 'pagado') {
                                  const actual = parseFloat(montoCobrado) || 0
                                  setMontoCobrado((actual + Number(factura.saldo_pendiente || 0)).toFixed(2))
                                }
                                return
                              }

                              setFacturasSeleccionadas((current) => current.filter((id) => id !== factura.id))
                              if (estadoPago === 'pagado') {
                                const actual = parseFloat(montoCobrado) || 0
                                setMontoCobrado(
                                  Math.max(0, actual - Number(factura.saldo_pendiente || 0)).toFixed(2),
                                )
                              }
                            }}
                          />
                          <div>
                            <p className="text-sm font-medium">{factura.numero_factura}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(factura.fecha_emision).toLocaleDateString('es-AR')}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-red-600">
                          ${Number(factura.saldo_pendiente || 0).toLocaleString('es-AR')}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {estadoPago === 'pagado' && (
                <>
                  <div className="space-y-1">
                    <Label>Metodo de pago *</Label>
                    <select
                      className="w-full rounded-md border px-3 py-2 text-sm"
                      value={metodoPago}
                      onChange={(event) => setMetodoPago(event.target.value)}
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
                      onChange={(event) => setMontoCobrado(event.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              {estadoPago === 'parcial' && (
                <>
                  <div className="space-y-1">
                    <Label>Metodo del monto cobrado *</Label>
                    <select
                      className="w-full rounded-md border px-3 py-2 text-sm"
                      value={metodoPago}
                      onChange={(event) => setMetodoPago(event.target.value)}
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
                      onChange={(event) => setMontoParcial(event.target.value)}
                      required
                    />
                  </div>

                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Total del pedido</span>
                      <span className="font-medium">${totalPedido.toLocaleString('es-AR')}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-green-700">
                      <span>Cobrado ahora</span>
                      <span className="font-medium">
                        ${(Number(montoParcial) || 0).toLocaleString('es-AR')}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between border-t pt-1 text-amber-700">
                      <span>Cuenta corriente</span>
                      <span className="font-bold">${saldoCuentaCorriente.toLocaleString('es-AR')}</span>
                    </div>
                  </div>
                </>
              )}

              {['pagado', 'parcial'].includes(estadoPago) && (
                <>
                  {metodoPago === 'transferencia' && (
                    <div className="space-y-1">
                      <Label>Número de transacción</Label>
                      <Input
                        value={numeroTransaccion}
                        onChange={(event) => setNumeroTransaccion(event.target.value)}
                        placeholder="Banco Nacion, BNA+, QR, etc."
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label>Comprobante</Label>
                    <Input
                      type="file"
                      accept="image/*,application/pdf"
                      capture="environment"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (!file) return

                        if (comprobanteUrl.startsWith('blob:')) {
                          URL.revokeObjectURL(comprobanteUrl)
                        }

                        setComprobanteFile(file)
                        setComprobanteUrl(URL.createObjectURL(file))
                      }}
                    />
                    {comprobanteUrl && (
                      <img
                        src={comprobanteUrl}
                        alt="Comprobante"
                        className="mt-2 max-h-40 rounded border object-contain"
                      />
                    )}
                  </div>
                </>
              )}

              {estadoPago === 'cuenta_corriente' && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  El total de ${totalPedido.toLocaleString('es-AR')} quedara cargado a cuenta
                  corriente del cliente.
                </div>
              )}

              {estadoPago === 'pagara_despues' && (
                <div className="space-y-1">
                  <Label>Metodo previsto</Label>
                  <select
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={metodoPagoFuturo}
                    onChange={(event) => setMetodoPagoFuturo(event.target.value)}
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="qr">QR</option>
                    <option value="tarjeta">Tarjeta</option>
                  </select>
                </div>
              )}

              {estadoPago === 'rechazado' && (
                <div className="space-y-1">
                  <Label>Motivo del rechazo *</Label>
                  <select
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={motivoRechazo}
                    onChange={(event) => setMotivoRechazo(event.target.value)}
                    required
                  >
                    <option value="">Selecciona un motivo</option>
                    <option value="cliente_ausente">Cliente ausente</option>
                    <option value="no_tiene_dinero">No tiene dinero</option>
                    <option value="producto_incorrecto">Producto incorrecto</option>
                    <option value="cambio_de_opinion">Cambio de opinion</option>
                    <option value="direccion_incorrecta">Direccion incorrecta</option>
                    <option value="otro">Otro motivo</option>
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <Label>Notas</Label>
                <Textarea
                  value={notasEntrega}
                  onChange={(event) => setNotasEntrega(event.target.value)}
                  placeholder="Observaciones sobre el cobro o la entrega"
                  rows={3}
                />
              </div>

              {estadoPagoDefinido && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  <p className="font-semibold">Estado ya registrado</p>
                  <p className="text-xs">
                    Estado: {normalizarEstadoPago(entrega) || 'sin definir'} · Monto: $
                    {Number(entrega.monto_cobrado_registrado || 0).toLocaleString('es-AR')}
                  </p>
                  <p className="text-xs">
                    {entrega.pago_validado ? 'Validado por tesoreria' : 'Pendiente de validacion'}
                  </p>
                </div>
              )}

              {entrega.factura && (
                <div className="rounded-md border border-green-200 bg-green-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 font-semibold text-green-800">
                        <FileText className="h-4 w-4" />
                        Factura {entrega.factura.numero_factura}
                      </p>
                      <p className="text-xs text-green-700">
                        Total: ${entrega.factura.total} · Estado: {entrega.factura.estado}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/factura/${entrega.factura.id}`} target="_blank">
                        Ver factura
                      </Link>
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
                    {estadoPagoDefinido ? 'Actualizar informacion' : 'Registrar estado de pago'}
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
              Registrar devolucion
            </CardTitle>
            <CardDescription>
              Crea un registro formal para almacen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleRegistrarDevolucion}>
              <div className="space-y-1">
                <Label>Motivo *</Label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={motivoDevolucion}
                  onChange={(event) => setMotivoDevolucion(event.target.value)}
                  required
                >
                  <option value="">Selecciona un motivo</option>
                  {motivosDevolucion.map((motivo) => (
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
                      onChange={(event) => setProductoId(event.target.value)}
                      disabled={productos.length === 0}
                    >
                      {productos.length === 0 && <option>No hay productos en el pedido</option>}
                      {productos.map((producto) => (
                        <option key={producto.id} value={producto.id}>
                          {producto.nombre} ({producto.cantidad} {producto.unidad})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label>Cantidad</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={cantidadDevolucion}
                      onChange={(event) => setCantidadDevolucion(event.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Observaciones</Label>
                    <Textarea
                      value={observacionesDevolucion}
                      onChange={(event) => setObservacionesDevolucion(event.target.value)}
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
                    Registrar devolucion
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle className="h-4 w-4" />
            Estado de la entrega
          </CardTitle>
          <CardDescription>
            Marca la entrega cuando la visita realmente haya terminado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Badge
            variant={
              entrega.estado_entrega === 'entregado'
                ? 'default'
                : entrega.estado_entrega === 'rechazado'
                  ? 'destructive'
                  : 'secondary'
            }
          >
            {entrega.estado_entrega === 'entregado'
              ? 'Entregado'
              : entrega.estado_entrega === 'rechazado'
                ? 'Rechazado'
                : 'Pendiente'}
          </Badge>

          {entrega.estado_entrega !== 'entregado' && (
            <>
              <Button
                onClick={handleMarcarEntregado}
                disabled={estadoLoading || !estadoPagoDefinido}
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

              {!estadoPagoDefinido && (
                <p className="text-center text-xs text-orange-600">
                  Debes registrar primero el estado de pago.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showRutaCompletadaModal} onOpenChange={setShowRutaCompletadaModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl">
              <PartyPopper className="h-8 w-8 text-green-500" />
              Ruta completada
            </DialogTitle>
            <DialogDescription>
              Ya no quedan entregas pendientes en esta ruta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-3xl font-bold text-green-700">
                    {resumenRuta?.totalEntregas || 0}
                  </p>
                  <p className="text-sm text-green-600">Entregas resueltas</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-green-700">
                    ${resumenRuta?.totalRecaudado?.toLocaleString('es-AR') || 0}
                  </p>
                  <p className="text-sm text-green-600">Total recaudado</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={() => router.push('/home')}
              >
                <Home className="mr-2 h-4 w-4" />
                Ir al inicio
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
    </div>
  )
}
