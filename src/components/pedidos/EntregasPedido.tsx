'use client'

import { useState } from 'react'
import {
  Truck,
  User,
  MapPin,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Package,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { formatCurrency } from '@/lib/utils'
import type { PedidoFinalEntrega } from '@/lib/pedidos/pedido-final-view'
import { formatPedidoFinalCantidad } from '@/lib/pedidos/pedido-final-view'

interface EntregasPedidoProps {
  entregas: PedidoFinalEntrega[]
  resumen: {
    total_entregas: number
    pendientes: number
    entregados: number
    rechazados?: number
    total_a_cobrar: number
    total_cobrado: number
    pagados: number
    cuenta_corriente?: number
  } | null
}

const estadoEntregaConfig = (estado: string) => {
  const configs: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    pendiente: {
      label: 'Pendiente',
      color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      icon: <Clock className="h-3 w-3" />,
    },
    en_camino: {
      label: 'En camino',
      color: 'bg-blue-100 text-blue-800 border-blue-300',
      icon: <Truck className="h-3 w-3" />,
    },
    entregado: {
      label: 'Entregado',
      color: 'bg-green-100 text-green-800 border-green-300',
      icon: <CheckCircle className="h-3 w-3" />,
    },
    fallido: {
      label: 'Fallido',
      color: 'bg-red-100 text-red-800 border-red-300',
      icon: <XCircle className="h-3 w-3" />,
    },
    parcial: {
      label: 'Parcial',
      color: 'bg-orange-100 text-orange-800 border-orange-300',
      icon: <Package className="h-3 w-3" />,
    },
  }

  return configs[estado] || { label: estado, color: 'bg-gray-100 text-gray-800', icon: null }
}

const estadoPagoConfig = (estado: string | null | undefined) => {
  const configs: Record<string, { label: string; color: string }> = {
    pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
    parcial: { label: 'Parcial', color: 'bg-orange-100 text-orange-800' },
    pagado: { label: 'Pagado', color: 'bg-green-100 text-green-800' },
    fiado: { label: 'Fiado', color: 'bg-purple-100 text-purple-800' },
    cuenta_corriente: { label: 'Cuenta corriente', color: 'bg-purple-100 text-purple-800' },
  }

  return configs[estado || ''] || { label: estado || 'Sin estado', color: 'bg-gray-100 text-gray-800' }
}

export function EntregasPedido({ entregas, resumen }: EntregasPedidoProps) {
  const [expandedEntregas, setExpandedEntregas] = useState<Set<string>>(new Set())

  const toggleEntrega = (entregaId: string) => {
    setExpandedEntregas((prev) => {
      const next = new Set(prev)
      if (next.has(entregaId)) {
        next.delete(entregaId)
      } else {
        next.add(entregaId)
      }
      return next
    })
  }

  if (entregas.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Entregas finales
          </CardTitle>
          <CardDescription>
            Este pedido todavia no tiene entregas finales asociadas.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Entregas finales por cliente
        </CardTitle>
        <CardDescription>
          {entregas.length} entrega(s) reales que componen este pedido final
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {resumen && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Total final</p>
              <p className="text-xl font-bold text-primary">
                {formatCurrency(resumen.total_a_cobrar)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Cobrado</p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(resumen.total_cobrado)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Entregadas</p>
              <p className="text-xl font-bold">
                <span className="text-green-600">{resumen.entregados}</span>
                <span className="text-muted-foreground"> / {resumen.total_entregas}</span>
              </p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Cuenta corriente</p>
              <p className="text-xl font-bold text-purple-600">
                {resumen.cuenta_corriente || 0}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {entregas.map((entrega) => {
            const estadoEntrega = estadoEntregaConfig(entrega.estadoEntrega)
            const estadoPago = estadoPagoConfig(entrega.estadoPago)
            const isExpanded = expandedEntregas.has(entrega.entregaId)

            return (
              <Collapsible
                key={entrega.entregaId}
                open={isExpanded}
                onOpenChange={() => toggleEntrega(entrega.entregaId)}
              >
                <div className="rounded-lg border bg-card">
                  <CollapsibleTrigger asChild>
                    <div className="flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-muted/50">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                          {entrega.ordenEntrega}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{entrega.clienteNombre}</span>
                          </div>
                          {entrega.direccion && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate max-w-[240px]">{entrega.direccion}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold">{formatCurrency(entrega.total)}</p>
                          <p className="text-xs text-muted-foreground">
                            {entrega.totalKg.toFixed(2)} kg | {entrega.totalUnidades.toFixed(0)} u
                          </p>
                          {entrega.montoCobrado > 0 && (
                            <p className="text-xs text-green-600">
                              Cobrado: {formatCurrency(entrega.montoCobrado)}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col gap-1">
                          <Badge
                            variant="outline"
                            className={`${estadoEntrega.color} flex items-center gap-1`}
                          >
                            {estadoEntrega.icon}
                            {estadoEntrega.label}
                          </Badge>
                          <Badge variant="outline" className={estadoPago.color}>
                            {estadoPago.label}
                          </Badge>
                        </div>

                        <Button variant="ghost" size="sm">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="space-y-4 border-t bg-muted/30 px-4 py-3">
                      {entrega.items.length > 0 && (
                        <div className="overflow-hidden rounded-md border bg-white text-sm">
                          <table className="w-full">
                            <thead className="bg-muted text-xs text-muted-foreground">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium">Producto</th>
                                <th className="px-3 py-2 text-right font-medium">Cantidad final</th>
                                <th className="px-3 py-2 text-right font-medium">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {entrega.items.map((item) => (
                                <tr key={`${entrega.entregaId}-${item.key}`}>
                                  <td className="px-3 py-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="font-medium">{item.nombre}</p>
                                      <Badge
                                        variant="outline"
                                        className={
                                          item.pesable
                                            ? 'border-yellow-300 bg-yellow-100 text-yellow-800'
                                            : 'border-slate-300 bg-slate-100 text-slate-700'
                                        }
                                      >
                                        {item.pesable ? 'Balanza' : 'Unidad'}
                                      </Badge>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">
                                      {item.codigo || 'Sin código'}
                                    </p>
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {formatPedidoFinalCantidad(item.cantidadFinal, item.pesable)}
                                  </td>
                                  <td className="px-3 py-2 text-right font-medium">
                                    {formatCurrency(item.subtotal)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3 lg:grid-cols-6">
                        <div>
                          <p className="text-xs text-muted-foreground">Telefono</p>
                          <p>{entrega.clienteTelefono || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Presupuesto</p>
                          <p className="font-mono">{entrega.numeroPresupuesto || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Metodo de pago</p>
                          <p>{entrega.metodoPago || 'Sin registrar'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Referencia</p>
                          <p className="font-mono text-xs">{entrega.referenciaPago || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Kg finales</p>
                          <p>{entrega.totalKg.toFixed(2)} kg</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Unidades</p>
                          <p>{entrega.totalUnidades.toFixed(0)} u</p>
                        </div>
                      </div>

                      {entrega.observaciones && (
                        <div>
                          <p className="text-xs text-muted-foreground">Observaciones</p>
                          <p className="text-sm">{entrega.observaciones}</p>
                        </div>
                      )}

                      <div className="flex items-center justify-between border-t pt-2">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Subtotal: </span>
                          <span>{formatCurrency(entrega.subtotal)}</span>
                          {entrega.recargo > 0 && (
                            <>
                              <span className="text-muted-foreground"> + Recargo: </span>
                              <span>{formatCurrency(entrega.recargo)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
