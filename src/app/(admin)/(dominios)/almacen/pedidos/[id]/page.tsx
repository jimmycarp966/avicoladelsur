import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowLeft, Edit, Truck, FileText, Printer, User, MapPin, CheckCircle, Users, Clock, Scale, Navigation } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { obtenerPedidoPorIdAction } from '@/actions/ventas.actions'
import { EntregasPedido } from '@/components/pedidos/EntregasPedido'
import { AsignarVehiculoSelect } from '@/components/pedidos/AsignarVehiculoSelect'
import { obtenerRutaPorPedidoIdAction } from '@/actions/reparto.actions'

interface PedidoDetallePageProps {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Detalle Pedido - Avícola del Sur ERP',
  description: 'Información detallada del pedido',
}

const estadoConfig = (estado: string) => {
  const configs = {
    pendiente: { label: 'Pendiente', variant: 'secondary' as const, color: 'bg-yellow-100 text-yellow-800' },
    confirmado: { label: 'Confirmado', variant: 'default' as const, color: 'bg-blue-100 text-blue-800' },
    preparando: { label: 'Preparando', variant: 'outline' as const, color: 'bg-purple-100 text-purple-800' },
    enviado: { label: 'Enviado', variant: 'secondary' as const, color: 'bg-orange-100 text-orange-800' },
    entregado: { label: 'Entregado', variant: 'default' as const, color: 'bg-green-100 text-green-800' },
    cancelado: { label: 'Cancelado', variant: 'destructive' as const, color: 'bg-red-100 text-red-800' },
  }
  return configs[estado as keyof typeof configs] || { label: estado, variant: 'outline' as const, color: 'bg-gray-100 text-gray-800' }
}

const estadoCierreConfig = (estado: string) => {
  const configs = {
    abierto: { label: 'Abierto', color: 'bg-green-100 text-green-800 border-green-300' },
    cerrado: { label: 'Cerrado', color: 'bg-gray-100 text-gray-800 border-gray-300' },
  }
  return configs[estado as keyof typeof configs] || { label: estado, color: 'bg-gray-100 text-gray-800' }
}

