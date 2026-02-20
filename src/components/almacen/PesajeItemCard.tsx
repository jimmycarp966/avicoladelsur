'use client'

import { useState, useEffect, useCallback } from 'react'
import { Scale, CheckCircle, AlertTriangle, TrendingUp, X, Package, RotateCcw, PackageX } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ScanButton } from '@/components/barcode/BarcodeScanner'
import { parseBarcodeEAN13 } from '@/lib/barcode-parser'
import { toast } from 'sonner'
import {
  registrarPesajeHistorialAction,
  analizarPesoConHistorialAction,
  obtenerEstadisticasProductoAction,
  type ProductoEstadisticas
} from '@/actions/pesajes.actions'
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
import { Progress } from '@/components/ui/progress'

// Tipo para representar un escaneo individual (una bolsa)
interface ScanEntry {
  id: string
  peso: number
  timestamp: Date
}

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
  onMarcarSinStock?: () => Promise<void>  // Nueva prop para saltear por falta de stock
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
  onMarcarSinStock,
}: PesajeItemCardProps) {
  // Estado para escaneos acumulativos (múltiples bolsas)
  const [scanEntries, setScanEntries] = useState<ScanEntry[]>([])
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
  const [estadisticasProducto, setEstadisticasProducto] = useState<ProductoEstadisticas | null>(null)
  const [showSinStockDialog, setShowSinStockDialog] = useState(false)  // Nuevo estado

  // Calcular peso total acumulado de todas las bolsas escaneadas
  const pesoTotalAcumulado = scanEntries.reduce((sum, entry) => sum + entry.peso, 0)

  // Sincronizar pesoInput con el total acumulado cuando hay escaneos
  useEffect(() => {
    if (scanEntries.length > 0) {
      setPesoInput(pesoTotalAcumulado.toFixed(3))
    }
  }, [pesoTotalAcumulado, scanEntries.length])

  // Cargar estadísticas del producto al montar
  useEffect(() => {
    const cargarEstadisticas = async () => {
      if (item.producto?.codigo) {
        // Buscar producto_id por código (en producción usarías el ID real)
        const result = await obtenerEstadisticasProductoAction(item.id)
        if (result.success && result.data) {
          setEstadisticasProducto(result.data)
        }
      }
    }
    cargarEstadisticas()
  }, [item.id, item.producto?.codigo])

  // Usar precio_unit_est (precio de lista) > precio_venta del producto como fallback
  const precioUnitario = item.precio_unit_est ?? item.producto?.precio_venta ?? 0

  // Calcular peso solicitado (considerando si es mayorista)
  const pesoSolicitadoKg = esMayorista && kgPorUnidadMayor
    ? item.cantidad_solicitada * kgPorUnidadMayor
    : item.cantidad_solicitada

  // Calcular progreso hacia el objetivo
  const progresoPercent = Math.min((pesoTotalAcumulado / pesoSolicitadoKg) * 100, 100)

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
    // OPTIMIZACIÓN: Validación rápida local si la diferencia es menor al 15%
    // Esto evita llamar a la IA para casos obvios y acelera mucho el flujo
    const diferenciaPct = Math.abs((pesoIngresado - pesoSolicitadoKg) / pesoSolicitadoKg) * 100
    if (diferenciaPct <= 15) {
      console.log(`[PESAJE] Diferencia ${diferenciaPct.toFixed(1)}% ≤15%, aprobado sin IA`)
      return {
        esAnomalo: false,
        razon: '',
        sugerencia: null,
        confianza: 95,
        usandoIA: false
      }
    }

    // Timeout reducido a 5 segundos para no bloquear el flujo
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      console.warn('[PESAJE] Timeout de 5s alcanzado para Gemini. Abortando...')
      controller.abort()
    }, 5000)

    try {
      console.log(`[PESAJE] Iniciando análisis para ${item.producto?.nombre}: ${pesoIngresado}kg (solicitado: ${pesoSolicitadoKg}kg)`)

      const startTime = Date.now()
      const response = await fetch('/api/almacen/analizar-peso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productoNombre: item.producto?.nombre || 'Producto',
          pesoSolicitado: pesoSolicitadoKg,
          pesoIngresado: pesoIngresado,
          unidad: 'kg'
        }),
        signal: controller.signal
      })

      const duration = Date.now() - startTime
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`API respondió con status ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log(`[PESAJE] Análisis completado en ${duration}ms:`, data)

      return {
        esAnomalo: data.esAnomalo,
        razon: data.razon,
        sugerencia: data.sugerencia,
        confianza: data.confianza || 80,
        usandoIA: true
      }
    } catch (error) {
      clearTimeout(timeoutId)
      const isTimeout = error instanceof Error && error.name === 'AbortError'

      console.error(isTimeout
        ? '[PESAJE] Error: Tiempo de espera agotado. Usando lógica local de emergencia.'
        : '[PESAJE] Error en API Análisis. Usando lógica local de emergencia:', error)

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

    // Detectar exceso significativo (más del 25% de exceso)
    if (pesoIngresado > pesoSolicitadoKg * 1.25 && pesoIngresado > 2) {
      const excesoPct = ((pesoIngresado / pesoSolicitadoKg) - 1) * 100
      console.log(`[PESAJE-LOCAL] Anomalía detectada: Exceso de ${excesoPct.toFixed(0)}%`)
      return {
        esAnomalo: true,
        razon: `El peso ingresado (${pesoIngresado}kg) excede significativamente lo solicitado (${pesoSolicitadoKg}kg).`,
        sugerencia: null,
        confianza: 75,
        usandoIA: false
      }
    }

    // Detectar faltante significativo (menos del 75% del solicitado)
    if (pesoIngresado < pesoSolicitadoKg * 0.75 && pesoSolicitadoKg > 1) {
      const faltantePct = (1 - (pesoIngresado / pesoSolicitadoKg)) * 100
      console.log(`[PESAJE-LOCAL] Anomalía detectada: Faltante de ${faltantePct.toFixed(0)}%`)
      return {
        esAnomalo: true,
        razon: `El peso ingresado (${pesoIngresado}kg) es mucho menor a lo solicitado (${pesoSolicitadoKg}kg).`,
        sugerencia: null,
        confianza: 75,
        usandoIA: false
      }
    }

    console.log('[PESAJE-LOCAL] Peso validado como CORRECTO por lógica local.')

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
        console.log('[PESAJE] Anomalía confirmada. Mostrando diálogo de confirmación.')
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
        console.log('[PESAJE] Peso validado. Procediendo a guardar...')
        await onAplicarPeso(peso)
      }
    } catch (e) {
      console.error('[PESAJE] Error crítico en handleAplicarPesoConValidacion:', e)
      toast.error('Error al intentar aplicar el peso. Revisa la consola.')
    } finally {
      setIsAnalyzing(false)
    }
  }


  // Confirmar aplicación de peso a pesar de la anomalía
  const confirmarPesoAnomalo = async () => {
    if (anomalyInfo) {
      // Registrar en historial con feedback: usuario aceptó anomalía
      await registrarPesajeHistorialAction(
        item.id, // producto_id (usarías el ID real del producto)
        anomalyInfo.pesoSolicitado,
        anomalyInfo.pesoIngresado,
        true, // fue anomalía
        true, // usuario aceptó
        anomalyInfo.razon
      )

      await onAplicarPeso(anomalyInfo.pesoIngresado)
      setShowAnomalyDialog(false)
      setAnomalyInfo(null)
      toast.success('Pesaje registrado en historial para aprendizaje')
    }
  }

  // Rechazar peso anómalo
  const rechazarPesoAnomalo = async () => {
    if (anomalyInfo) {
      // Registrar en historial con feedback: usuario rechazó
      await registrarPesajeHistorialAction(
        item.id,
        anomalyInfo.pesoSolicitado,
        anomalyInfo.pesoIngresado,
        true, // fue anomalía
        false, // usuario rechazó
        anomalyInfo.razon
      )

      setShowAnomalyDialog(false)
      setAnomalyInfo(null)
      setPesoInput('')
    }
  }

  // Calcular subtotal en tiempo real mientras escribe
  const calcularSubtotalPreview = (): number | null => {
    if (!pesoInput || pesoInput.trim() === '') return null
    const peso = parseFloat(pesoInput)
    if (isNaN(peso) || peso <= 0) return null

    // Para mayoristas: calcular cuántas unidades mayores (bolsas) representa el peso
    if (esMayorista && kgPorUnidadMayor && kgPorUnidadMayor > 0) {
      const cantidadUnidades = peso / kgPorUnidadMayor
      return cantidadUnidades * precioUnitario
    }

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

  // Manejar escaneo de código de barras (ACUMULATIVO - múltiples bolsas)
  const handleScan = useCallback((code: string) => {
    const parsed = parseBarcodeEAN13(code)

    // Validar que el código PLU coincida con el producto del item actual
    const codigoProducto = item.producto?.codigo
    if (parsed.plu && codigoProducto) {
      // Normalizar códigos para comparación rápida (quitar ceros iniciales)
      const pluNormalizado = parsed.plu.replace(/^0+/, '') || '0'
      const codigoNormalizado = codigoProducto.replace(/^0+/, '') || '0'

      if (!pluNormalizado.includes(codigoNormalizado) && !codigoNormalizado.includes(pluNormalizado)) {
        toast.error(
          `El código escaneado (${parsed.plu}) NO corresponde al producto "${item.producto?.nombre}" (código: ${codigoProducto}). Escanea la etiqueta correcta.`,
          { duration: 5000 }
        )
        return
      }
    }

    // ACUMULATIVO: Agregar peso a la lista de bolsas escaneadas
    if (parsed.isWeightCode && parsed.weight) {
      const nuevaBolsa: ScanEntry = {
        id: crypto.randomUUID(),
        peso: parsed.weight,
        timestamp: new Date()
      }
      setScanEntries(prev => [...prev, nuevaBolsa])

      const nuevoTotal = pesoTotalAcumulado + parsed.weight
      const bolsasCount = scanEntries.length + 1

      toast.success(
        `Bolsa ${bolsasCount}: ${parsed.weight.toFixed(3)} kg → Total: ${nuevoTotal.toFixed(3)} kg`,
        { duration: 3000 }
      )
    } else if (parsed.plu) {
      toast.info(`Código PLU: ${parsed.plu} (sin peso embebido)`)
    } else {
      toast.error('Código no válido: ' + (parsed.error || 'formato desconocido'))
    }
  }, [item.producto?.codigo, item.producto?.nombre, pesoTotalAcumulado, scanEntries.length])

  // Eliminar una bolsa individual del listado
  const handleRemoveScan = useCallback((scanId: string) => {
    setScanEntries(prev => {
      const bolsaEliminada = prev.find(e => e.id === scanId)
      const nuevaLista = prev.filter(e => e.id !== scanId)
      if (bolsaEliminada) {
        toast.info(`Bolsa de ${bolsaEliminada.peso.toFixed(3)} kg eliminada`)
      }
      return nuevaLista
    })
  }, [])

  // Resetear todos los escaneos
  const handleResetScans = useCallback(() => {
    setScanEntries([])
    setPesoInput('')
    toast.info('Todos los escaneos fueron eliminados')
  }, [])

  // Handler para marcar sin stock
  const handleConfirmarSinStock = async () => {
    setShowSinStockDialog(false)
    if (onMarcarSinStock) {
      await onMarcarSinStock()
    }
  }


  return (
    <>
      <Card className={`transition-all duration-300 hover:shadow-md ${estaPesado ? 'border-green-300 bg-green-50/80 shadow-[0_0_15px_rgba(34,197,94,0.15)]' : 'border-border/50 shadow-sm hover:border-primary/30'}`}>
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
                  onChange={(e) => {
                    // Si el usuario edita manualmente, limpiar escaneos
                    if (scanEntries.length > 0) {
                      setScanEntries([])
                    }
                    setPesoInput(e.target.value)
                  }}
                  className="text-lg"
                  disabled={estaActualizando}
                />
              </div>
              <div>
                <Label>
                  {esMayorista && unidadMayorNombre
                    ? `Precio por ${unidadMayorNombre}`
                    : 'Precio por KG'}
                </Label>
                <div className="p-3 bg-gray-50 rounded-md text-lg font-mono">
                  ${precioUnitario.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Sección de Bolsas Escaneadas (Pesaje Acumulativo) */}
            {scanEntries.length > 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-800">
                      {scanEntries.length} bolsa{scanEntries.length !== 1 ? 's' : ''} escaneada{scanEntries.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetScans}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    disabled={estaActualizando}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Reiniciar
                  </Button>
                </div>

                {/* Barra de progreso hacia el objetivo */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progreso: {pesoTotalAcumulado.toFixed(3)} kg</span>
                    <span>Objetivo: {pesoSolicitadoKg.toFixed(1)} kg</span>
                  </div>
                  <Progress
                    value={progresoPercent}
                    className={`h-2 ${progresoPercent >= 100 ? '[&>div]:bg-green-500' : '[&>div]:bg-blue-500'}`}
                  />
                  {progresoPercent >= 95 && progresoPercent < 100 && (
                    <p className="text-xs text-yellow-600">Casi listo, falta poco</p>
                  )}
                  {progresoPercent >= 100 && (
                    <p className="text-xs text-green-600 font-medium">Objetivo alcanzado</p>
                  )}
                </div>

                {/* Lista de bolsas individuales */}
                <div className="grid gap-1 max-h-32 overflow-y-auto">
                  {scanEntries.map((entry, index) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between bg-white rounded px-3 py-1.5 text-sm border border-blue-100"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">#{index + 1}</span>
                        <span className="font-mono font-medium">{entry.peso.toFixed(3)} kg</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveScan(entry.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                        disabled={estaActualizando}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Total acumulado */}
                <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                  <span className="text-sm text-blue-800">Total Acumulado:</span>
                  <span className="font-bold text-lg text-blue-900">
                    {pesoTotalAcumulado.toFixed(3)} kg
                  </span>
                </div>
              </div>
            )}

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

                {/* Botón Sin stock para saltear ítems */}
                {onMarcarSinStock && !estaPesado && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSinStockDialog(true)}
                    disabled={estaActualizando || isAnalyzing}
                    className="flex-1 md:flex-none text-orange-600 border-orange-300 hover:bg-orange-50"
                  >
                    <PackageX className="mr-2 h-4 w-4" />
                    Sin stock
                  </Button>
                )}

                <Button
                  type="button"
                  disabled={estaPesado || estaActualizando || isAnalyzing || !pesoInput || parseFloat(pesoInput) <= 0}
                  onClick={handleAplicarPesoConValidacion}
                  className={`flex-1 md:flex-none whitespace-nowrap transition-all duration-300 ${!estaPesado && pesoInput && parseFloat(pesoInput) > 0 ? 'bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl hover:-translate-y-0.5 scale-100 hover:scale-[1.02] text-primary-foreground font-semibold' : ''}`}
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
                    <span className={`font-bold ${anomalyInfo && anomalyInfo.pesoIngresado >= anomalyInfo.pesoSolicitado ? 'text-orange-600' : 'text-blue-600'}`}>
                      {anomalyInfo && (anomalyInfo.pesoIngresado - anomalyInfo.pesoSolicitado) >= 0 ? '+' : ''}
                      {anomalyInfo && ((anomalyInfo.pesoIngresado - anomalyInfo.pesoSolicitado)).toFixed(2)} kg
                      ({anomalyInfo && (anomalyInfo.pesoIngresado - anomalyInfo.pesoSolicitado) >= 0 ? '+' : ''}
                      {anomalyInfo && (((anomalyInfo.pesoIngresado / anomalyInfo.pesoSolicitado) - 1) * 100).toFixed(0)}%)
                    </span>
                  </div>
                  {anomalyInfo?.confianza && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Certeza:</span>
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
            <AlertDialogCancel onClick={rechazarPesoAnomalo}>
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

      {/* Diálogo de confirmación Sin stock */}
      <AlertDialog open={showSinStockDialog} onOpenChange={setShowSinStockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
              <PackageX className="h-5 w-5" />
              Marcar Sin Stock
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Vas a marcar <strong>{item.producto?.nombre || 'este producto'}</strong> como sin stock disponible.
                </p>
                <p className="text-sm text-muted-foreground">
                  Esto registrará peso 0 kg y el cliente no recibirá este producto (la factura se ajustará).
                </p>
                <p className="text-sm font-medium text-orange-600">
                  ¿Estás seguro?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarSinStock}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Sí, Sin Stock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

