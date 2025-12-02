'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle, Package, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { resolverAlertaAction } from '@/actions/sucursales.actions'

interface AlertaStock {
  id: string
  sucursal_id: string
  producto_id: string
  cantidad_actual: number
  umbral: number
  estado: 'pendiente' | 'en_transito' | 'resuelto'
  created_at: string
  updated_at: string
}

interface AlertasData {
  alertas: AlertaStock[]
  estadisticas: {
    pendientes: number
    resueltas: number
    total: number
  }
}

export function AlertasContent({ data }: { data: AlertasData }) {
  const [resolvingAlerts, setResolvingAlerts] = useState<Set<string>>(new Set())

  const handleResolverAlerta = async (alertaId: string, accion: 'en_transito' | 'resuelto') => {
    setResolvingAlerts(prev => new Set(prev).add(alertaId))

    try {
      const result = await resolverAlertaAction({ alertaId, accion })

      if (result.success) {
        toast.success(
          accion === 'en_transito'
            ? 'Alerta marcada como en tránsito'
            : 'Alerta resuelta exitosamente'
        )
        // Recargar la página para actualizar los datos
        window.location.reload()
      } else {
        toast.error(result.error || 'Error al resolver alerta')
      }
    } catch (error) {
      toast.error('Error inesperado al resolver alerta')
    } finally {
      setResolvingAlerts(prev => {
        const newSet = new Set(prev)
        newSet.delete(alertaId)
        return newSet
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-8 h-8" />
            Alertas de Stock
          </h1>
          <p className="text-muted-foreground">
            Gestiona las alertas de productos con stock bajo en tu sucursal
          </p>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas Pendientes</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{data.estadisticas.pendientes}</div>
            <p className="text-xs text-muted-foreground">
              Requieren atención inmediata
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas Resueltas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{data.estadisticas.resueltas}</div>
            <p className="text-xs text-muted-foreground">
              Gestionadas recientemente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Alertas</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.estadisticas.total}</div>
            <p className="text-xs text-muted-foreground">
              Historial completo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Alertas */}
      <Card>
        <CardHeader>
          <CardTitle>Alertas Activas</CardTitle>
          <CardDescription>
            Lista de productos con stock bajo que requieren atención
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.alertas.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">¡Excelente!</h3>
              <p className="text-muted-foreground">
                No hay alertas de stock activas en tu sucursal
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.alertas.map((alerta: AlertaStock) => (
                <div
                  key={alerta.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">Producto #{alerta.producto_id}</h4>
                        <Badge variant={alerta.estado === 'pendiente' ? "destructive" : "secondary"}>
                          {alerta.estado}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Stock actual: {alerta.cantidad_actual}</span>
                        <span>•</span>
                        <span>Umbral mínimo: {alerta.umbral}</span>
                        <span>•</span>
                        <span>
                          {new Date(alerta.created_at).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {alerta.estado === 'pendiente' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResolverAlerta(alerta.id, 'en_transito')}
                          disabled={resolvingAlerts.has(alerta.id)}
                        >
                          {resolvingAlerts.has(alerta.id) ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <Package className="w-3 h-3 mr-1" />
                          )}
                          En Tránsito
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => handleResolverAlerta(alerta.id, 'resuelto')}
                          disabled={resolvingAlerts.has(alerta.id)}
                        >
                          {resolvingAlerts.has(alerta.id) ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3 h-3 mr-1" />
                          )}
                          Resolver
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
