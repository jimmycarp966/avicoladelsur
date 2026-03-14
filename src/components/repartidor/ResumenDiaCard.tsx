'use client'

import { Calendar, DollarSign, Package } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ResumenDiaCardProps {
  totalRetiros: number
  totalTransferencias: number
  fecha?: Date
}

function formatearMoneda(monto: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(monto)
}

function formatearFecha(fecha?: Date) {
  return (fecha || new Date()).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function ResumenDiaCard({ totalRetiros, totalTransferencias, fecha }: ResumenDiaCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Resumen del dia
        </CardTitle>
        <CardDescription>{formatearFecha(fecha)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-green-800">
              <DollarSign className="h-4 w-4" />
              <span className="font-medium">Retiros pendientes</span>
            </div>
            <p className="text-2xl font-bold text-green-700">{formatearMoneda(totalRetiros)}</p>
            <p className="text-xs text-green-700">Monto total a validar en caja</p>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-blue-800">
              <Package className="h-4 w-4" />
              <span className="font-medium">Transferencias activas</span>
            </div>
            <p className="text-2xl font-bold text-blue-700">{totalTransferencias}</p>
            <p className="text-xs text-blue-700">Cantidad de movimientos de stock</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
