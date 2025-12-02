'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ShoppingCart, DollarSign, User, Clock } from 'lucide-react'

interface Venta {
  id: string
  total: number
  estado: string
  metodo_pago: string
  created_at: string
  clientes: {
    nombre: string
    apellido: string
  } | null
}

interface VentasTableProps {
  ventas: Venta[]
}

export function VentasTable({ ventas }: VentasTableProps) {
  const getMetodoPagoBadge = (metodo: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      efectivo: "default",
      transferencia: "secondary",
      tarjeta: "outline",
      cuenta_corriente: "destructive",
    }

    const labels: Record<string, string> = {
      efectivo: "Efectivo",
      transferencia: "Transferencia",
      tarjeta: "Tarjeta",
      cuenta_corriente: "Cta. Cte.",
    }

    return (
      <Badge variant={variants[metodo] || "secondary"}>
        {labels[metodo] || metodo}
      </Badge>
    )
  }

  if (ventas.length === 0) {
    return (
      <div className="text-center py-12">
        <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No hay ventas del día</h3>
        <p className="text-muted-foreground">
          Aún no se han registrado ventas completadas hoy
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {ventas.map((venta) => (
        <Card key={venta.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-green-600" />
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">Pedido #{venta.id.slice(-8)}</h4>
                    <Badge variant="default" className="text-xs">
                      Completado
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {venta.clientes
                        ? `${venta.clientes.nombre} ${venta.clientes.apellido || ''}`
                        : 'Cliente desconocido'
                      }
                    </div>

                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(venta.created_at).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>

                    <div className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      ${venta.total?.toFixed(2) || '0.00'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {getMetodoPagoBadge(venta.metodo_pago)}
                <div className="text-right">
                  <div className="text-lg font-bold text-green-600">
                    ${venta.total?.toFixed(2) || '0.00'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Total pagado
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Resumen del día */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              <strong>{ventas.length}</strong> ventas completadas hoy
            </div>

            <div className="text-right">
              <div className="text-lg font-bold text-green-600">
                ${ventas.reduce((sum, venta) => sum + (venta.total || 0), 0).toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">
                Total del día
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
