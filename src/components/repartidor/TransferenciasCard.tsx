'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Truck, Building2, Calendar, ArrowRight } from 'lucide-react'

interface Transferencia {
  id: string
  numero_transferencia: string
  sucursal_origen: { id: string; nombre: string }
  sucursal_destino: { id: string; nombre: string }
  estado: string
  fecha_solicitud: string
  fecha_envio?: string
  fecha_recepcion?: string
}

interface TransferenciasCardProps {
  transferencias: Transferencia[]
}

export function TransferenciasCard({ transferencias }: TransferenciasCardProps) {
  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'pendiente':
        return <Badge variant="secondary">Pendiente</Badge>
      case 'en_transito':
        return <Badge variant="default" className="bg-blue-600">En tránsito</Badge>
      case 'recibida':
        return <Badge variant="default" className="bg-green-600">Recibida</Badge>
      case 'cancelada':
        return <Badge variant="destructive">Cancelada</Badge>
      default:
        return <Badge variant="outline">{estado}</Badge>
    }
  }

  const transferenciasPendientes = transferencias.filter(t => 
    ['pendiente', 'en_transito'].includes(t.estado)
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-600" />
              Transferencias de Stock
            </CardTitle>
            <CardDescription>
              Movimientos de mercadería entre sucursales
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-lg">
            {transferenciasPendientes.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {transferencias.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Truck className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No hay transferencias pendientes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transferencias.map((transferencia) => (
              <div key={transferencia.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-muted-foreground">
                        #{transferencia.numero_transferencia}
                      </span>
                      {getEstadoBadge(transferencia.estado)}
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{transferencia.sucursal_origen.nombre}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{transferencia.sucursal_destino.nombre}</span>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatearFecha(transferencia.fecha_solicitud)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
