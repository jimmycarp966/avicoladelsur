'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowDown,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  DollarSign,
  FileText,
  MapPin,
  Navigation,
  Phone,
} from 'lucide-react'
import { toast } from 'sonner'

import { moverClienteAlFinalAction } from '@/actions/reparto.actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  calcularMontoPorCobrar,
  getEstadoPagoBadgeVariant,
  getEstadoPagoLabel,
  normalizarEstadoEntrega,
  normalizarEstadoPago,
} from '@/lib/utils/estado-pago'

interface EntregaCardProps {
  entrega: any
  rutaId: string
  rutaEstado: string
}

export function EntregaCard({ entrega, rutaId, rutaEstado }: EntregaCardProps) {
  const [productosExpandidos, setProductosExpandidos] = useState(false)
  const [moviendoAlFinal, setMoviendoAlFinal] = useState(false)

  const pedido = entrega.pedido
  const cliente = pedido?.cliente
  const estadoEntrega = normalizarEstadoEntrega(entrega.estado_entrega)
  const estadoPago = normalizarEstadoPago(entrega)
  const montoPendiente = calcularMontoPorCobrar(entrega)
  const puedeEditar =
    rutaEstado === 'en_curso' &&
    estadoEntrega !== 'entregado' &&
    estadoEntrega !== 'rechazado'
  const puedeMoverAlFinal =
    puedeEditar &&
    entrega.en_horario === false &&
    Boolean(entrega.es_pedido_agrupado || entrega.detalle_ruta_id_padre)

  async function handleMoverAlFinal() {
    setMoviendoAlFinal(true)

    try {
      const result = await moverClienteAlFinalAction(rutaId, entrega.id)
      if (result.success) {
        toast.success('Cliente movido al final. ETAs recalculados.')
      } else {
        toast.error(result.error || 'Error al mover cliente')
      }
    } catch {
      toast.error('Error al mover cliente al final')
    } finally {
      setMoviendoAlFinal(false)
    }
  }

  return (
    <Card className={estadoEntrega === 'entregado' ? 'opacity-75' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">#{entrega.orden_entrega}</Badge>
            <span className="font-semibold">{pedido?.numero_pedido}</span>

            {estadoEntrega === 'entregado' && (
              <Badge variant="default" className="bg-green-600">
                <CheckCircle className="mr-1 h-3 w-3" />
                Entregado
              </Badge>
            )}

            {estadoEntrega === 'rechazado' && (
              <Badge variant="destructive">Rechazado</Badge>
            )}

            {estadoPago && (
              <Badge
                variant={getEstadoPagoBadgeVariant(entrega)}
                className={
                  estadoPago === 'pagado'
                    ? 'bg-blue-100 text-blue-800'
                    : estadoPago === 'cuenta_corriente'
                      ? 'bg-amber-100 text-amber-800'
                      : estadoPago === 'parcial'
                        ? 'bg-orange-100 text-orange-800'
                        : ''
                }
              >
                <DollarSign className="mr-1 h-3 w-3" />
                {getEstadoPagoLabel(entrega)}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          <div>
            <h4 className="font-medium">{cliente?.nombre || 'Cliente'}</h4>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {cliente?.direccion || 'Direccion no disponible'}
            </p>

            {cliente?.telefono && (
              <a
                href={`tel:${cliente.telefono}`}
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Phone className="h-3 w-3" />
                {cliente.telefono}
                <span className="ml-1 text-xs text-muted-foreground">(llamar)</span>
              </a>
            )}

            {cliente?.zona_entrega && (
              <Badge variant="outline" className="mt-1 text-xs">
                {cliente.zona_entrega}
              </Badge>
            )}
          </div>

          {(entrega.eta || entrega.tiempo_descarga_min || entrega.horario_cliente) && (
            <div className="space-y-2 rounded-md bg-slate-50 p-3 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">ETA</span>
                <div className="flex items-center gap-2">
                  {entrega.eta && (
                    <span className="text-lg font-bold">
                      {new Date(entrega.eta).toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                  {entrega.en_horario === true && (
                    <Badge variant="default" className="bg-green-600">
                      En horario
                    </Badge>
                  )}
                  {entrega.en_horario === false && (
                    <Badge variant="destructive">Fuera de horario</Badge>
                  )}
                </div>
              </div>

              {entrega.horario_cliente && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Horario del cliente:</span>
                  <span className="font-medium">{entrega.horario_cliente}</span>
                </div>
              )}

              {entrega.tiempo_descarga_min && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tiempo de descarga:</span>
                  <span className="font-medium">~{entrega.tiempo_descarga_min} min</span>
                </div>
              )}

              {entrega.peso_entrega_kg && entrega.peso_entrega_kg > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Peso a entregar:</span>
                  <span className="font-medium">{entrega.peso_entrega_kg} kg</span>
                </div>
              )}

              {puedeMoverAlFinal && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full border-amber-400 text-amber-700 hover:bg-amber-50"
                  onClick={handleMoverAlFinal}
                  disabled={moviendoAlFinal}
                >
                  <ArrowDown className="mr-2 h-4 w-4" />
                  {moviendoAlFinal ? 'Moviendo...' : 'Mover al final de la ruta'}
                </Button>
              )}
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-semibold">${Number(pedido?.total || 0).toFixed(2)}</span>
            </div>

            {montoPendiente > 0 && (
              <div className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 p-2 text-sm dark:border-amber-800 dark:bg-amber-950">
                <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
                  <AlertCircle className="h-3 w-3" />
                  Pendiente de cobro:
                </span>
                <span className="font-bold text-amber-700 dark:text-amber-300">
                  ${montoPendiente.toFixed(2)}
                </span>
              </div>
            )}

            {Array.isArray(pedido?.metodos_pago) && pedido.metodos_pago.length > 0 && (
              <div className="text-sm">
                <span className="text-muted-foreground">Metodos de pago:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {pedido.metodos_pago.map((metodo: any, index: number) => (
                    <Badge
                      key={`${metodo.metodo || metodo.tipo}-${index}`}
                      variant="outline"
                      className="text-xs"
                    >
                      {(metodo.metodo || metodo.tipo || 'metodo').replace('_', ' ')}
                      {metodo.recargo ? ` +$${metodo.recargo}` : ''}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {(pedido?.instruccion_repartidor || pedido?.instrucciones_repartidor) && (
              <div className="rounded-md bg-yellow-50 p-2">
                <p className="flex items-start gap-1 text-xs">
                  <FileText className="mt-0.5 h-3 w-3" />
                  {pedido?.instruccion_repartidor || pedido?.instrucciones_repartidor}
                </p>
              </div>
            )}
          </div>

          {Array.isArray(pedido?.detalle_pedido) && pedido.detalle_pedido.length > 0 && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setProductosExpandidos(!productosExpandidos)}
                className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <span>Productos ({pedido.detalle_pedido.length})</span>
                {productosExpandidos ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              <div className="space-y-1">
                {(productosExpandidos
                  ? pedido.detalle_pedido
                  : pedido.detalle_pedido.slice(0, 3)
                ).map((detalle: any) => (
                  <div key={detalle.id} className="flex items-center justify-between text-xs">
                    <span>{detalle.producto?.nombre || detalle.producto?.codigo}</span>
                    <span className="text-muted-foreground">
                      {detalle.cantidad} {detalle.producto?.unidad_medida || 'un'}
                    </span>
                  </div>
                ))}

                {!productosExpandidos && pedido.detalle_pedido.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setProductosExpandidos(true)}
                    className="text-xs text-primary hover:underline"
                  >
                    +{pedido.detalle_pedido.length - 3} productos mas
                  </button>
                )}
              </div>
            </div>
          )}

          {puedeEditar && (
            <>
              <Separator />
              <div className="flex gap-2">
                <Button variant="default" size="sm" className="flex-1" asChild>
                  <Link href={`/ruta/${rutaId}/entrega/${entrega.id}`}>
                    <FileText className="mr-2 h-4 w-4" />
                    Gestionar entrega
                  </Link>
                </Button>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Debes registrar el estado de pago antes de marcar como entregado
              </p>
            </>
          )}

          {estadoEntrega === 'entregado' && (
            <>
              <Separator />
              <div className="flex flex-col items-center justify-center gap-3">
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Entregado{' '}
                  {entrega.fecha_hora_entrega &&
                    new Date(entrega.fecha_hora_entrega).toLocaleTimeString('es-AR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                </Badge>

                <Button
                  variant="outline"
                  size="sm"
                  className="flex h-9 w-full items-center justify-center gap-2 border-primary/20 font-medium hover:border-primary/40 hover:bg-primary/5"
                  onClick={async () => {
                    const { generarRemitoEntregaAction } = await import('@/actions/remitos.actions')
                    const toastId = toast.loading('Generando remito PDF...')

                    try {
                      const res = await generarRemitoEntregaAction(
                        entrega.detalle_ruta_id_padre || entrega.id,
                      )

                      if (res.success && res.data?.archivo_url) {
                        toast.success('Remito generado correctamente', { id: toastId })
                        window.open(res.data.archivo_url, '_blank')
                      } else {
                        toast.error(res.error || 'Error al generar remito', { id: toastId })
                      }
                    } catch {
                      toast.error('Error al procesar el remito', { id: toastId })
                    }
                  }}
                >
                  <FileText className="h-4 w-4 text-primary" />
                  Ver remito de entrega
                </Button>
              </div>
            </>
          )}

          {cliente?.coordenadas && (
            <Button variant="ghost" size="sm" className="w-full" asChild>
              <Link
                href={`https://www.google.com/maps/dir/?api=1&destination=${cliente.coordenadas.lat},${cliente.coordenadas.lng}`}
                target="_blank"
              >
                <Navigation className="mr-2 h-4 w-4" />
                Abrir en Google Maps
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
