'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, LockOpen, DollarSign, RefreshCw } from 'lucide-react'
import { crearCierreCajaAction } from '@/actions/tesoreria.actions'
import { getTodayArgentina } from '@/lib/utils'
import { toast } from 'sonner'

interface AbrirCajaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cajaId: string
  cajaNombre: string
  saldoActual?: number
}

export function AbrirCajaDialog({ open, onOpenChange, cajaId, cajaNombre, saldoActual: saldoActualProp }: AbrirCajaDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isLoadingSaldo, setIsLoadingSaldo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saldoActual, setSaldoActual] = useState<number | null>(saldoActualProp || null)
  const [saldoInicial, setSaldoInicial] = useState<string>('')

  // Cargar saldo actual cuando se abre el diálogo
  useEffect(() => {
    if (open && cajaId) {
      cargarSaldoActual()
    }
  }, [open, cajaId])

  // Actualizar saldo inicial cuando cambia el saldo actual
  useEffect(() => {
    if (saldoActual !== null) {
      setSaldoInicial(saldoActual.toFixed(2))
    }
  }, [saldoActual])

  const cargarSaldoActual = async () => {
    setIsLoadingSaldo(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/tesoreria/cajas/${cajaId}`)
      const result = await response.json()
      
      if (result.success && result.data) {
        setSaldoActual(result.data.saldo_actual || 0)
      } else {
        throw new Error(result.error || 'Error al obtener saldo de la caja')
      }
    } catch (err: any) {
      const message = err.message || 'Error al obtener saldo de la caja'
      setError(message)
      toast.error(message)
    } finally {
      setIsLoadingSaldo(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!saldoInicial || parseFloat(saldoInicial) < 0) {
      setError('El saldo inicial debe ser mayor o igual a 0')
      return
    }

    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.append('caja_id', cajaId)
        formData.append('fecha', getTodayArgentina())
        formData.append('saldo_inicial', saldoInicial)

        const result = await crearCierreCajaAction(formData)

        if (result.success) {
          toast.success('Caja abierta exitosamente')
          onOpenChange(false)
          setSaldoInicial('')
          router.refresh()
        } else {
          setError(result.error || 'Error al abrir la caja')
          toast.error(result.error || 'Error al abrir la caja')
        }
      } catch (err: any) {
        const message = err.message || 'Error inesperado al abrir la caja'
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
            <LockOpen className="h-5 w-5" />
            Abrir Caja
          </DialogTitle>
          <DialogDescription>
            Abre la caja <strong>{cajaNombre}</strong> para el día de hoy
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-900">
              <strong>Fecha:</strong> {new Date().toLocaleDateString('es-AR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
            <p className="text-sm text-blue-700 mt-1">
              Se creará un nuevo cierre de caja para hoy. Si ya existe un cierre abierto, no se podrá crear otro.
            </p>
          </div>

          {/* Saldo actual de la caja */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Saldo Actual en Caja
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={cargarSaldoActual}
                disabled={isLoadingSaldo}
                className="h-8"
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isLoadingSaldo ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>
            
            {isLoadingSaldo ? (
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Consultando saldo...</span>
                  </div>
                </CardContent>
              </Card>
            ) : saldoActual !== null ? (
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-sm text-green-700 mb-1">Saldo actual en caja</p>
                    <p className="text-3xl font-bold text-green-600">
                      ${saldoActual.toFixed(2)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-yellow-50 border-yellow-200">
                <CardContent className="pt-4">
                  <p className="text-sm text-yellow-800 text-center">
                    No se pudo obtener el saldo. Por favor, actualiza o ingresa el saldo manualmente.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Saldo inicial para el cierre */}
          <div className="space-y-2">
            <Label htmlFor="saldo-inicial">Saldo Inicial del Cierre *</Label>
            <Input
              id="saldo-inicial"
              type="number"
              step="0.01"
              min="0"
              value={saldoInicial}
              onChange={(e) => setSaldoInicial(e.target.value)}
              placeholder="0.00"
              required
            />
            <p className="text-xs text-muted-foreground">
              Este será el saldo inicial del cierre de caja. Puedes ajustarlo si el saldo físico difiere del sistema.
            </p>
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
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Abriendo...
                </>
              ) : (
                <>
                  <LockOpen className="mr-2 h-4 w-4" />
                  Abrir Caja
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

