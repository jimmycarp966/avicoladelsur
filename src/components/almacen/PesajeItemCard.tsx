'use client'

import { useState, useEffect, useCallback } from 'react'
import { Scale, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ScanButton } from '@/components/barcode/BarcodeScanner'
import { parseBarcodeEAN13 } from '@/lib/barcode-parser'
import { toast } from 'sonner'

interface ItemPesable {
  id: string
  pesable: boolean
  peso_final?: number | null
  cantidad_solicitada: number
  cantidad_reservada: number
  subtotal_est: number
  subtotal_final?: number | null
  precio_unit_est?: number | null // Precio de la lista de precios asignada
  producto?: {
    nombre?: string
    codigo?: string
    categoria?: string
    precio_venta?: number
    unidad_medida?: string | null
  }
}

interface PesajeItemCardProps {
  item: ItemPesable
  esMayorista?: boolean
  kgPorUnidadMayor?: number
  unidadMayorNombre?: string
  estaPesado: boolean
  estaActualizando: boolean
  onSimularPeso: () => Promise<void>
  onAplicarPeso: (peso: number) => Promise<void>
}

export function PesajeItemCard({
  item,
  esMayorista = false,
  kgPorUnidadMayor,
  unidadMayorNombre,
  estaPesado,
  estaActualizando,
  onSimularPeso,
  onAplicarPeso,
}: PesajeItemCardProps) {
  const [pesoInput, setPesoInput] = useState<string>(item.peso_final?.toString() || '')
  // Usar precio_unit_est (precio de lista) > precio_venta del producto como fallback
  const precioUnitario = item.precio_unit_est ?? item.producto?.precio_venta ?? 0

  // Calcular subtotal en tiempo real mientras escribe
  const calcularSubtotalPreview = (): number | null => {
    if (!pesoInput || pesoInput.trim() === '') return null
    const peso = parseFloat(pesoInput)
    if (isNaN(peso) || peso <= 0) return null
    return peso * precioUnitario
  }

  const subtotalPreview = calcularSubtotalPreview()

  // Sincronizar con el valor guardado cuando se actualiza
  useEffect(() => {
    let isMounted = true
    if (item.peso_final) {
      // Usar microtask para evitar cascading renders
      queueMicrotask(() => {
        if (isMounted) {
          setPesoInput(item.peso_final!.toString())
        }
      })
    }
    return () => { isMounted = false }
  }, [item.peso_final])



  // Sincronizar con cambios externos en el input (ej: simulación de peso)
  useEffect(() => {
    const input = document.getElementById(`peso-${item.id}`) as HTMLInputElement
    if (input) {
      const handleInputChange = () => {
        setPesoInput(input.value)
      }
      input.addEventListener('input', handleInputChange)
      return () => {
        input.removeEventListener('input', handleInputChange)
      }
    }
  }, [item.id])

  // Manejar escaneo de código de barras
  const handleScan = useCallback((code: string) => {
    console.log('[PesajeItemCard] 📷 Código recibido del escáner:', code)
    const parsed = parseBarcodeEAN13(code)
    console.log('[PesajeItemCard] 🔍 Resultado del parser:', {
      isValid: parsed.isValid,
      isWeightCode: parsed.isWeightCode,
      plu: parsed.plu,
      weight: parsed.weight,
      error: parsed.error
    })

    if (parsed.isWeightCode && parsed.weight) {
      console.log('[PesajeItemCard] ✅ Peso detectado:', parsed.weight.toFixed(3), 'kg')
      setPesoInput(parsed.weight.toFixed(3))
      toast.success(`Peso escaneado: ${parsed.weight.toFixed(3)} kg`)
    } else if (parsed.plu) {
      console.log('[PesajeItemCard] ⚠️ Código sin peso:', parsed.plu)
      toast.info(`Código PLU: ${parsed.plu} (sin peso embebido)`)
    } else {
      console.log('[PesajeItemCard] ❌ Código no válido:', parsed.error)
      toast.error('Código no válido: ' + (parsed.error || 'formato desconocido'))
    }
  }, [])

  return (
    <Card className={estaPesado ? "border-green-200 bg-green-50/50" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${estaPesado ? 'bg-green-100' : 'bg-orange-100'}`}>
              <Scale className={`h-5 w-5 ${estaPesado ? 'text-green-600' : 'text-orange-600'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{item.producto?.nombre}</CardTitle>
                {item.producto?.categoria === 'BALANZA' && (
                  <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                    <Scale className="mr-1 h-3 w-3" />
                    BALANZA
                  </Badge>
                )}
              </div>
              <CardDescription>
                Código: {item.producto?.codigo} |
                {esMayorista && unidadMayorNombre && kgPorUnidadMayor ? (
                  <>
                    Solicitado: {item.cantidad_solicitada} {unidadMayorNombre}{item.cantidad_solicitada !== 1 ? '(s)' : ''} ≈ {(item.cantidad_solicitada * kgPorUnidadMayor).toFixed(1)} kg |
                    Reservado: {item.cantidad_reservada} {unidadMayorNombre}{item.cantidad_reservada !== 1 ? '(s)' : ''} ≈ {(item.cantidad_reservada * kgPorUnidadMayor).toFixed(1)} kg
                  </>
                ) : (
                  <>
                    Solicitado: {item.cantidad_solicitada}kg |
                    Reservado: {item.cantidad_reservada}kg
                  </>
                )}
              </CardDescription>
            </div>
          </div>
          {estaPesado && (
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle className="mr-1 h-3 w-3" />
              Pesado
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`peso-${item.id}`}>Peso Final (kg)</Label>
              <Input
                id={`peso-${item.id}`}
                type="number"
                step="0.01"
                placeholder="0.00"
                value={pesoInput}
                onChange={(e) => setPesoInput(e.target.value)}
                className="text-lg"
                disabled={estaActualizando}
              />
            </div>
            <div>
              <Label>Precio por KG</Label>
              <div className="p-3 bg-gray-50 rounded-md text-lg font-mono">
                ${precioUnitario.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <div className="text-muted-foreground">
                Subtotal estimado: <span className="font-medium">${(item.subtotal_est || 0).toFixed(2)}</span>
              </div>
              {/* Mostrar subtotal final guardado O previsualización en tiempo real */}
              {estaPesado && item.subtotal_final ? (
                <div className="mt-1 text-green-600 font-medium">
                  → Final (guardado): ${item.subtotal_final.toFixed(2)}
                </div>
              ) : subtotalPreview !== null ? (
                <div className="mt-1 text-blue-600 font-medium">
                  → Vista previa: ${subtotalPreview.toFixed(2)}
                  <span className="ml-2 text-xs text-muted-foreground">(aún no guardado)</span>
                </div>
              ) : null}
            </div>

            <div className="flex gap-2">
              <ScanButton
                onScan={handleScan}
                size="sm"
                variant="outline"
                title="Escanear Etiqueta"
                description="Escanea la etiqueta de la balanza para obtener el peso"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  // Llamar al callback para simular peso, que manejará la API
                  await onSimularPeso() // El peso se obtendrá de la API
                }}
                disabled={estaActualizando}
              >
                <Scale className="mr-2 h-4 w-4" />
                Simular Peso
              </Button>

              <Button
                type="button"
                disabled={estaPesado || estaActualizando || !pesoInput || parseFloat(pesoInput) <= 0}
                onClick={async () => {
                  const peso = parseFloat(pesoInput)
                  if (!isNaN(peso) && peso > 0) {
                    await onAplicarPeso(peso)
                  }
                }}
              >
                {estaActualizando ? (
                  <>
                    <Scale className="mr-2 h-4 w-4 animate-spin" />
                    Actualizando...
                  </>
                ) : estaPesado ? (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Actualizado
                  </>
                ) : (
                  <>
                    <Scale className="mr-2 h-4 w-4" />
                    Aplicar Peso
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

