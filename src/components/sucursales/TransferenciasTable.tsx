'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Truck, ArrowRight, ArrowLeft, Package, Calendar } from 'lucide-react'

interface Transferencia {
  id: string
  numero_transferencia: string
  estado: string
  sucursal_origen?: { id: string; nombre: string } | null
  sucursal_destino?: { id: string; nombre: string } | null
  fecha_solicitud: string
  items?: Array<{
    id: string
    cantidad_solicitada: number
    cantidad_enviada: number | null
    cantidad_recibida: number | null
    producto: { nombre: string; codigo: string } | null
  }> | null
}

interface TransferenciasTableProps {
  transferencias: Transferencia[]
  sucursalId: string
}

export function TransferenciasTable({ transferencias, sucursalId }: TransferenciasTableProps) {
  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'pendiente':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Package className="w-3 h-3" />
            Pendiente
          </Badge>
        )
      case 'en_transito':
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <Truck className="w-3 h-3" />
            En Tránsito
          </Badge>
        )
      case 'recibida':
        return (
          <Badge variant="default" className="flex items-center gap-1">
            <Package className="w-3 h-3" />
            Recibida
          </Badge>
        )
      case 'cancelada':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <Package className="w-3 h-3" />
            Cancelada
          </Badge>
        )
      default:
        return <Badge variant="secondary">{estado}</Badge>
    }
  }

  const getTipoTransferencia = (transferencia: Transferencia) => {
    const esOrigen = transferencia.sucursal_origen?.id === sucursalId
    const esDestino = transferencia.sucursal_destino?.id === sucursalId

    if (esOrigen) {
      return { tipo: 'origen', icon: ArrowRight, label: 'Enviada' }
    }

    if (esDestino) {
      return { tipo: 'destino', icon: ArrowLeft, label: 'Recibida' }
    }

    // Caso defensivo: transferencia sin relaciones cargadas
    return { tipo: 'desconocido', icon: ArrowRight, label: 'Transferencia' }
  }

  if (transferencias.length === 0) {
    return (
      <div className="text-center py-12">
        <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No hay transferencias</h3>
        <p className="text-muted-foreground">
          No se encontraron transferencias relacionadas con tu sucursal
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {transferencias.map((transferencia) => {
        const { tipo, icon: DirectionIcon, label } = getTipoTransferencia(transferencia)
        const totalItems = transferencia.items?.length || 0
        const totalCantidad =
          transferencia.items?.reduce((sum, item) => sum + (item.cantidad_solicitada || 0), 0) || 0

        return (
          <Card key={transferencia.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start">
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center ${tipo === 'origen'
                        ? 'bg-blue-100'
                        : tipo === 'destino'
                          ? 'bg-green-100'
                          : 'bg-muted'
                      }`}
                  >
                    <DirectionIcon
                      className={`w-6 h-6 ${tipo === 'origen'
                          ? 'text-blue-600'
                          : tipo === 'destino'
                            ? 'text-green-600'
                            : 'text-muted-foreground'
                        }`}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold">{transferencia.numero_transferencia}</h4>
                      {getEstadoBadge(transferencia.estado)}
                      <Badge variant="outline" className="text-xs">
                        {label}
                      </Badge>
                    </div>

                    <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                      <span className="flex items-center gap-1">
                        <span>{tipo === 'origen' ? 'Para:' : 'Desde:'}</span>
                        <span className="font-medium">
                          {tipo === 'origen'
                            ? transferencia.sucursal_destino?.nombre || 'Sucursal destino'
                            : transferencia.sucursal_origen?.nombre || 'Sucursal origen'}
                        </span>
                      </span>

                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(transferencia.fecha_solicitud).toLocaleDateString('es-ES')}
                      </span>

                      <span className="flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        {totalItems} productos • {totalCantidad} unidades
                      </span>
                    </div>

                    {/* Mostrar productos */}
                    {transferencia.items && transferencia.items.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {transferencia.items.slice(0, 3).map((item, index) => (
                          <Badge key={item.id} variant="secondary" className="text-xs">
                            {item.producto?.codigo || item.producto?.nombre || `Producto ${index + 1}`}
                            ({item.cantidad_solicitada})
                          </Badge>
                        ))}
                        {transferencia.items.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{transferencia.items.length - 3} más
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full items-center gap-1 sm:w-auto"
                    onClick={async () => {
                      const { generarRemitoTransferenciaAction } = await import('@/actions/remitos.actions')
                      const res = await generarRemitoTransferenciaAction(transferencia.id)
                      if (res.success && res.data?.archivo_url) {
                        window.open(res.data.archivo_url, '_blank')
                      } else {
                        alert(res.error || 'Error al generar remito')
                      }
                    }}
                  >
                    <Truck className="w-4 h-4" />
                    Remito
                  </Button>
                  <Button variant="outline" size="sm" className="w-full sm:w-auto">
                    Ver Detalles
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}

      {/* Resumen */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              <strong>{transferencias.filter((t) => t.sucursal_origen?.id === sucursalId).length}</strong> enviadas •
              <strong> {transferencias.filter((t) => t.sucursal_destino?.id === sucursalId).length}</strong> recibidas •
              <strong> {transferencias.filter((t) => t.estado === 'recibida').length}</strong> completadas
            </div>

            <div className="text-left sm:text-right">
              <div className="font-medium">
                Total productos transferidos
              </div>
              <div className="text-xs text-muted-foreground">
                {transferencias.reduce((sum, t) =>
                  sum + (t.items?.reduce((itemSum, item) => itemSum + (item.cantidad_solicitada || 0), 0) || 0), 0
                )} unidades
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
