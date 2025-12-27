'use client'

import { useState } from 'react'
import {
  MapPin,
  DollarSign,
  FileText,
  Phone,
  Navigation,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ArrowDown
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { moverClienteAlFinalAction } from '@/actions/reparto.actions'

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

  // Puede editar si la ruta está en curso y la entrega no está completada ni rechazada
  const puedeEditar = rutaEstado === 'en_curso' &&
    entrega.estado_entrega !== 'entregado' &&
    entrega.estado_entrega !== 'rechazado'

  // Calcular monto pendiente de cobro
  // Estados resueltos: pagado, cuenta_corriente, parcial
  const estadoPago = entrega.estado_pago || (entrega.pago_registrado ? 'pagado' : null)
  const estadosPagoResueltos = ['pagado', 'cuenta_corriente', 'parcial']
  const estaPagado = estadosPagoResueltos.includes(estadoPago) || pedido?.pago_estado === 'pagado'
  const montoPendiente = !estaPagado ? (pedido?.total || 0) : 0

  // Manejar mover cliente al final
  async function handleMoverAlFinal() {
    setMoviendoAlFinal(true)
    try {
      const result = await moverClienteAlFinalAction(rutaId, entrega.id)
      if (result.success) {
        toast.success('Cliente movido al final. ETAs recalculados.')
        // La página se recargará automáticamente por revalidatePath
      } else {
        toast.error(result.error || 'Error al mover cliente')
      }
    } catch (error) {
      toast.error('Error al mover cliente al final')
    } finally {
      setMoviendoAlFinal(false)
    }
  }

  return (
    <Card className={entrega.estado_entrega === 'entregado' ? 'opacity-75' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline">#{entrega.orden_entrega}</Badge>
            <span className="font-semibold">{pedido?.numero_pedido}</span>
            {entrega.estado_entrega === 'entregado' && (
              <Badge variant="default" className="bg-green-600">
                <CheckCircle className="mr-1 h-3 w-3" />
                Entregado
              </Badge>
            )}
            {/* Badge de estado de pago con método */}
            {estadoPago === 'pagado' && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                <DollarSign className="mr-1 h-3 w-3" />
                {entrega.metodo_pago_registrado === 'transferencia' ? 'Transferencia' :
                  entrega.metodo_pago_registrado === 'efectivo' ? 'Efectivo' :
                    entrega.metodo_pago_registrado === 'qr' ? 'QR' :
                      entrega.metodo_pago_registrado === 'tarjeta' ? 'Tarjeta' : 'Pagado'}
              </Badge>
            )}
            {estadoPago === 'cuenta_corriente' && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                📒 Cuenta corriente
              </Badge>
            )}
            {estadoPago === 'parcial' && (
              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                💰 Pago parcial
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Información del cliente */}
          <div>
            <h4 className="font-medium">{cliente?.nombre || 'Cliente'}</h4>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {cliente?.direccion || 'Dirección no disponible'}
            </p>
            {cliente?.telefono && (
              <a
                href={`tel:${cliente.telefono}`}
                className="text-sm text-primary flex items-center gap-1 hover:underline"
              >
                <Phone className="h-3 w-3" />
                {cliente.telefono}
                <span className="text-xs text-muted-foreground ml-1">(llamar)</span>
              </a>
            )}
            {cliente?.zona_entrega && (
              <Badge variant="outline" className="mt-1 text-xs">
                {cliente.zona_entrega}
              </Badge>
            )}
          </div>

          {/* Información de ETA y horario de apertura */}
          {(entrega.eta || entrega.tiempo_descarga_min || entrega.horario_cliente) && (
            <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-md space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-1">
                  ⏰ ETA
                </span>
                <div className="flex items-center gap-2">
                  {entrega.eta && (
                    <span className="font-bold text-lg">
                      {typeof entrega.eta === 'string'
                        ? new Date(entrega.eta).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                        : entrega.eta.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {entrega.en_horario === true && (
                    <Badge variant="default" className="bg-green-600">
                      🟢 En horario
                    </Badge>
                  )}
                  {entrega.en_horario === false && (
                    <Badge variant="destructive">
                      🔴 Fuera de horario
                    </Badge>
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

              {/* Botón para mover al final si está fuera de horario */}
              {entrega.en_horario === false && puedeEditar && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 text-amber-700 border-amber-400 hover:bg-amber-50"
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

          {/* Información del pedido */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-semibold">${pedido?.total?.toFixed(2) || '0.00'}</span>
            </div>
            {/* Monto pendiente de cobro */}
            {!estaPagado && montoPendiente > 0 && (
              <div className="flex items-center justify-between text-sm bg-amber-50 dark:bg-amber-950 p-2 rounded-md border border-amber-200 dark:border-amber-800">
                <span className="text-amber-700 dark:text-amber-300 flex items-center gap-1">
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
                <span className="text-muted-foreground">Métodos de pago:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {pedido.metodos_pago.map((metodo: any, index: number) => (
                    <Badge key={`${metodo.metodo || metodo.tipo}-${index}`} variant="outline" className="text-xs">
                      {(metodo.metodo || metodo.tipo || 'metodo').replace('_', ' ')}
                      {metodo.recargo ? ` • +$${metodo.recargo}` : ''}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {pedido?.instrucciones_repartidor && (
              <div className="bg-yellow-50 p-2 rounded-md">
                <p className="text-xs flex items-start gap-1">
                  <FileText className="h-3 w-3 mt-0.5" />
                  {pedido.instrucciones_repartidor}
                </p>
              </div>
            )}
          </div>

          {/* Productos del pedido - Expandible */}
          {pedido?.detalle_pedido && pedido.detalle_pedido.length > 0 && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setProductosExpandidos(!productosExpandidos)}
                className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
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
                  <div key={detalle.id} className="text-xs flex items-center justify-between">
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
                    +{pedido.detalle_pedido.length - 3} productos más
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Acciones */}
          {puedeEditar && (
            <>
              <Separator />
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1"
                  asChild
                >
                  <Link href={`/ruta/${rutaId}/entrega/${entrega.id}`}>
                    <FileText className="mr-2 h-4 w-4" />
                    Gestionar Entrega
                  </Link>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Debes registrar el pago antes de marcar como entregado
              </p>
            </>
          )}

          {entrega.estado_entrega === 'entregado' && (
            <>
              <Separator />
              <div className="flex items-center justify-center">
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Entregado {entrega.fecha_hora_entrega &&
                    new Date(entrega.fecha_hora_entrega).toLocaleTimeString('es-AR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  }
                </Badge>
              </div>
            </>
          )}

          {/* Botón para ver en mapa */}
          {cliente?.coordenadas && (
            <Button
              variant="ghost"
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
        </div>
      </CardContent>
    </Card>
  )
}

