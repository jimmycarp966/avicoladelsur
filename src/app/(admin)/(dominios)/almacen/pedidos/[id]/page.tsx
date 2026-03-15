import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Calendar,
  Clock,
  Edit,
  Navigation,
  Package,
  Printer,
  Route,
  Scale,
  Truck,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { obtenerPedidoPorIdAction } from '@/actions/ventas.actions'
import { obtenerRutaPorPedidoIdAction } from '@/actions/reparto.actions'
import {
  obtenerEntregasPedidoAction,
  obtenerResumenEntregasAction,
} from '@/actions/entregas.actions'
import { EntregasPedido } from '@/components/pedidos/EntregasPedido'
import { AsignarVehiculoSelect } from '@/components/pedidos/AsignarVehiculoSelect'
import { PedidoConsolidadoFinal } from '@/components/pedidos/PedidoConsolidadoFinal'
import { buildPedidoFinalViewModel } from '@/lib/pedidos/pedido-final-view'

interface PedidoDetallePageProps {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Detalle Pedido - Avicola del Sur ERP',
  description: 'Informacion detallada del pedido',
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

  return configs[estado as keyof typeof configs] || {
    label: estado,
    variant: 'outline' as const,
    color: 'bg-gray-100 text-gray-800',
  }
}

const estadoCierreConfig = (estado: string) => {
  const configs = {
    abierto: { label: 'Abierto', color: 'bg-green-100 text-green-800 border-green-300' },
    cerrado: { label: 'Cerrado', color: 'bg-gray-100 text-gray-800 border-gray-300' },
  }

  return configs[estado as keyof typeof configs] || {
    label: estado,
    color: 'bg-gray-100 text-gray-800',
  }
}

