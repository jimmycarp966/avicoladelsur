'use client'

import { DollarSign, CreditCard, QrCode, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TesoroResumenProps {
  saldosPorTipo: {
    efectivo: number
    transferencia: number
    qr: number
    tarjeta: number
  }
}

export function TesoroResumen({ saldosPorTipo }: TesoroResumenProps) {
  const total = Object.values(saldosPorTipo).reduce((sum, val) => sum + val, 0)

  return (
    <div className="grid gap-4 md:grid-cols-5">
      <Card className="border-t-[3px] border-t-primary bg-primary/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Tesoro</CardTitle>
          <DollarSign className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${total.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">Saldo total</p>
        </CardContent>
      </Card>

      <Card className="border-t-[3px] border-t-green-600 bg-green-50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Efectivo</CardTitle>
          <Wallet className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">${saldosPorTipo.efectivo.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">Dinero físico</p>
        </CardContent>
      </Card>

      <Card className="border-t-[3px] border-t-blue-600 bg-blue-50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Transferencia</CardTitle>
          <CreditCard className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">${saldosPorTipo.transferencia.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">Bancarias</p>
        </CardContent>
      </Card>

      <Card className="border-t-[3px] border-t-purple-600 bg-purple-50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">QR</CardTitle>
          <QrCode className="h-4 w-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-600">${saldosPorTipo.qr.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">Pagos QR</p>
        </CardContent>
      </Card>

      <Card className="border-t-[3px] border-t-orange-600 bg-orange-50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tarjeta</CardTitle>
          <CreditCard className="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">${saldosPorTipo.tarjeta.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">Pagos con tarjeta</p>
        </CardContent>
      </Card>
    </div>
  )
}

