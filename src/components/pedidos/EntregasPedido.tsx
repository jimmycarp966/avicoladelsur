'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Truck,
  User,
  MapPin,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Package
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { obtenerEntregasPedidoAction, obtenerResumenEntregasAction } from '@/actions/entregas.actions'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

interface EntregasPedidoProps {
  pedidoId: string
}

interface Entrega {
  entrega_id: string
  cliente_id: string
  cliente_nombre: string
  cliente_telefono: string
  presupuesto_id: string | null
  numero_presupuesto: string | null
  subtotal: number
  recargo: number
  total: number
  direccion: string | null
  orden_entrega: number
  estado_entrega: string
  estado_pago: string
  metodo_pago: string | null
  monto_cobrado: number
  referencia_pago: string | null
  observaciones: string | null
}

interface Resumen {
  total_entregas: number
  pendientes: number
  entregados: number
  fallidos: number
  total_a_cobrar: number
  total_cobrado: number
  pagados: number
  fiados: number
}

const estadoEntregaConfig = (estado: string) => {
  const configs: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    pendiente: {
      label: 'Pendiente',
      color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      icon: <Clock className="h-3 w-3" />
    },
    en_camino: {
      label: 'En camino',
      color: 'bg-blue-100 text-blue-800 border-blue-300',
      icon: <Truck className="h-3 w-3" />
    },
    entregado: {
      label: 'Entregado',
      color: 'bg-green-100 text-green-800 border-green-300',
      icon: <CheckCircle className="h-3 w-3" />
    },
    fallido: {
      label: 'Fallido',
      color: 'bg-red-100 text-red-800 border-red-300',
      icon: <XCircle className="h-3 w-3" />
    },
    parcial: {
      label: 'Parcial',
      color: 'bg-orange-100 text-orange-800 border-orange-300',
      icon: <Package className="h-3 w-3" />
    },
  }
  return configs[estado] || { label: estado, color: 'bg-gray-100 text-gray-800', icon: null }
}

const estadoPagoConfig = (estado: string) => {
  const configs: Record<string, { label: string; color: string }> = {
    pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
    parcial: { label: 'Parcial', color: 'bg-orange-100 text-orange-800' },
    pagado: { label: 'Pagado', color: 'bg-green-100 text-green-800' },
    fiado: { label: 'Fiado', color: 'bg-purple-100 text-purple-800' },
  }
  return configs[estado] || { label: estado, color: 'bg-gray-100 text-gray-800' }
}

export function EntregasPedido({ pedidoId }: EntregasPedidoProps) {
  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedEntregas, setExpandedEntregas] = useState<Set<string>>(new Set())

  useEffect(() => {
    const cargarDatos = async () => {
      setLoading(true)
      try {
        const [entregasResult, resumenResult] = await Promise.all([
          obtenerEntregasPedidoAction(pedidoId),
          obtenerResumenEntregasAction(pedidoId)
        ])

        if (entregasResult.success) {
          setEntregas(entregasResult.data || [])
        }
        if (resumenResult.success) {
          setResumen(resumenResult.data || null)
        }
      } catch (error) {
        console.error('Error cargando entregas:', error)
      } finally {
        setLoading(false)
      }
    }

    cargarDatos()
  }, [pedidoId])

  const toggleEntrega = (entregaId: string) => {
    setExpandedEntregas(prev => {
      const newSet = new Set(prev)
      if (newSet.has(entregaId)) {
        newSet.delete(entregaId)
      } else {
        newSet.add(entregaId)
      }
      return newSet
    })
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Entregas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (entregas.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Entregas
          </CardTitle>
          <CardDescription>
            Este pedido no tiene entregas asociadas (formato anterior)
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
          Entregas del Pedido
        </CardTitle>
        <CardDescription>
          {entregas.length} entrega(s) para diferentes clientes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Resumen */}
        {resumen && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Total a cobrar</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(resumen.total_a_cobrar)}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Cobrado</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(resumen.total_cobrado)}</p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Entregas</p>
              <p className="text-xl font-bold">
                <span className="text-green-600">{resumen.entregados}</span>
                <span className="text-muted-foreground"> / {resumen.total_entregas}</span>
              </p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">Fiados</p>
              <p className="text-xl font-bold text-purple-600">{resumen.fiados}</p>
            </div>
          </div>
        )}

        {/* Lista de entregas */}
        <div className="space-y-3">
          {entregas.map((entrega) => {
            const estadoEntrega = estadoEntregaConfig(entrega.estado_entrega)
            const estadoPago = estadoPagoConfig(entrega.estado_pago)
            const isExpanded = expandedEntregas.has(entrega.entrega_id)

            return (
              <Collapsible
                key={entrega.entrega_id}
                open={isExpanded}
                onOpenChange={() => toggleEntrega(entrega.entrega_id)}
              >
                <div className="rounded-lg border bg-card">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                          {entrega.orden_entrega}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{entrega.cliente_nombre}</span>
                          </div>
                          {entrega.direccion && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate max-w-[200px]">{entrega.direccion}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold">{formatCurrency(entrega.total)}</p>
                          {entrega.monto_cobrado > 0 && (
                            <p className="text-xs text-green-600">
                              Cobrado: {formatCurrency(entrega.monto_cobrado)}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className={`${estadoEntrega.color} flex items-center gap-1`}>
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
                    <div className="border-t px-4 py-3 bg-muted/30 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Teléfono</p>
                          <p>{entrega.cliente_telefono || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Presupuesto</p>
                          <p className="font-mono">{entrega.numero_presupuesto || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Método de pago</p>
                          <p>{entrega.metodo_pago || 'Sin registrar'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Referencia</p>
                          <p className="font-mono text-xs">{entrega.referencia_pago || '-'}</p>
                        </div>
                      </div>

                      {entrega.observaciones && (
                        <div>
                          <p className="text-xs text-muted-foreground">Observaciones</p>
                          <p className="text-sm">{entrega.observaciones}</p>
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-2 border-t">
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
                        {/* Nota: Las acciones de "En camino" y "Registrar cobro" se realizan 
                            desde la app del repartidor en /ruta/[ruta_id]/entrega/[entrega_id] */}
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

