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
} from 'lucide-react'
import Link from 'next/link'
import { actualizarEstadoEntrega } from '@/actions/reparto.actions'

interface EntregaDetalleContentProps {
  entrega: any
}

const motivosDevolucion = [
  { value: 'producto_dañado', label: 'Producto dañado' },
  { value: 'cantidad_erronea', label: 'Cantidad errónea' },
  { value: 'no_solicitado', label: 'No solicitado' },
  { value: 'cliente_ausente', label: 'Cliente ausente' },
  { value: 'otro', label: 'Otro' },
]

export function EntregaDetalleContent({ entrega }: EntregaDetalleContentProps) {
  const router = useRouter()
  const pedido = entrega.pedido
  const cliente = pedido?.cliente
  const productos = pedido?.detalle_pedido || []

  const [estadoPago, setEstadoPago] = useState<'pagado' | 'pendiente' | 'pagara_despues' | ''>(
    entrega.pago_registrado ? 'pagado' : ''
  )
  const [metodoPago, setMetodoPago] = useState(entrega.metodo_pago_registrado || 'efectivo')
  const [montoCobrado, setMontoCobrado] = useState(
    entrega.monto_cobrado_registrado || pedido?.total || 0
  )
  const [numeroTransaccion, setNumeroTransaccion] = useState(entrega.numero_transaccion_registrado || '')
  const [comprobanteUrl, setComprobanteUrl] = useState(entrega.comprobante_url_registrado || '')
  const [notasEntrega, setNotasEntrega] = useState(entrega.notas_pago || entrega.notas_entrega || '')
  const [metodoPagoFuturo, setMetodoPagoFuturo] = useState('efectivo')
  const [pagoLoading, setPagoLoading] = useState(false)

  const [productoId, setProductoId] = useState(productos[0]?.producto_id || '')
  const [cantidadDevolucion, setCantidadDevolucion] = useState('')
  const [motivoDevolucion, setMotivoDevolucion] = useState(motivosDevolucion[0].value)
  const [observacionesDevolucion, setObservacionesDevolucion] = useState('')
  const [devolucionLoading, setDevolucionLoading] = useState(false)

  const [estadoLoading, setEstadoLoading] = useState(false)

  const handleRegistrarPago = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!pedido?.id) return

    if (!estadoPago) {
      toast.error('Selecciona el estado del pago')
      return
    }

    setPagoLoading(true)
    
    // Preparar datos según el estado de pago
    const bodyData: any = {
      pedido_id: pedido.id,
      notas_entrega: notasEntrega || undefined,
    }

    if (estadoPago === 'pagado') {
      // Si ya pagó, incluir método y monto
      bodyData.metodo_pago = metodoPago
      bodyData.monto_cobrado = Number(montoCobrado) || 0
      bodyData.numero_transaccion = numeroTransaccion || undefined
      bodyData.comprobante_url = comprobanteUrl || undefined
    } else if (estadoPago === 'pendiente') {
      // Si está pendiente, solo registrar método futuro
      bodyData.metodo_pago = metodoPagoFuturo
      bodyData.monto_cobrado = 0
    } else if (estadoPago === 'pagara_despues') {
      // Si pagará después, no registrar monto
      bodyData.monto_cobrado = 0
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
    router.refresh()
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
    setEstadoLoading(false)

    if (result.success) {
      toast.success('Entrega marcada como completada')
      router.refresh()
    } else {
      toast.error(result.error || 'No se pudo actualizar el estado')
    }
  }

  const metodosPagoArray = Array.isArray(pedido?.metodos_pago) ? pedido?.metodos_pago : []

  return (
    <div className="space-y-6 p-4 pb-32">
      <Button asChild variant="ghost" className="mb-2 w-fit">
        <Link href={`/repartidor/ruta/${entrega.ruta_id}`}>
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

          <div>
            <p className="text-sm text-muted-foreground mb-1">Productos</p>
            <div className="space-y-1 text-sm">
              {productos.map((detalle: any) => (
                <div key={detalle.id} className="flex items-center justify-between">
                  <span>{detalle.producto?.nombre || detalle.producto?.codigo}</span>
                  <span className="text-muted-foreground">
                    {detalle.cantidad} {detalle.producto?.unidad_medida || 'un'}
                  </span>
                </div>
              ))}
            </div>
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
                  <option value="pagado">Ya pagó</option>
                  <option value="pendiente">Pendiente de pago</option>
                  <option value="pagara_despues">Pagará después</option>
                </select>
              </div>

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
                      <option value="cuenta_corriente">Cuenta corriente</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label>Monto cobrado *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={montoCobrado}
                      onChange={(e) => setMontoCobrado(parseFloat(e.target.value) || 0)}
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
                    <Label>Comprobante (URL)</Label>
                    <Input
                      value={comprobanteUrl}
                      onChange={(e) => setComprobanteUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </>
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
                    <option value="cuenta_corriente">Cuenta corriente</option>
                  </select>
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
                <Label>Motivo</Label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={motivoDevolucion}
                  onChange={(e) => setMotivoDevolucion(e.target.value)}
                >
                  {motivosDevolucion.map(motivo => (
                    <option key={motivo.value} value={motivo.value}>
                      {motivo.label}
                    </option>
                  ))}
                </select>
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
            <Button
              onClick={handleMarcarEntregado}
              disabled={estadoLoading}
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}
