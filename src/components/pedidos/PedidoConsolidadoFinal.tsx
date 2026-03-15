import { Package, Scale, Boxes } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import type { PedidoFinalCategoriaConsolidada } from '@/lib/pedidos/pedido-final-view'
import { formatPedidoFinalCantidad } from '@/lib/pedidos/pedido-final-view'

interface PedidoConsolidadoFinalProps {
  consolidado: PedidoFinalCategoriaConsolidada[]
}

export function PedidoConsolidadoFinal({ consolidado }: PedidoConsolidadoFinalProps) {
  const totalProductos = consolidado.reduce(
    (sum, categoria) => sum + categoria.productos.length,
    0,
  )
  const totalKg = consolidado.reduce(
    (sum, categoria) =>
      sum +
      categoria.productos.reduce(
        (acc, producto) => acc + (producto.pesable ? producto.totalCantidadFinal : 0),
        0,
      ),
    0,
  )
  const totalUnidades = consolidado.reduce(
    (sum, categoria) =>
      sum +
      categoria.productos.reduce(
        (acc, producto) => acc + (producto.pesable ? 0 : producto.totalCantidadFinal),
        0,
      ),
    0,
  )

  return (
    <Card className="border border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Preparacion final consolidada
        </CardTitle>
        <CardDescription>
          Productos finales agrupados por categoria segun las entregas reales del pedido
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-primary/10 bg-primary/5 p-4">
            <p className="text-xs uppercase text-muted-foreground">Productos</p>
            <p className="mt-1 text-2xl font-semibold">{totalProductos}</p>
          </div>
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <p className="text-xs uppercase text-muted-foreground">Kg finales</p>
            <p className="mt-1 text-2xl font-semibold text-yellow-700">{totalKg.toFixed(2)} kg</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase text-muted-foreground">Unidades / cajas</p>
            <p className="mt-1 text-2xl font-semibold text-slate-700">{totalUnidades.toFixed(0)} u</p>
          </div>
        </div>

        {consolidado.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Este pedido todavia no tiene entregas finales para consolidar.
          </div>
        ) : (
          <div className="space-y-6">
            {consolidado.map((categoria) => (
              <div key={categoria.nombre} className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {categoria.nombre}
                  </h3>
                  <Badge variant="outline">{categoria.productos.length} producto(s)</Badge>
                </div>

                <div className="space-y-2">
                  {categoria.productos.map((producto) => (
                    <div
                      key={producto.key}
                      className={`rounded-lg border p-4 ${
                        producto.pesable
                          ? 'border-yellow-300 bg-yellow-50'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{producto.nombre}</p>
                            <Badge
                              variant="outline"
                              className={
                                producto.pesable
                                  ? 'border-yellow-400 bg-yellow-100 text-yellow-800'
                                  : 'border-slate-300 bg-slate-100 text-slate-700'
                              }
                            >
                              {producto.pesable ? (
                                <>
                                  <Scale className="mr-1 h-3 w-3" />
                                  Balanza
                                </>
                              ) : (
                                <>
                                  <Boxes className="mr-1 h-3 w-3" />
                                  Unidad
                                </>
                              )}
                            </Badge>
                            {producto.codigo && (
                              <span className="text-xs text-muted-foreground">
                                Codigo: {producto.codigo}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <span>{producto.entregas} entrega(s)</span>
                            <span>{producto.clientes} cliente(s)</span>
                            <span>Total {formatCurrency(producto.totalSubtotal)}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <p
                            className={`text-lg font-semibold ${
                              producto.pesable ? 'text-yellow-700' : 'text-slate-700'
                            }`}
                          >
                            {formatPedidoFinalCantidad(producto.totalCantidadFinal, producto.pesable)}
                          </p>
                          <p className="text-xs text-muted-foreground">Cantidad final</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
