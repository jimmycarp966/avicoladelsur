'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  MapPin,
  CheckCircle,
  DollarSign,
  Camera,
  FileText,
  Package,
  X,
  Phone,
  Navigation
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { actualizarEstadoEntrega } from '@/actions/reparto.actions'

interface EntregaCardProps {
  entrega: any
  rutaId: string
  rutaEstado: string
}

export function EntregaCard({ entrega, rutaId, rutaEstado }: EntregaCardProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const pedido = entrega.pedido
  const cliente = pedido?.cliente

  const handleMarcarEntregado = async () => {
    setLoading(true)
    const result = await actualizarEstadoEntrega(entrega.id, 'entregado')
    setLoading(false)

    if (result.success) {
      toast.success('Entrega marcada como completada')
      router.refresh()
    } else {
      toast.error(result.error || 'Error al marcar entrega')
    }
  }

  const puedeEditar = rutaEstado === 'en_curso' && entrega.estado_entrega !== 'entregado'

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
            {pedido?.pago_estado === 'pagado' && (
              <Badge variant="secondary" className="bg-blue-100">
                <DollarSign className="mr-1 h-3 w-3" />
                Pagado
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
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {cliente.telefono}
              </p>
            )}
            {cliente?.zona_entrega && (
              <Badge variant="outline" className="mt-1 text-xs">
                {cliente.zona_entrega}
              </Badge>
            )}
          </div>

          <Separator />

          {/* Información del pedido */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-semibold">${pedido?.total?.toFixed(2) || '0.00'}</span>
            </div>
            {pedido?.metodos_pago && (
              <div className="text-sm">
                <span className="text-muted-foreground">Métodos de pago:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(pedido.metodos_pago).map(([metodo, recargo]: [string, any]) => (
                    <Badge key={metodo} variant="outline" className="text-xs">
                      {metodo}: {recargo ? `+${recargo}%` : 'Sin recargo'}
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

          {/* Productos del pedido */}
          {pedido?.detalle_pedido && pedido.detalle_pedido.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Productos:</p>
              <div className="space-y-1">
                {pedido.detalle_pedido.slice(0, 3).map((detalle: any) => (
                  <div key={detalle.id} className="text-xs flex items-center justify-between">
                    <span>{detalle.producto?.nombre || detalle.producto?.codigo}</span>
                    <span className="text-muted-foreground">
                      {detalle.cantidad} {detalle.producto?.unidad_medida || 'un'}
                    </span>
                  </div>
                ))}
                {pedido.detalle_pedido.length > 3 && (
                  <p className="text-xs text-muted-foreground">
                    +{pedido.detalle_pedido.length - 3} productos más
                  </p>
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
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  asChild
                >
                  <Link href={`/repartidor/ruta/${rutaId}/entrega/${entrega.id}`}>
                    <FileText className="mr-2 h-4 w-4" />
                    Detalles
                  </Link>
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={handleMarcarEntregado}
                  disabled={loading}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {loading ? 'Marcando...' : 'Entregar'}
                </Button>
              </div>
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

