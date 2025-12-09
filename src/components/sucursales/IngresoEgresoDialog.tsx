'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { toast } from 'sonner'

interface IngresoEgresoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cajaId: string
  tipo: 'ingreso' | 'egreso'
}

export function IngresoEgresoDialog({ open, onOpenChange, cajaId, tipo }: IngresoEgresoDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  
  const [monto, setMonto] = useState('')
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'tarjeta' | 'qr'>('efectivo')
  const [descripcion, setDescripcion] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!monto || parseFloat(monto) <= 0) {
      setError('El monto debe ser mayor a 0')
      return
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/tesoreria/movimientos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caja_id: cajaId,
            tipo,
            monto: parseFloat(monto),
            metodo_pago: metodoPago,
            descripcion: descripcion || undefined,
            origen_tipo: 'manual',
          }),
        })

        const result = await response.json()

        if (!result.success) {
          throw new Error(result.error || 'Error al registrar movimiento')
        }

        toast.success(`${tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} registrado exitosamente`)
        onOpenChange(false)
        setMonto('')
        setDescripcion('')
        setMetodoPago('efectivo')
        router.refresh()
      } catch (err: any) {
        const message = err.message || `Error inesperado al registrar ${tipo}`
        setError(message)
        toast.error(message)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {tipo === 'ingreso' ? (
              <ArrowUpRight className="h-5 w-5 text-green-600" />
            ) : (
              <ArrowDownRight className="h-5 w-5 text-red-600" />
            )}
            Registrar {tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
          </DialogTitle>
          <DialogDescription>
            Registra un {tipo === 'ingreso' ? 'ingreso' : 'egreso'} manual en la caja
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="monto">Monto *</Label>
            <Input
              id="monto"
              type="number"
              step="0.01"
              min="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="metodo-pago">Método de Pago *</Label>
            <Select value={metodoPago} onValueChange={(value: any) => setMetodoPago(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona método de pago" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
                <SelectItem value="tarjeta">Tarjeta</SelectItem>
                <SelectItem value="qr">QR / Mercado Pago</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Detalle del movimiento..."
              rows={3}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false)
                setMonto('')
                setDescripcion('')
                setMetodoPago('efectivo')
              }}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isPending}
              className={tipo === 'ingreso' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  {tipo === 'ingreso' ? (
                    <ArrowUpRight className="mr-2 h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="mr-2 h-4 w-4" />
                  )}
                  Registrar {tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

