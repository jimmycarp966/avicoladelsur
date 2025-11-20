import { Suspense } from 'react'
import { Truck, MapPin, Clock, CheckCircle, DollarSign, Camera, FileText } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'
import { RepartoSkeleton } from './reparto-skeleton'

export const dynamic = 'force-dynamic'

async function RepartoContent() {
  const supabase = await createClient()

  // Obtener usuario actual (repartidor)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div>No autorizado</div>

  // Obtener pedidos asignados al repartidor (aquellos en rutas activas)
  const { data: pedidosRuta } = await supabase
    .from('detalles_ruta')
    .select(`
      id,
      orden_entrega,
      estado_entrega,
      pedido:pedidos(
        id,
        numero_pedido,
        total,
        cliente:clientes(
          nombre,
          telefono,
          direccion
        ),
        pago_estado,
        instrucciones_repartidor
      ),
      ruta: rutas_reparto(
        numero_ruta,
        fecha_ruta,
        vehiculo:vehiculos(patente)
      )
    `)
    .eq('estado_entrega', 'pendiente')
    .order('orden_entrega')

  // Para demo, si no hay rutas reales, mostrar datos de ejemplo
  const entregas = pedidosRuta?.map((detalle: any) => ({
    id: detalle.id,
    pedido_id: detalle.pedido?.id,
    numero_pedido: detalle.pedido?.numero_pedido,
    cliente: detalle.pedido?.cliente,
    total: detalle.pedido?.total,
    pago_estado: detalle.pedido?.pago_estado,
    instrucciones: detalle.pedido?.instrucciones_repartidor,
    orden_entrega: detalle.orden_entrega,
    ruta: detalle.ruta?.numero_ruta,
    vehiculo: detalle.ruta?.vehiculo?.patente,
    estado: detalle.estado_entrega
  })) || []

  // Estadísticas
  const totalEntregas = entregas.length
  const entregasCompletadas = entregas.filter(e => e.estado === 'entregado').length
  const totalCobrar = entregas
    .filter(e => e.pago_estado !== 'pagado')
    .reduce((sum, e) => sum + (e.total || 0), 0)

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-white border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Reparto del Día</h1>
            <p className="text-muted-foreground">
              {new Date().toLocaleDateString('es-AR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
          <Badge variant="outline" className="bg-blue-50">
            <Truck className="mr-1 h-3 w-3" />
            Ruta Activa
          </Badge>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-3 gap-4 px-4">
        <Card className="text-center">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{totalEntregas}</div>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{entregasCompletadas}</div>
            <p className="text-xs text-muted-foreground">Completadas</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">${totalCobrar.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Por Cobrar</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de entregas */}
      <div className="px-4 space-y-4">
        {entregas.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Truck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No hay entregas asignadas</h3>
              <p className="text-muted-foreground">
                Esperando asignación de ruta por el administrador
              </p>
            </CardContent>
          </Card>
        ) : (
          entregas.map((entrega: any) => (
            <Card key={entrega.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">#{entrega.orden_entrega}</Badge>
                    <span className="font-semibold">{entrega.numero_pedido}</span>
                    <Badge
                      variant={entrega.pago_estado === 'pagado' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {entrega.pago_estado === 'pagado' ? 'Pagado' : 'Pendiente'}
                    </Badge>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    <MapPin className="mr-1 h-3 w-3" />
                    {entrega.ruta || 'Ruta 1'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Información del cliente */}
                  <div>
                    <h4 className="font-medium">{entrega.cliente?.nombre || 'Cliente'}</h4>
                    <p className="text-sm text-muted-foreground">
                      📍 {entrega.cliente?.direccion || 'Dirección no disponible'}
                    </p>
                    {entrega.cliente?.telefono && (
                      <p className="text-sm text-muted-foreground">
                        📞 {entrega.cliente.telefono}
                      </p>
                    )}
                  </div>

                  {/* Información del pedido */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        ${entrega.total?.toFixed(2) || '0.00'}
                      </span>
                      {entrega.vehiculo && (
                        <span className="flex items-center gap-1">
                          <Truck className="h-4 w-4" />
                          {entrega.vehiculo}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Instrucciones del repartidor */}
                  {entrega.instrucciones && (
                    <div className="bg-yellow-50 p-3 rounded-md">
                      <p className="text-sm">
                        <FileText className="inline h-4 w-4 mr-1" />
                        {entrega.instrucciones}
                      </p>
                    </div>
                  )}

                  {/* Acciones */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      asChild
                    >
                      <Link href={`/repartidor/entrega/${entrega.pedido_id}`}>
                        <MapPin className="mr-2 h-4 w-4" />
                        Ver Detalles
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      asChild
                    >
                      <Link href={`/repartidor/entrega/${entrega.pedido_id}/completar`}>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Marcar Entrega
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Información adicional */}
      {entregas.length > 0 && (
        <div className="px-4">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-800">Información Importante</span>
              </div>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Registra cada entrega con comprobante de pago</li>
                <li>• Toma foto del recibo o comprobante de transferencia</li>
                <li>• Marca como entregado solo cuando el cliente confirme recepción</li>
                <li>• Los cobros se registran automáticamente en la caja central</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default function RepartoPage() {
  return (
    <Suspense fallback={<RepartoSkeleton />}>
      <RepartoContent />
    </Suspense>
  )
}
