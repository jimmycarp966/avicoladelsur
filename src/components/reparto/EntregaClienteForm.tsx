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
  XCircle,
  User,
} from 'lucide-react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import {
  registrarCobroEntregaAction,
  marcarEntregaCompletadaAction,
  marcarEntregaFallidaAction
} from '@/actions/entregas.actions'

interface Entrega {
  id: string
  pedido_id: string
  cliente_id: string
  presupuesto_id: string | null
  subtotal: number
  recargo: number
  total: number
  direccion: string | null
  orden_entrega: number
  estado_entrega: string
  estado_pago: string
  metodo_pago: string | null
  monto_cobrado: number
  referencia_pago: string | null
  instruccion_repartidor: string | null
  observaciones: string | null
  cliente?: {
    id: string
    nombre: string
    telefono: string | null
    coordenadas?: { lat: number; lng: number } | null
  }
  items?: Array<{
    id: string
    cantidad: number
    producto?: {
      nombre: string
      codigo: string
      unidad_medida: string
    }
  }>
}

interface EntregaClienteFormProps {
  entrega: Entrega
}

export function EntregaClienteForm({ entrega }: EntregaClienteFormProps) {
  const router = useRouter()
  const cliente = entrega.cliente

  const [estadoPago, setEstadoPago] = useState<'pagado' | 'parcial' | 'fiado' | ''>(
    entrega.estado_pago === 'pagado' ? 'pagado' :
      entrega.estado_pago === 'fiado' || entrega.estado_pago === 'cuenta_corriente' ? 'fiado' : ''
  )
  const [metodoPago, setMetodoPago] = useState(entrega.metodo_pago || 'efectivo')
  const [montoCobrado, setMontoCobrado] = useState(entrega.monto_cobrado || entrega.total || 0)
  const [numeroTransaccion, setNumeroTransaccion] = useState('')
  const [notasEntrega, setNotasEntrega] = useState(entrega.observaciones || '')
  const [pagoLoading, setPagoLoading] = useState(false)
  const [estadoLoading, setEstadoLoading] = useState(false)

  const handleRegistrarCobro = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!estadoPago) {
      toast.error('Selecciona el estado del pago')
      return
    }

    setPagoLoading(true)

    const formData = new FormData()
    formData.append('entrega_id', entrega.id)
    formData.append('estado_pago', estadoPago)
    formData.append('metodo_pago', metodoPago)
    formData.append('monto_cobrado', estadoPago === 'fiado' ? '0' : String(montoCobrado))
    if (numeroTransaccion) {
      formData.append('numero_transaccion', numeroTransaccion)
    }
    if (notasEntrega) {
      formData.append('notas', notasEntrega)
    }

    const result = await registrarCobroEntregaAction(formData)
    setPagoLoading(false)

    if (result.success) {
      toast.success(result.message || 'Cobro registrado correctamente')
      router.refresh()
    } else {
      toast.error(result.error || result.message || 'Error al registrar el cobro')
    }
  }

  const handleMarcarEntregado = async () => {
    setEstadoLoading(true)

    const formData = new FormData()
    formData.append('entrega_id', entrega.id)
    if (notasEntrega) {
      formData.append('notas', notasEntrega)
    }

    const result = await marcarEntregaCompletadaAction(formData)
    setEstadoLoading(false)

    if (result.success) {
      toast.success(result.message || 'Entrega completada')
      router.refresh()
    } else {
      toast.error(result.error || result.message || 'Error al completar entrega')
    }
  }

  const handleMarcarFallido = async () => {
    setEstadoLoading(true)

    const formData = new FormData()
    formData.append('entrega_id', entrega.id)
    formData.append('notas', notasEntrega || 'Entrega fallida')

    const result = await marcarEntregaFallidaAction(formData)
    setEstadoLoading(false)

    if (result.success) {
      toast.success(result.message || 'Entrega marcada como fallida')
      router.refresh()
    } else {
      toast.error(result.error || result.message || 'Error al marcar entrega')
    }
  }

  const estadoEntregaConfig = {
    pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
    en_camino: { label: 'En camino', color: 'bg-blue-100 text-blue-800' },
    entregado: { label: 'Entregado', color: 'bg-green-100 text-green-800' },
    fallido: { label: 'Fallido', color: 'bg-red-100 text-red-800' },
    rechazado: { label: 'Rechazado', color: 'bg-red-100 text-red-800' },
  }

  const estadoPagoConfig = {
    pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
    parcial: { label: 'Parcial', color: 'bg-orange-100 text-orange-800' },
    pagado: { label: 'Pagado', color: 'bg-green-100 text-green-800' },
    fiado: { label: 'Fiado', color: 'bg-purple-100 text-purple-800' },
    cuenta_corriente: { label: 'Fiado', color: 'bg-purple-100 text-purple-800' },
  }

  const estadoEntrega = estadoEntregaConfig[entrega.estado_entrega as keyof typeof estadoEntregaConfig] ||
    { label: entrega.estado_entrega, color: 'bg-gray-100' }
  const estadoPagoActual = estadoPagoConfig[entrega.estado_pago as keyof typeof estadoPagoConfig] ||
    { label: entrega.estado_pago, color: 'bg-gray-100' }

  const yaEntregado = entrega.estado_entrega === 'entregado'
  const yaFallido = entrega.estado_entrega === 'fallido' || entrega.estado_entrega === 'rechazado'
  const puedeEditar = !yaEntregado && !yaFallido

  return (
    <div className="space-y-6">
      {/* Información del cliente */}
      <Card className="shadow-md border-primary/10 bg-white/95 dark:bg-background/95 backdrop-blur-sm">
        <CardHeader className="bg-primary/5 pb-4 border-b">
          <CardTitle className="flex items-center gap-2 text-primary">
            <User className="h-5 w-5" />
            Entrega #{entrega.orden_entrega}
          </CardTitle>
          <CardDescription>
            {entrega.referencia_pago && `Ref: ${entrega.referencia_pago}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold">{cliente?.nombre || 'Cliente'}</p>
              {entrega.direccion && (
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {entrega.direccion}
                </p>
              )}
              {cliente?.telefono && (
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <a href={`tel:${cliente.telefono}`} className="text-primary hover:underline">
                    {cliente.telefono}
                  </a>
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{formatCurrency(entrega.total)}</p>
              {entrega.monto_cobrado > 0 && entrega.monto_cobrado < entrega.total && (
                <p className="text-sm text-green-600">
                  Cobrado: {formatCurrency(entrega.monto_cobrado)}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Badge className={estadoEntrega.color}>{estadoEntrega.label}</Badge>
            <Badge className={estadoPagoActual.color}>{estadoPagoActual.label}</Badge>
          </div>

          {entrega.instruccion_repartidor && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm flex gap-2">
              <FileText className="h-4 w-4 text-yellow-700 flex-shrink-0" />
              <span>{entrega.instruccion_repartidor}</span>
            </div>
          )}

          {/* Productos de la entrega */}
          {entrega.items && entrega.items.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Productos:</p>
                <div className="space-y-1">
                  {entrega.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span>{item.producto?.nombre || item.producto?.codigo}</span>
                      <span className="text-muted-foreground">
                        {item.cantidad} {item.producto?.unidad_medida || 'un'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Navegación */}
          {cliente?.coordenadas && (
            <div className="pt-2">
              <Button variant="default" size="lg" className="w-full h-12 text-base font-semibold shadow-md active:scale-[0.98] transition-all bg-blue-600 hover:bg-blue-700 text-white" asChild>
                <Link
                  href={`https://www.google.com/maps/dir/?api=1&destination=${cliente.coordenadas.lat},${cliente.coordenadas.lng}`}
                  target="_blank"
                >
                  <Navigation className="mr-2 h-5 w-5" />
                  Navegar en Google Maps
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Registro de cobro */}
      {puedeEditar && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4" />
              Registrar cobro
            </CardTitle>
            <CardDescription>
              Registra el pago del cliente para esta entrega
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleRegistrarCobro}>
              <div className="space-y-2">
                <Label>Estado del pago *</Label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={estadoPago}
                  onChange={(e) => setEstadoPago(e.target.value as 'pagado' | 'parcial' | 'fiado' | '')}
                  required
                >
                  <option value="">Selecciona un estado</option>
                  <option value="pagado">Pagó completo</option>
                  <option value="parcial">Pago parcial</option>
                  <option value="fiado">Quedó fiado</option>
                </select>
              </div>

              {(estadoPago === 'pagado' || estadoPago === 'parcial') && (
                <>
                  <div className="space-y-2">
                    <Label>Método de pago *</Label>
                    <select
                      className="w-full rounded-md border px-3 py-2 text-sm"
                      value={metodoPago}
                      onChange={(e) => setMetodoPago(e.target.value)}
                      required
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="transferencia">Transferencia</option>
                      <option value="qr">QR / Mercado Pago</option>
                      <option value="tarjeta_debito">Tarjeta Débito</option>
                      <option value="tarjeta_credito">Tarjeta Crédito</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Monto cobrado *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={montoCobrado}
                      onChange={(e) => setMontoCobrado(parseFloat(e.target.value) || 0)}
                      required
                    />
                    {estadoPago === 'parcial' && montoCobrado < entrega.total && (
                      <p className="text-xs text-orange-600">
                        Restante: {formatCurrency(entrega.total - montoCobrado)}
                      </p>
                    )}
                  </div>

                  {metodoPago === 'transferencia' && (
                    <div className="space-y-2">
                      <Label>N.º de transacción</Label>
                      <Input
                        value={numeroTransaccion}
                        onChange={(e) => setNumeroTransaccion(e.target.value)}
                        placeholder="Últimos 4 dígitos o referencia"
                      />
                    </div>
                  )}
                </>
              )}

              <div className="space-y-2">
                <Label>Notas (opcional)</Label>
                <Textarea
                  value={notasEntrega}
                  onChange={(e) => setNotasEntrega(e.target.value)}
                  placeholder="Observaciones sobre el cobro"
                  rows={2}
                />
              </div>

              <Button type="submit" disabled={pagoLoading} className="w-full h-12 text-base font-medium shadow-md active:scale-[0.98] transition-all">
                {pagoLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <DollarSign className="mr-2 h-5 w-5" />
                    Confirmar Cobro
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Estado de entrega */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4" />
            Finalizar entrega
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {yaEntregado && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Entrega completada</span>
            </div>
          )}

          {yaFallido && (
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              <span className="font-medium">Entrega fallida</span>
            </div>
          )}

          {puedeEditar && (
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleMarcarEntregado}
                disabled={estadoLoading}
                className="flex-1 h-14 bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20 active:scale-95 transition-all text-base font-bold"
              >
                {estadoLoading ? (
                  <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-5 w-5" />
                )}
                Entregado
              </Button>
              <Button
                onClick={handleMarcarFallido}
                disabled={estadoLoading}
                variant="destructive"
                className="flex-1 h-14 shadow-lg shadow-red-600/20 active:scale-95 transition-all text-base font-bold"
              >
                {estadoLoading ? (
                  <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-5 w-5" />
                )}
                Fallido
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