export default async function PedidoDetallePage({ params }: PedidoDetallePageProps) {
  const { id } = await params

  const [pedidoResult, rutaResult, entregasResult, resumenEntregasResult] = await Promise.all([
    obtenerPedidoPorIdAction(id),
    obtenerRutaPorPedidoIdAction(id),
    obtenerEntregasPedidoAction(id),
    obtenerResumenEntregasAction(id),
  ])

  if (!pedidoResult.success || !pedidoResult.data?.pedido) {
    notFound()
  }

  const pedido = pedidoResult.data.pedido
  const ruta = rutaResult.success ? rutaResult.data : null
  const entregas = entregasResult.success ? entregasResult.data || [] : []
  const resumenEntregas = resumenEntregasResult.success ? resumenEntregasResult.data || null : null
  const pedidoFinal = buildPedidoFinalViewModel({
    pedido,
    ruta,
    entregas,
    resumenEntregas,
  })

  const estado = estadoConfig(pedidoFinal.resumenOperativo.estado)
  const cierre = pedidoFinal.resumenOperativo.estadoCierre
    ? estadoCierreConfig(pedidoFinal.resumenOperativo.estadoCierre)
    : null
  const printHref = `/api/pedidos/${pedido.id}/pdf`

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-lg border border-primary/10 bg-gradient-to-br from-primary/5 via-white to-secondary/5 p-4 shadow-sm md:p-6">
        <div className="absolute right-0 top-0 -z-10 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <Button variant="outline" size="sm" asChild>
              <Link href="/almacen/pedidos">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Link>
            </Button>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                  Pedido final {pedidoFinal.resumenOperativo.numeroPedido}
                </h1>
                <Badge variant={estado.variant} className={estado.color}>
                  {estado.label}
                </Badge>
                {cierre && (
                  <Badge variant="outline" className={cierre.color}>
                    {cierre.label}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground md:text-base">
                Reparto consolidado por entregas reales, con kilos finales y total operativo
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {pedidoFinal.resumenOperativo.fechaEntrega
                  ? formatDate(pedidoFinal.resumenOperativo.fechaEntrega)
                  : 'Sin fecha'}
              </span>
              <span className="inline-flex items-center gap-1">
                <Route className="h-4 w-4" />
                {pedidoFinal.resumenOperativo.zona}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {pedidoFinal.resumenOperativo.turno
                  ? `Turno ${pedidoFinal.resumenOperativo.turno}`
                  : 'Sin turno'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild>
              <a href={printHref} target="_blank" rel="noreferrer">
                <Printer className="mr-2 h-4 w-4" />
                Imprimir
              </a>
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
                  Ver en monitor
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href="/reparto/rutas">
                <Truck className="mr-2 h-4 w-4" />
                Ver rutas
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Card className="border-t-[3px] border-t-primary bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ruta / chofer</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="truncate text-lg font-semibold">
              {pedidoFinal.resumenOperativo.rutaNumero
                ? `Ruta ${pedidoFinal.resumenOperativo.rutaNumero}`
                : 'Sin ruta'}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {pedidoFinal.resumenOperativo.repartidor}
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-slate-400 bg-slate-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Vehiculo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="line-clamp-2 text-sm font-semibold">{pedidoFinal.resumenOperativo.vehiculo}</p>
            <p className="text-xs text-muted-foreground">
              {pedidoFinal.resumenOperativo.rutaEstado || 'Sin estado de ruta'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-blue-500 bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Entregas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-700">
              {pedidoFinal.resumenOperativo.cantidadEntregas}
            </p>
            <p className="text-xs text-muted-foreground">
              {pedidoFinal.resumenOperativo.entregasEntregadas} entregadas /{' '}
              {pedidoFinal.resumenOperativo.entregasPendientes} pendientes
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-yellow-500 bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Scale className="h-4 w-4 text-yellow-700" />
              Kg finales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-700">
              {pedidoFinal.resumenOperativo.totalKgFinal.toFixed(2)} kg
            </p>
            <p className="text-xs text-muted-foreground">
              {pedidoFinal.resumenOperativo.totalUnidades.toFixed(0)} u no pesables
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-emerald-500 bg-emerald-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Wallet className="h-4 w-4 text-emerald-700" />
              Total final
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-700">
              {formatCurrency(pedidoFinal.resumenOperativo.totalMonetario)}
            </p>
            <p className="text-xs text-muted-foreground">
              Cobrado {formatCurrency(pedidoFinal.resumenOperativo.totalCobrado)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-t-[3px] border-t-orange-500 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Package className="h-4 w-4 text-orange-700" />
              Estado de cobro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold capitalize text-orange-700">
              {pedidoFinal.resumenOperativo.pagoEstado || 'pendiente'}
            </p>
            <p className="text-xs text-muted-foreground">
              Pedido {pedidoFinal.resumenOperativo.estado}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Operacion del reparto</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Fecha del pedido</p>
                <p>
                  {pedidoFinal.resumenOperativo.fechaPedido
                    ? formatDate(pedidoFinal.resumenOperativo.fechaPedido)
                    : 'Sin fecha'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fecha final de entrega</p>
                <p>
                  {pedidoFinal.resumenOperativo.fechaEntrega
                    ? formatDate(pedidoFinal.resumenOperativo.fechaEntrega)
                    : 'Sin fecha'}
                </p>
              </div>
              {pedidoFinal.resumenOperativo.fechaEntregaReal && (
                <div>
                  <p className="text-xs text-muted-foreground">Entrega registrada</p>
                  <p>{formatDate(pedidoFinal.resumenOperativo.fechaEntregaReal)}</p>
                </div>
              )}
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Zona</p>
                <p>{pedidoFinal.resumenOperativo.zona}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Turno</p>
                <p>{pedidoFinal.resumenOperativo.turno || 'Sin turno'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Chofer</p>
                <p>{pedidoFinal.resumenOperativo.repartidor}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Asignacion y vehiculo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Ruta:</span>
                <span className="text-right">
                  {pedidoFinal.resumenOperativo.rutaNumero
                    ? `Ruta ${pedidoFinal.resumenOperativo.rutaNumero}`
                    : 'Sin asignar'}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Vehiculo:</span>
                <span className="text-right">{pedidoFinal.resumenOperativo.vehiculo}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Chofer:</span>
                <span className="text-right">{pedidoFinal.resumenOperativo.repartidor}</span>
              </div>
            </div>

            {pedido.estado === 'preparando' && (
              <AsignarVehiculoSelect
                pedidoId={pedido.id}
                numeroPedido={pedido.numero_pedido}
                estado={pedido.estado}
                pesoTotal={pedidoFinal.resumenOperativo.totalKgFinal}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <PedidoConsolidadoFinal consolidado={pedidoFinal.consolidadoFinalPorProducto} />

      <EntregasPedido entregas={pedidoFinal.entregasFinales} resumen={resumenEntregas} />

      {pedidoFinal.observaciones && (
        <Card>
          <CardHeader>
            <CardTitle>Observaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{pedidoFinal.observaciones}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
