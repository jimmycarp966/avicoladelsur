import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit, Package, AlertTriangle, Calendar, Scale, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { obtenerLotePorIdAction } from '@/actions/almacen.actions'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'

interface LoteDetallePageProps {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Detalle Lote - Avícola del Sur ERP',
  description: 'Información detallada del lote',
}

const getEstadoConfig = (estado: string, vencimiento?: string) => {
  const hoy = new Date()
  const fechaVencimiento = vencimiento ? new Date(vencimiento) : null
  const diasParaVencer = fechaVencimiento ? Math.ceil((fechaVencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)) : null

  if (estado === 'vencido' || (fechaVencimiento && fechaVencimiento < hoy)) {
    return { label: 'Vencido', variant: 'destructive' as const, color: 'bg-red-100 text-red-800' }
  }

  if (diasParaVencer !== null && diasParaVencer <= 7 && diasParaVencer > 0) {
    return { label: 'Próximo a Vencer', variant: 'secondary' as const, color: 'bg-yellow-100 text-yellow-800' }
  }

  if (estado === 'disponible') {
    return { label: 'Disponible', variant: 'default' as const, color: 'bg-green-100 text-green-800' }
  }

  if (estado === 'agotado') {
    return { label: 'Agotado', variant: 'secondary' as const, color: 'bg-gray-100 text-gray-800' }
  }

  return { label: estado, variant: 'outline' as const, color: 'bg-gray-100 text-gray-800' }
}

export default async function LoteDetallePage({ params }: LoteDetallePageProps) {
  const { id } = await params
  const loteResult = await obtenerLotePorIdAction(id)

  if (!loteResult.success || !loteResult.data) {
    notFound()
  }

  const lote = loteResult.data

  const estadoConfig = getEstadoConfig(lote.estado, lote.fecha_vencimiento)

  // Obtener movimientos de stock y pedidos asociados
  const supabase = await createClient()
  const { data: movimientos } = await supabase
    .from('movimientos_stock')
    .select('*, usuario:usuarios(nombre, apellido)')
    .eq('lote_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  // Obtener pedidos asociados
  const { data: detallesPedido } = await supabase
    .from('detalles_pedido')
    .select(`
      id,
      cantidad,
      pedido:pedidos(id, numero_pedido, estado, fecha_pedido, cliente:clientes(nombre))
    `)
    .eq('lote_id', id)
    .order('created_at', { ascending: false })
    .limit(10)

  const producto = lote.producto as any

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/almacen/lotes">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{lote.numero_lote}</h1>
            <p className="text-muted-foreground">{producto?.nombre || 'Producto'}</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" asChild>
            <Link href={`/almacen/lotes/${id}/editar`}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </Button>
          {lote.estado === 'disponible' && (
            <Button variant="outline" asChild>
              <Link href={`/almacen/lotes/${id}/ajustar`}>
                <Scale className="mr-2 h-4 w-4" />
                Ajustar Stock
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Información General */}
        <Card>
          <CardHeader>
            <CardTitle>Información General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Número de Lote</p>
              <p className="font-medium">{lote.numero_lote}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Producto</p>
              <div>
                <p className="font-medium">{producto?.nombre || 'N/A'}</p>
                <p className="text-sm text-muted-foreground">Código: {producto?.codigo || 'N/A'}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Estado</p>
              <Badge variant={estadoConfig.variant} className={estadoConfig.color}>
                {estadoConfig.label}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cantidad Ingresada</p>
              <p className="font-medium">{lote.cantidad_ingresada} {producto?.unidad_medida || 'unidades'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cantidad Disponible</p>
              <p className="font-medium">{lote.cantidad_disponible} {producto?.unidad_medida || 'unidades'}</p>
            </div>
            {lote.cantidad_disponible < lote.cantidad_ingresada && (
              <div>
                <p className="text-sm text-muted-foreground">Cantidad Utilizada</p>
                <p className="font-medium text-orange-600">
                  {lote.cantidad_ingresada - lote.cantidad_disponible} {producto?.unidad_medida || 'unidades'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fechas y Ubicación */}
        <Card>
          <CardHeader>
            <CardTitle>Fechas y Ubicación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Fecha de Ingreso</p>
              <p className="font-medium">{formatDate(lote.fecha_ingreso)}</p>
            </div>
            {lote.fecha_vencimiento && (
              <div>
                <p className="text-sm text-muted-foreground">Fecha de Vencimiento</p>
                <p className="font-medium">{formatDate(lote.fecha_vencimiento)}</p>
                {new Date(lote.fecha_vencimiento) < new Date() && (
                  <Badge variant="destructive" className="mt-2">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    Vencido
                  </Badge>
                )}
              </div>
            )}
            {lote.ubicacion_almacen && (
              <div>
                <p className="text-sm text-muted-foreground">Ubicación en Almacén</p>
                <p className="font-medium">{lote.ubicacion_almacen}</p>
              </div>
            )}
            {lote.proveedor && (
              <div>
                <p className="text-sm text-muted-foreground">Proveedor</p>
                <p className="font-medium">{lote.proveedor}</p>
              </div>
            )}
            {lote.numero_factura && (
              <div>
                <p className="text-sm text-muted-foreground">Número de Factura</p>
                <p className="font-medium">{lote.numero_factura}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Movimientos de Stock */}
      {movimientos && movimientos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Movimientos de Stock</CardTitle>
            <CardDescription>Historial de movimientos de este lote</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimientos.map((mov: any) => (
                  <TableRow key={mov.id}>
                    <TableCell>{formatDate(mov.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant={mov.tipo_movimiento === 'ingreso' ? 'default' : 'secondary'}>
                        {mov.tipo_movimiento}
                      </Badge>
                    </TableCell>
                    <TableCell>{mov.cantidad} {producto?.unidad_medida || 'unidades'}</TableCell>
                    <TableCell>
                      {mov.usuario?.nombre} {mov.usuario?.apellido}
                    </TableCell>
                    <TableCell>{mov.motivo || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Pedidos Asociados */}
      {detallesPedido && detallesPedido.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pedidos Asociados</CardTitle>
            <CardDescription>Pedidos que utilizan este lote</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detallesPedido.map((detalle: any) => {
                  const pedido = detalle.pedido as any
                  const cliente = pedido?.cliente as any
                  return (
                    <TableRow key={detalle.id}>
                      <TableCell>
                        <Link href={`/almacen/pedidos/${pedido?.id}`} className="text-primary hover:underline">
                          {pedido?.numero_pedido || 'N/A'}
                        </Link>
                      </TableCell>
                      <TableCell>{cliente?.nombre || 'N/A'}</TableCell>
                      <TableCell>{detalle.cantidad} {producto?.unidad_medida || 'unidades'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{pedido?.estado || 'N/A'}</Badge>
                      </TableCell>
                      <TableCell>{pedido?.fecha_pedido ? formatDate(pedido.fecha_pedido) : '-'}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