export default async function PedidoDetallePage({ params }: PedidoDetallePageProps) {
  const { id } = await params
  const pedidoId = id

  // Obtener pedido y ruta en paralelo
  const [pedidoResult, rutaResult] = await Promise.all([
    obtenerPedidoPorIdAction(pedidoId),
    obtenerRutaPorPedidoIdAction(pedidoId)
  ])

  if (!pedidoResult.success || !pedidoResult.data?.pedido) {
    notFound()
  }

  const pedido = pedidoResult.data.pedido
  const estado = estadoConfig(pedido.estado)

  // Datos de ruta si existen
  const ruta = rutaResult.success ? rutaResult.data : null
  const repartidorNombre = ruta?.repartidor
    ? `${ruta.repartidor.nombre} ${ruta.repartidor.apellido || ''}`
    : pedido.repartidor || 'Sin asignar'

  const vehiculoInfo = ruta?.vehiculo
    ? `${ruta.vehiculo.marca || ''} ${ruta.vehiculo.modelo || ''} (${ruta.vehiculo.patente})`.trim()
    : pedido.vehiculo || 'Sin asignar'

  // Calcular peso total del pedido
  const pesoTotal = (pedido.detalles_pedido ?? []).reduce((sum: number, item: any) => {
    const peso = item.peso_final ?? item.cantidad ?? 0
    return sum + Number(peso)
  }, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/almacen/pedidos">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pedido {pedido.numero_pedido}</h1>
            <p className="text-muted-foreground">{formatDate(pedido.fecha_pedido)}</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/almacen/pedidos/${pedido.id}/editar`}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </Button>
          {pedido.estado === 'enviado' && (
            <Button variant="outline" asChild>
              <Link href="/reparto/monitor">
                <Navigation className="mr-2 h-4 w-4" />
                Ver en Monitor
              </Link>
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href="/reparto/rutas">
              <Truck className="mr-2 h-4 w-4" />
              Ver Rutas
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-y-4">
        <div className="flex items-center flex-wrap gap-3">
          <Badge variant={estado.variant} className={estado.color}>
            {estado.label}
          </Badge>
          {pedido.estado_cierre && (
            <Badge variant="outline" className={estadoCierreConfig(pedido.estado_cierre).color}>
              {estadoCierreConfig(pedido.estado_cierre).label}
            </Badge>
          )}
          {pedido.clientes && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              {pedido.clientes?.nombre || 'Cliente'}
            </div>
          )}
          {pedido.cantidad_entregas > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              {pedido.cantidad_entregas} entrega(s)
            </div>
          )}
          {pedido.turno && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Turno: {pedido.turno}
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            Zona: {pedido.zonas?.nombre || pedido.clientes?.zona_entrega || 'N/D'}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 border border-blue-200">
            <Scale className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-xs text-blue-600 font-medium">Peso Total</p>
              <p className="text-xl font-bold text-blue-700">{pesoTotal.toFixed(2)} kg</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{formatCurrency(pedido.total)}</p>
            <p className="text-sm text-muted-foreground">Pago: {pedido.pago_estado || 'pendiente'}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Información general
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Número de pedido</p>
              <p className="font-mono text-sm">{pedido.numero_pedido}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fecha estimada de entrega</p>
              <p className="text-sm">
                {pedido.fecha_entrega_estimada ? formatDate(pedido.fecha_entrega_estimada) : 'Sin fecha'}
              </p>
            </div>
            {pedido.fecha_entrega_real && (
              <div>
                <p className="text-xs text-muted-foreground">Entrega registrada</p>
                <p className="text-sm flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  {formatDate(pedido.fecha_entrega_real)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {pedido.cliente_id ? 'Cliente' : 'Pedido Agrupado'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pedido.cliente_id ? (
              // Pedido tradicional con un solo cliente
              <>
                <div>
                  <p className="text-xs text-muted-foreground">Nombre</p>
                  <p className="text-sm">{pedido.clientes?.nombre || 'Sin datos'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Teléfono</p>
                  <p className="text-sm">{pedido.clientes?.telefono || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Zona</p>
                  <p className="text-sm">{pedido.clientes?.zona_entrega || '-'}</p>
                </div>
              </>
            ) : (
              // Pedido agrupado con múltiples entregas
              <>
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                  <p className="text-sm text-blue-700">
                    Este pedido agrupa múltiples entregas de diferentes clientes.
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tipo</p>
                  <p className="text-sm font-medium">Pedido consolidado por zona</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Entregas</p>
                  <p className="text-sm">Ver sección "Entregas del Pedido" abajo</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Logística
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estado:</span>
                <Badge variant={estado.variant} className={estado.color}>
                  {estado.label}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Repartidor:</span>
                <span>{repartidorNombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vehículo:</span>
                <span>{vehiculoInfo}</span>
              </div>
            </div>

            {/* Selector de vehículo si está en preparando */}
            {pedido.estado === 'preparando' && (
              <AsignarVehiculoSelect
                pedidoId={pedido.id}
                numeroPedido={pedido.numero_pedido}
                estado={pedido.estado}
                pesoTotal={pesoTotal}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Entregas del pedido (nuevo modelo agrupado) */}
      <EntregasPedido pedidoId={pedido.id} />

      {/* Productos del pedido (vista tradicional) */}
      <Card>
        <CardHeader>
          <CardTitle>Productos del pedido</CardTitle>
          <CardDescription>Detalle completo de los ítems solicitados</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-center">Cantidad</TableHead>
                <TableHead className="text-center">Peso (kg)</TableHead>
                <TableHead className="text-right">Precio unitario</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.values(
                (pedido.detalles_pedido ?? []).reduce((acc: any, item: any) => {
                  const key = item.producto_id;
                  if (!acc[key]) {
                    acc[key] = {
                      ...item,
                      cantidad: 0,
                      peso_final: 0,
                      subtotal: 0
                    };
                  }
                  acc[key].cantidad += Number(item.cantidad || 0);
                  acc[key].peso_final += Number(item.peso_final || item.cantidad || 0);
                  acc[key].subtotal += Number(item.subtotal || 0);
                  return acc;
                }, {})
              ).map((item: any) => {
                const precioPromedio = item.peso_final > 0
                  ? item.subtotal / item.peso_final
                  : item.precio_unitario;

                return (
                  <TableRow key={item.id || item.producto_id}>
                    <TableCell>
                      <p className="font-medium">{item.productos?.nombre || 'Producto'}</p>
                      <p className="text-xs text-muted-foreground">Código: {item.productos?.codigo || '-'}</p>
                    </TableCell>
                    <TableCell className="text-center">{item.cantidad}</TableCell>
                    <TableCell className="text-center font-medium text-blue-600">
                      {item.peso_final.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(precioPromedio)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(item.subtotal)}</TableCell>
                  </TableRow>
                )
              })}
              {/* Fila de totales */}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell colSpan={2} className="text-right">Total:</TableCell>
                <TableCell className="text-center text-blue-700">{pesoTotal.toFixed(2)} kg</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right">{formatCurrency(pedido.total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Nota: La sección de Tesorería (pagos, saldos) se gestiona desde el módulo de Tesorería */}

      {pedido.observaciones && (
        <Card>
          <CardHeader>
            <CardTitle>Observaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{pedido.observaciones}</p>
          </CardContent>
        </Card>
      )}

      <div className="text-right text-xs text-muted-foreground">DaniR</div>
    </div>
  )
}

