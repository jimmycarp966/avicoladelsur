'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { DollarSign, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface Billete {
  denominacion: number
  cantidad: number
  subtotal: number
}

interface ArqueoBilletesFormProps {
  montoEsperado: number
  onArqueoChange: (billetes: Billete[], totalReal: number, diferencia: number, observaciones: string) => void
  disabled?: boolean
}

const DENOMINACIONES = [20000, 10000, 2000, 1000, 500, 200, 100]

export function ArqueoBilletesForm({ montoEsperado, onArqueoChange, disabled = false }: ArqueoBilletesFormProps) {
  const [billetes, setBilletes] = useState<Billete[]>(
    DENOMINACIONES.map(denominacion => ({
      denominacion,
      cantidad: 0,
      subtotal: 0
    }))
  )
  const [observaciones, setObservaciones] = useState('')

  const totalReal = billetes.reduce((sum, b) => sum + b.subtotal, 0)
  const diferencia = totalReal - montoEsperado

  useEffect(() => {
    onArqueoChange(billetes, totalReal, diferencia, observaciones)
  }, [billetes, totalReal, diferencia, observaciones, onArqueoChange])

  const handleCantidadChange = (index: number, valor: string) => {
    const cantidad = Math.max(0, parseInt(valor) || 0)
    const nuevosBilletes = [...billetes]
    nuevosBilletes[index] = {
      ...nuevosBilletes[index],
      cantidad,
      subtotal: cantidad * nuevosBilletes[index].denominacion
    }
    setBilletes(nuevosBilletes)
  }

  const formatearMoneda = (monto: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2
    }).format(monto)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Arqueo de Caja
        </CardTitle>
        <CardDescription>
          Ingrese la cantidad de billetes de cada denominación
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Monto esperado */}
        <div className="p-4 bg-muted rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Monto esperado en efectivo:</span>
            <span className="text-2xl font-bold">{formatearMoneda(montoEsperado)}</span>
          </div>
        </div>

        {/* Formulario de billetes */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Billetes</Label>
          {billetes.map((billete, index) => (
            <div key={billete.denominacion} className="flex items-center gap-4">
              <div className="flex-1">
                <Label htmlFor={`billete-${billete.denominacion}`} className="text-sm">
                  Billetes de ${billete.denominacion.toLocaleString('es-AR')}
                </Label>
              </div>
              <div className="w-32">
                <Input
                  id={`billete-${billete.denominacion}`}
                  type="number"
                  min="0"
                  value={billete.cantidad || ''}
                  onChange={(e) => handleCantidadChange(index, e.target.value)}
                  disabled={disabled}
                  placeholder="0"
                />
              </div>
              <div className="w-40 text-right">
                <span className="text-sm font-medium">
                  {formatearMoneda(billete.subtotal)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Total del arqueo */}
        <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Total del arqueo:</span>
            <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {formatearMoneda(totalReal)}
            </span>
          </div>
        </div>

        {/* Diferencia */}
        {diferencia !== 0 && (
          <Alert variant={diferencia > 0 ? 'default' : 'destructive'}>
            {diferencia > 0 ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <AlertTitle className="flex items-center gap-2">
              {diferencia > 0 ? 'Sobrante' : 'Faltante'}
            </AlertTitle>
            <AlertDescription>
              Hay una diferencia de {formatearMoneda(Math.abs(diferencia))}
              {diferencia > 0 ? ' de más' : ' de menos'}
            </AlertDescription>
          </Alert>
        )}

        {/* Observaciones */}
        {diferencia !== 0 && (
          <div className="space-y-2">
            <Label htmlFor="observaciones" className="text-sm font-medium">
              Observaciones <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="observaciones"
              placeholder="Explique la razón de la diferencia..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              disabled={disabled}
              rows={3}
              required={diferencia !== 0}
            />
            {diferencia !== 0 && !observaciones.trim() && (
              <p className="text-xs text-red-500">
                Las observaciones son obligatorias cuando hay diferencia
              </p>
            )}
          </div>
        )}

        {/* Resumen final */}
        <div className="pt-4 border-t">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Esperado</p>
              <p className="text-lg font-semibold">{formatearMoneda(montoEsperado)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Real</p>
              <p className="text-lg font-semibold">{formatearMoneda(totalReal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Diferencia</p>
              <p className={`text-lg font-semibold ${
                diferencia > 0 ? 'text-green-600' : 
                diferencia < 0 ? 'text-red-600' : 
                'text-gray-600'
              }`}>
                {diferencia > 0 ? '+' : ''}{formatearMoneda(diferencia)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
