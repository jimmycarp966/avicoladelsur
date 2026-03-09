'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowUpRight, ArrowDownRight, DollarSign, FileText, Clock } from 'lucide-react'
import { formatFixed } from '@/lib/utils'

interface Movimiento {
  id: string
  tipo: 'ingreso' | 'egreso'
  monto: number
  descripcion: string | null
  saldo_anterior: number
  saldo_nuevo: number
  origen_tipo: string | null
  created_at: string
}

interface TesoreriaTableProps {
  movimientos: Movimiento[]
}

export function TesoreriaTable({ movimientos }: TesoreriaTableProps) {
  const getTipoBadge = (tipo: string) => {
    if (tipo === 'ingreso') {
      return (
        <Badge variant="default" className="flex items-center gap-1">
          <ArrowUpRight className="w-3 h-3" />
          Ingreso
        </Badge>
      )
    } else {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <ArrowDownRight className="w-3 h-3" />
          Egreso
        </Badge>
      )
    }
  }

  const getOrigenIcon = (origenTipo: string | null) => {
    switch (origenTipo) {
      case 'venta':
        return <DollarSign className="w-4 h-4 text-green-600" />
      case 'gasto':
        return <FileText className="w-4 h-4 text-red-600" />
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />
    }
  }

  const getOrigenLabel = (origenTipo: string | null) => {
    switch (origenTipo) {
      case 'venta':
        return 'Venta'
      case 'gasto':
        return 'Gasto'
      case 'transferencia':
        return 'Transferencia'
      default:
        return 'Ajuste'
    }
  }

  if (movimientos.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No hay movimientos recientes</h3>
        <p className="text-muted-foreground">
          No se encontraron movimientos en los últimos 30 días
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {movimientos.map((movimiento) => (
        <Card key={movimiento.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  movimiento.tipo === 'ingreso' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {getOrigenIcon(movimiento.origen_tipo)}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">
                      {movimiento.descripcion || `Movimiento ${movimiento.id.slice(-8)}`}
                    </h4>
                    {getTipoBadge(movimiento.tipo)}
                    <Badge variant="outline" className="text-xs">
                      {getOrigenLabel(movimiento.origen_tipo)}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>
                      {new Date(movimiento.created_at).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>

                    <span className="flex items-center gap-1">
                      <span>Saldo anterior:</span>
                      <span className="font-medium">${formatFixed(movimiento.saldo_anterior, 2)}</span>
                    </span>

                    <span className="flex items-center gap-1">
                      <span>Saldo nuevo:</span>
                      <span className="font-medium">${formatFixed(movimiento.saldo_nuevo, 2)}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className={`text-2xl font-bold ${
                  movimiento.tipo === 'ingreso' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {movimiento.tipo === 'ingreso' ? '+' : '-'}${formatFixed(movimiento.monto, 2)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {movimiento.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Resumen */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-sm">
            <div className="text-muted-foreground">
              <strong>{movimientos.length}</strong> movimientos en los últimos 30 días
            </div>

            <div className="flex gap-6 text-right">
              <div>
                <div className="text-sm font-medium text-green-600">
                  +${movimientos
                    .filter(m => m.tipo === 'ingreso')
                    .reduce((sum, m) => sum + (m.monto || 0), 0)
                    .toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">Ingresos</div>
              </div>

              <div>
                <div className="text-sm font-medium text-red-600">
                  -${movimientos
                    .filter(m => m.tipo === 'egreso')
                    .reduce((sum, m) => sum + (m.monto || 0), 0)
                    .toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">Egresos</div>
              </div>

              <div>
                <div className={`text-lg font-bold ${
                  movimientos.reduce((sum, m) => sum + (m.tipo === 'ingreso' ? m.monto : -m.monto), 0) >= 0
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}>
                  ${movimientos
                    .reduce((sum, m) => sum + (m.tipo === 'ingreso' ? m.monto : -m.monto), 0)
                    .toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">Balance</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
