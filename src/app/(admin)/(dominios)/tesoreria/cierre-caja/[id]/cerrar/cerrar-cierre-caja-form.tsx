'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DollarSign, Calculator, Wallet } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cerrarCierreCajaAction } from '@/actions/tesoreria.actions'
import { toast } from 'sonner'

interface CerrarCierreCajaFormProps {
  cierreId: string
  saldoInicial: number
  totalIngresos: number
  totalEgresos: number
  totalCobranzasCC: number
  totalGastos: number
}

export function CerrarCierreCajaForm({
  cierreId,
  saldoInicial,
  totalIngresos,
  totalEgresos,
  totalCobranzasCC,
  totalGastos,
}: CerrarCierreCajaFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saldoFinal, setSaldoFinal] = useState((saldoInicial + totalIngresos - totalEgresos).toFixed(2))
  const [retiroTesoro, setRetiroTesoro] = useState('0')

  const saldoFinalCalculado = saldoInicial + totalIngresos - totalEgresos - parseFloat(retiroTesoro || '0')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('cierre_id', cierreId)
      formData.append('saldo_final', saldoFinal)
      formData.append('total_ingresos', totalIngresos.toString())
      formData.append('total_egresos', totalEgresos.toString())
      formData.append('cobranzas_cuenta_corriente', totalCobranzasCC.toString())
      formData.append('gastos', totalGastos.toString())
      formData.append('retiro_tesoro', retiroTesoro || '0')

      const result = await cerrarCierreCajaAction(formData)

      if (result.success) {
        toast.success(result.message || 'Cierre de caja cerrado exitosamente')
        router.push('/tesoreria/cierre-caja')
      } else {
        toast.error(result.message || 'Error al cerrar cierre de caja')
      }
    } catch (error) {
      toast.error('Error inesperado al cerrar cierre de caja')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Cerrar Cierre de Caja
        </CardTitle>
        <CardDescription>
          Ingresa los totales finales y confirma el cierre
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Totales automáticos */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <Label className="text-sm font-medium text-blue-900">Total Ingresos</Label>
              <div className="text-2xl font-bold text-blue-600">${totalIngresos.toFixed(2)}</div>
            </div>
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <Label className="text-sm font-medium text-red-900">Total Egresos</Label>
              <div className="text-2xl font-bold text-red-600">${totalEgresos.toFixed(2)}</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <Label className="text-sm font-medium text-green-900">Cobranzas Cuenta Corriente</Label>
              <div className="text-2xl font-bold text-green-600">${totalCobranzasCC.toFixed(2)}</div>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <Label className="text-sm font-medium text-orange-900">Gastos</Label>
              <div className="text-2xl font-bold text-orange-600">${totalGastos.toFixed(2)}</div>
            </div>
          </div>

          {/* Campos editables */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="saldo-final">Saldo Final *</Label>
              <Input
                id="saldo-final"
                type="number"
                step="0.01"
                value={saldoFinal}
                onChange={(e) => setSaldoFinal(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Calculado: ${saldoFinalCalculado.toFixed(2)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="retiro-tesoro" className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Retiro al Tesoro
              </Label>
              <Input
                id="retiro-tesoro"
                type="number"
                step="0.01"
                min="0"
                value={retiroTesoro}
                onChange={(e) => setRetiroTesoro(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Dinero retirado para depósito bancario
              </p>
            </div>
          </div>

          {/* Resumen final */}
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Saldo Final Esperado:</span>
              <span className="text-2xl font-bold">
                ${saldoFinalCalculado.toFixed(2)}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              Saldo Inicial: ${saldoInicial.toFixed(2)} + Ingresos: ${totalIngresos.toFixed(2)} - Egresos: ${totalEgresos.toFixed(2)} - Retiro Tesoro: ${parseFloat(retiroTesoro || '0').toFixed(2)}
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full bg-green-600 hover:bg-green-700">
            {loading ? 'Cerrando...' : 'Cerrar Cierre de Caja'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

