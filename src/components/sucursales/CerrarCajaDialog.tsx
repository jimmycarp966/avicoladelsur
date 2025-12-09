'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Lock, Calculator, Wallet } from 'lucide-react'
import { cerrarCierreCajaAction } from '@/actions/tesoreria.actions'
import { toast } from 'sonner'

interface CerrarCajaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cierreId: string
  saldoInicial: number
  totalIngresos: number
  totalEgresos: number
  totalCobranzasCC: number
  totalGastos: number
}

export function CerrarCajaDialog({
  open,
  onOpenChange,
  cierreId,
  saldoInicial,
  totalIngresos,
  totalEgresos,
  totalCobranzasCC,
  totalGastos,
}: CerrarCajaDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  
  // Arqueo por métodos de pago
  const [arqueoEfectivo, setArqueoEfectivo] = useState('0')
  const [arqueoTransferencia, setArqueoTransferencia] = useState('0')
  const [arqueoTarjeta, setArqueoTarjeta] = useState('0')
  const [arqueoQr, setArqueoQr] = useState('0')
  const [retiroTesoro, setRetiroTesoro] = useState('0')
  const [saldoFinal, setSaldoFinal] = useState('0')

  // Calcular totales automáticamente
  const totalArqueo = parseFloat(arqueoEfectivo || '0') + 
                      parseFloat(arqueoTransferencia || '0') + 
                      parseFloat(arqueoTarjeta || '0') + 
                      parseFloat(arqueoQr || '0')
  
  const saldoFinalCalculado = saldoInicial + totalIngresos - totalEgresos - parseFloat(retiroTesoro || '0')
  const diferencia = parseFloat(saldoFinal || '0') - saldoFinalCalculado

  useEffect(() => {
    if (open) {
      // Resetear valores al abrir
      setArqueoEfectivo('0')
      setArqueoTransferencia('0')
      setArqueoTarjeta('0')
      setArqueoQr('0')
      setRetiroTesoro('0')
      setSaldoFinal(saldoFinalCalculado.toFixed(2))
      setError(null)
    }
  }, [open, saldoFinalCalculado])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.append('cierre_id', cierreId)
        formData.append('saldo_final', saldoFinal)
        formData.append('total_ingresos', totalIngresos.toString())
        formData.append('total_egresos', totalEgresos.toString())
        formData.append('cobranzas_cuenta_corriente', totalCobranzasCC.toString())
        formData.append('gastos', totalGastos.toString())
        formData.append('retiro_tesoro', retiroTesoro || '0')
        formData.append('arqueo_efectivo', arqueoEfectivo || '0')
        formData.append('arqueo_transferencia', arqueoTransferencia || '0')
        formData.append('arqueo_tarjeta', arqueoTarjeta || '0')
        formData.append('arqueo_qr', arqueoQr || '0')

        const result = await cerrarCierreCajaAction(formData)

        if (result.success) {
          toast.success('Caja cerrada exitosamente')
          onOpenChange(false)
          router.refresh()
        } else {
          setError(result.error || 'Error al cerrar la caja')
          toast.error(result.error || 'Error al cerrar la caja')
        }
      } catch (err: any) {
        const message = err.message || 'Error inesperado al cerrar la caja'
        setError(message)
        toast.error(message)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Cerrar Caja
          </DialogTitle>
          <DialogDescription>
            Registra el arqueo por métodos de pago y cierra la caja
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Totales automáticos */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="pt-4">
                <Label className="text-sm font-medium text-blue-900">Total Ingresos</Label>
                <div className="text-2xl font-bold text-blue-600">${totalIngresos.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <Label className="text-sm font-medium text-red-900">Total Egresos</Label>
                <div className="text-2xl font-bold text-red-600">${totalEgresos.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <Label className="text-sm font-medium text-green-900">Cobranzas Cta. Cte.</Label>
                <div className="text-2xl font-bold text-green-600">${totalCobranzasCC.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <Label className="text-sm font-medium text-orange-900">Gastos</Label>
                <div className="text-2xl font-bold text-orange-600">${totalGastos.toFixed(2)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Arqueo por métodos de pago */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="h-5 w-5" />
              <Label className="text-base font-semibold">Arqueo por Métodos de Pago</Label>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="arqueo-efectivo">Efectivo *</Label>
                <Input
                  id="arqueo-efectivo"
                  type="number"
                  step="0.01"
                  min="0"
                  value={arqueoEfectivo}
                  onChange={(e) => setArqueoEfectivo(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="arqueo-transferencia">Transferencia *</Label>
                <Input
                  id="arqueo-transferencia"
                  type="number"
                  step="0.01"
                  min="0"
                  value={arqueoTransferencia}
                  onChange={(e) => setArqueoTransferencia(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="arqueo-tarjeta">Tarjeta *</Label>
                <Input
                  id="arqueo-tarjeta"
                  type="number"
                  step="0.01"
                  min="0"
                  value={arqueoTarjeta}
                  onChange={(e) => setArqueoTarjeta(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="arqueo-qr">QR / Mercado Pago *</Label>
                <Input
                  id="arqueo-qr"
                  type="number"
                  step="0.01"
                  min="0"
                  value={arqueoQr}
                  onChange={(e) => setArqueoQr(e.target.value)}
                  required
                />
              </div>
            </div>

            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Total Arqueo:</span>
                  <span className="text-xl font-bold">${totalArqueo.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Retiro al tesoro y saldo final */}
          <div className="grid gap-4 md:grid-cols-2">
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
                onChange={(e) => {
                  setRetiroTesoro(e.target.value)
                  const nuevoSaldo = saldoInicial + totalIngresos - totalEgresos - parseFloat(e.target.value || '0')
                  setSaldoFinal(nuevoSaldo.toFixed(2))
                }}
              />
              <p className="text-xs text-muted-foreground">
                Dinero retirado para depósito bancario
              </p>
            </div>

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
          </div>

          {/* Resumen final */}
          <Card className={`border-2 ${Math.abs(diferencia) > 0.01 ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}`}>
            <CardContent className="pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Saldo Final Esperado:</span>
                  <span className="text-xl font-bold">${saldoFinalCalculado.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Saldo Final Ingresado:</span>
                  <span className="text-xl font-bold">${parseFloat(saldoFinal || '0').toFixed(2)}</span>
                </div>
                {Math.abs(diferencia) > 0.01 && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="font-semibold text-red-700">Diferencia:</span>
                    <span className={`text-xl font-bold ${diferencia > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${diferencia > 0 ? '+' : ''}{diferencia.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending} className="bg-green-600 hover:bg-green-700">
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cerrando...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Cerrar Caja
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

