'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Truck, ArrowRight, ArrowLeft, Package, Calendar } from 'lucide-react'

interface Transferencia {
  id: string
  numero_transferencia: string
  estado: string
  sucursal_origen: { id: string; nombre: string }
  sucursal_destino: { id: string; nombre: string }
  fecha_solicitud: string
  items: Array<{
    id: string
    cantidad_solicitada: number
    cantidad_enviada: number | null
    cantidad_recibida: number | null
    producto: { nombre: string; codigo: string } | null
  }>
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
    if (transferencia.sucursal_origen.id === sucursalId) {
      return { tipo: 'origen', icon: ArrowRight, label: 'Enviada' }
    } else {
      return { tipo: 'destino', icon: ArrowLeft, label: 'Recibida' }
    }
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
        const totalCantidad = transferencia.items?.reduce((sum, item) =>
          sum + (item.cantidad_solicitada || 0), 0
        ) || 0

        return (
          <Card key={transferencia.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    tipo === 'origen' ? 'bg-blue-100' : 'bg-green-100'
                  }`}>
                    <DirectionIcon className={`w-6 h-6 ${
                      tipo === 'origen' ? 'text-blue-600' : 'text-green-600'
                    }`} />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{transferencia.numero_transferencia}</h4>
                      {getEstadoBadge(transferencia.estado)}
                      <Badge variant="outline" className="text-xs">
                        {label}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span>{tipo === 'origen' ? 'Para:' : 'Desde:'}</span>
                        <span className="font-medium">
                          {tipo === 'origen' ? transferencia.sucursal_destino.nombre : transferencia.sucursal_origen.nombre}
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

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
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
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              <strong>{transferencias.filter(t => t.sucursal_origen.id === sucursalId).length}</strong> enviadas •
              <strong> {transferencias.filter(t => t.sucursal_destino.id === sucursalId).length}</strong> recibidas •
              <strong> {transferencias.filter(t => t.estado === 'recibida').length}</strong> completadas
            </div>

            <div className="text-right">
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
