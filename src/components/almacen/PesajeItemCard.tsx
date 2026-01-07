'use client'

import { useState, useEffect, useCallback } from 'react'
import { Scale, CheckCircle, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ScanButton } from '@/components/barcode/BarcodeScanner'
import { parseBarcodeEAN13 } from '@/lib/barcode-parser'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

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
  const [showAnomalyDialog, setShowAnomalyDialog] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [anomalyInfo, setAnomalyInfo] = useState<{
    pesoIngresado: number
    pesoSolicitado: number
    razon: string
    sugerencia: string | null
    confianza: number
    usandoIA: boolean
  } | null>(null)

  // Usar precio_unit_est (precio de lista) > precio_venta del producto como fallback
  const precioUnitario = item.precio_unit_est ?? item.producto?.precio_venta ?? 0

  // Calcular peso solicitado (considerando si es mayorista)
  const pesoSolicitadoKg = esMayorista && kgPorUnidadMayor
    ? item.cantidad_solicitada * kgPorUnidadMayor
    : item.cantidad_solicitada

  /**
   * Analiza el peso usando Google Gemini AI
   * Con fallback a lógica local si la API falla
   */
  const analizarPesoConGemini = async (pesoIngresado: number): Promise<{
    esAnomalo: boolean
    razon: string
    sugerencia: string | null
    confianza: number
    usandoIA: boolean
  }> => {
    try {
      const response = await fetch('/api/almacen/analizar-peso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productoNombre: item.producto?.nombre || 'Producto',
          pesoSolicitado: pesoSolicitadoKg,
          pesoIngresado: pesoIngresado,
          unidad: 'kg'
        })
      })

      if (!response.ok) {
        throw new Error('Error en API')
      }

      const data = await response.json()

      return {
        esAnomalo: data.esAnomalo,
        razon: data.razon,
        sugerencia: data.sugerencia,
        confianza: data.confianza || 80,
        usandoIA: true
      }
    } catch (error) {
      console.error('[PesajeItemCard] Error con Gemini, usando fallback:', error)
      // Fallback a lógica local
      return detectarAnomaliaLocal(pesoIngresado)
    }
  }

  /**
   * Fallback: Detección local si Gemini no está disponible
   */
  const detectarAnomaliaLocal = (pesoIngresado: number): {
    esAnomalo: boolean
    razon: string
    sugerencia: string | null
    confianza: number
    usandoIA: boolean
  } => {
    const enteroIngresado = Math.floor(pesoIngresado)
    const enteroSolicitado = Math.floor(pesoSolicitadoKg)
    const digitosIngresado = enteroIngresado === 0 ? 1 : Math.floor(Math.log10(Math.abs(enteroIngresado))) + 1
    const digitosSolicitado = enteroSolicitado === 0 ? 1 : Math.floor(Math.log10(Math.abs(enteroSolicitado))) + 1

    if (digitosIngresado > digitosSolicitado) {
      return {
        esAnomalo: true,
        razon: `El peso ingresado (${pesoIngresado} kg) tiene ${digitosIngresado} dígitos pero lo solicitado tiene ${digitosSolicitado}. Posible error de digitación.`,
        sugerencia: `${(pesoIngresado / 10).toFixed(1)} kg`,
        confianza: 85,
        usandoIA: false
      }
    }

    if (pesoIngresado > pesoSolicitadoKg * 2 && pesoIngresado > 5) {
      return {
        esAnomalo: true,
        razon: `El peso ingresado es significativamente mayor al solicitado (${((pesoIngresado / pesoSolicitadoKg) * 100).toFixed(0)}%)`,
        sugerencia: null,
        confianza: 70,
        usandoIA: false
      }
    }

    return {
      esAnomalo: false,
      razon: '',
      sugerencia: null,
      confianza: 95,
      usandoIA: false
    }
  }

  // Handler para aplicar peso con validación de anomalía usando IA
  const handleAplicarPesoConValidacion = async () => {
    const peso = parseFloat(pesoInput)
    if (isNaN(peso) || peso <= 0) return

    setIsAnalyzing(true)

    try {
      const resultado = await analizarPesoConGemini(peso)

      if (resultado.esAnomalo) {
        setAnomalyInfo({
          pesoIngresado: peso,
          pesoSolicitado: pesoSolicitadoKg,
          razon: resultado.razon,
          sugerencia: resultado.sugerencia,
          confianza: resultado.confianza,
          usandoIA: resultado.usandoIA
        })
        setShowAnomalyDialog(true)
      } else {
        await onAplicarPeso(peso)
      }
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Handler para verificar anomalía al perder foco (onBlur)
  const handleBlur = async () => {
    const peso = parseFloat(pesoInput)
    if (isNaN(peso) || peso <= 0) return

    // Evitar re-analizar si ya se mostró diálogo o si el peso no cambió significativamente
    // (Podríamos agregar más lógica aquí para no spammear)

    setIsAnalyzing(true)
    try {
      const resultado = await analizarPesoConGemini(peso)

      if (resultado.esAnomalo) {
        setAnomalyInfo({
          pesoIngresado: peso,
          pesoSolicitado: pesoSolicitadoKg,
          razon: resultado.razon,
          sugerencia: resultado.sugerencia,
          confianza: resultado.confianza,
          usandoIA: resultado.usandoIA
        })
        setShowAnomalyDialog(true)
      }
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Confirmar aplicación de peso a pesar de la anomalía
  const confirmarPesoAnomalo = async () => {
    if (anomalyInfo) {
      await onAplicarPeso(anomalyInfo.pesoIngresado)
      setShowAnomalyDialog(false)
      setAnomalyInfo(null)
    }
  }

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
    <>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`peso-${item.id}`}>Peso Final (kg)</Label>
                <Input
                  id={`peso-${item.id}`}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={pesoInput}
                  onChange={(e) => setPesoInput(e.target.value)}
                  onBlur={handleBlur}
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

            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
              <div className="text-sm w-full md:w-auto">
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

              <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
                <ScanButton
                  onScan={handleScan}
                  size="sm"
                  variant="outline"
                  title="Escanear Etiqueta"
                  description="Escanea la etiqueta de la balanza para obtener el peso"
                  className="flex-1 md:flex-none"
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
                  className="flex-1 md:flex-none"
                >
                  <Scale className="mr-2 h-4 w-4" />
                  Simular
                </Button>

                <Button
                  type="button"
                  disabled={estaPesado || estaActualizando || isAnalyzing || !pesoInput || parseFloat(pesoInput) <= 0}
                  onClick={handleAplicarPesoConValidacion}
                  className="flex-1 md:flex-none whitespace-nowrap"
                >
                  {isAnalyzing ? (
                    <>
                      <Scale className="mr-2 h-4 w-4 animate-spin" />
                      Analizando...
                    </>
                  ) : estaActualizando ? (
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

      {/* Diálogo de confirmación de peso anómalo con IA */}
      <AlertDialog open={showAnomalyDialog} onOpenChange={setShowAnomalyDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              ⚠️ Peso Anómalo Detectado
              {anomalyInfo?.usandoIA && (
                <Badge variant="outline" className="ml-2 bg-purple-100 text-purple-700 border-purple-300 text-xs">
                  🤖 Google AI
                </Badge>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p className="text-base font-medium text-foreground">
                  {anomalyInfo?.razon}
                </p>

                {/* Sugerencia de la IA */}
                {anomalyInfo?.sugerencia && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <span className="text-sm text-blue-800">
                      💡 <strong>Sugerencia:</strong> ¿Quisiste escribir <span className="font-bold">{anomalyInfo.sugerencia}</span>?
                    </span>
                  </div>
                )}

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Peso solicitado:</span>
                    <span className="font-bold text-green-600">{anomalyInfo?.pesoSolicitado.toFixed(2)} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Peso ingresado:</span>
                    <span className="font-bold text-orange-600">{anomalyInfo?.pesoIngresado.toFixed(2)} kg</span>
                  </div>
                  <hr className="border-orange-200" />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Diferencia:</span>
                    <span className="font-bold text-red-600">
                      {anomalyInfo && ((anomalyInfo.pesoIngresado - anomalyInfo.pesoSolicitado)).toFixed(2)} kg
                      ({anomalyInfo && ((anomalyInfo.pesoIngresado / anomalyInfo.pesoSolicitado) * 100).toFixed(0)}%)
                    </span>
                  </div>
                  {anomalyInfo?.confianza && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Confianza del análisis:</span>
                      <span className={`font-bold ${anomalyInfo.confianza >= 80 ? 'text-red-600' : 'text-yellow-600'}`}>
                        {anomalyInfo.confianza}%
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  ¿Estás seguro de que deseas proceder con este peso?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowAnomalyDialog(false)
              setAnomalyInfo(null)
            }}>
              Cancelar y Corregir
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarPesoAnomalo}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Sí, Aplicar Peso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

