import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowLeft, Edit, Truck, FileText, Printer, User, MapPin, CheckCircle, Wallet, Users, Clock } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import { obtenerPedidoPorId } from '@/actions/ventas.actions'
import { listarCajas } from '@/actions/tesoreria.actions'
import { RegistrarPagoPedidoForm } from '@/components/forms/RegistrarPagoPedidoForm'
import { EntregasPedido } from '@/components/pedidos/EntregasPedido'
import { PasarARutaButton } from '@/components/pedidos/PasarARutaButton'

interface PedidoDetallePageProps {
  params: { id: string }
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
  const [pedidoResult, cajas] = await Promise.all([obtenerPedidoPorId(pedidoId), listarCajas()])

  if (!pedidoResult.success || !pedidoResult.data?.pedido) {
    notFound()
  }

  const pedido = pedidoResult.data.pedido
  const pagos = pedidoResult.data.pagos ?? []
  const totalPagado = pagos.filter((p: any) => p.tipo === 'ingreso').reduce((sum: number, p: any) => sum + Number(p.monto), 0)
  const saldoPendiente = Math.max(Number(pedido.total) - totalPagado, 0)
  const cuenta = pedidoResult.data.cuenta
  const estado = estadoConfig(pedido.estado)

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
          <PasarARutaButton
            pedidoId={pedido.id}
            numeroPedido={pedido.numero_pedido}
            estado={pedido.estado}
          />
          <Button variant="outline" asChild>
            <Link href="/tesoreria/movimientos">
              <Truck className="mr-2 h-4 w-4" />
              Ver logística
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
        <div className="text-right">
          <p className="text-2xl font-bold">{formatCurrency(pedido.total)}</p>
          <p className="text-sm text-muted-foreground">Pago: {pedido.pago_estado || 'pendiente'}</p>
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
              <User className="h-5 w-5" />
              Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Logística
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Repartidor asignado: {pedido.repartidor || 'Sin asignar'}</p>
            <p>Vehículo: {pedido.vehiculo || 'Sin asignar'}</p>
            <Badge variant={estado.variant} className={estado.color}>
              {estado.label}
            </Badge>
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
                <TableHead className="text-right">Precio unitario</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(pedido.detalles_pedido ?? []).map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <p className="font-medium">{item.productos?.nombre || 'Producto'}</p>
                    <p className="text-xs text-muted-foreground">Código: {item.productos?.codigo || '-'}</p>
                  </TableCell>
                  <TableCell className="text-center">{item.cantidad}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.precio_unitario)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(item.subtotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Tesorería
          </CardTitle>
          <CardDescription>Pagos registrados y saldo pendiente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-primary/10 bg-primary/5 p-4">
              <p className="text-xs text-muted-foreground">Total pagado</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(totalPagado)}</p>
            </div>
            <div className="rounded-lg border border-warning/10 bg-warning/5 p-4">
              <p className="text-xs text-muted-foreground">Saldo pendiente</p>
              <p className="text-2xl font-bold text-warning">{formatCurrency(saldoPendiente)}</p>
            </div>
            <div className="rounded-lg border border-secondary/10 bg-secondary/5 p-4">
              <p className="text-xs text-muted-foreground">Crédito disponible</p>
              <p className="text-2xl font-bold">
                {formatCurrency(Math.max((cuenta?.limite_credito ?? 0) - (cuenta?.saldo ?? 0), 0))}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-semibold mb-2">Pagos registrados</p>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-2">
                {pagos.length === 0 && <p className="text-xs text-muted-foreground">Sin pagos registrados.</p>}
                {pagos.map((pago: any) => (
                  <div key={pago.id} className="rounded-lg border border-muted/50 p-3 flex justify-between text-sm">
                    <div>
                      <p className="font-medium">{pago.metodo_pago}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(pago.created_at).toLocaleString('es-AR')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(pago.monto)}</p>
                      <p className="text-xs text-muted-foreground">
                        {(pago.tesoreria_cajas as any)?.nombre || 'Caja'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold mb-2">Registrar pago manual</p>
              <RegistrarPagoPedidoForm
                pedidoId={pedido.id}
                cajas={cajas ?? []}
                saldoPendiente={saldoPendiente}
              />
            </div>
          </div>
        </CardContent>
      </Card>

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

