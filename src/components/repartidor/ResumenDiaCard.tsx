'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, DollarSign, Truck, Package, TrendingUp } from 'lucide-react'

interface ResumenDiaCardProps {
  totalRetiros: number
  totalTransferencias: number
  fecha?: Date
}

export function ResumenDiaCard({ totalRetiros, totalTransferencias, fecha }: ResumenDiaCardProps) {
  const formatearMoneda = (monto: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2
    }).format(monto)
  }

  const formatearFecha = (date?: Date) => {
    if (!date) {
      date = new Date()
    }
    return date.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })
  }

  const totalGeneral = totalRetiros + totalTransferencias

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-600" />
              Resumen del Día
            </CardTitle>
            <CardDescription>
              {formatearFecha(fecha)}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumen general */}
        <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 rounded-lg border border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <span className="font-semibold text-purple-900 dark:text-purple-100">Total del día:</span>
            </div>
            <span className="text-3xl font-bold text-purple-700 dark:text-purple-300">
              {formatearMoneda(totalGeneral)}
            </span>
          </div>
        </div>

        {/* Desglose */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Retiros */}
          <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="font-medium text-green-900 dark:text-green-100">Retiros</span>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                {formatearMoneda(totalRetiros)}
              </div>
              <p className="text-xs text-green-600 dark:text-green-400">
                Dinero de sucursales
              </p>
            </div>
          </div>

          {/* Transferencias */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="font-medium text-blue-900 dark:text-blue-100">Transferencias</span>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {totalTransferencias}
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                Movimientos de stock
              </p>
            </div>
          </div>
        </div>

        {/* Información adicional */}
        <div className="p-4 bg-muted rounded-lg">
          <div className="flex items-start gap-2">
            <Package className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium">Recordatorio:</p>
              <p>Valida los retiros al recibir el dinero y verifica las transferencias de stock al completarlas.</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
