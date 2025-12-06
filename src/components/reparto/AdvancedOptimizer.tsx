'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Loader2, TrendingDown, Clock, Fuel, MapPin, CheckCircle2, XCircle } from 'lucide-react'
import { useNotificationStore } from '@/store/notificationStore'

interface AdvancedOptimizerProps {
  rutaId: string
  distanciaOriginal?: number
  tiempoOriginal?: number
  onOptimized?: (result: OptimizationResult) => void
}

interface OptimizationResult {
  success: boolean
  ordenVisita: any[]
  distanciaTotalKm: number
  duracionTotalMin: number
  optimizadaPor: string
  metricas?: {
    ahorroDistancia?: number
    ahorroTiempo?: number
    ahorroCombustible?: number
    distanciaOriginal?: number
    tiempoOriginal?: number
  }
  error?: string
}

export function AdvancedOptimizer({
  rutaId,
  distanciaOriginal = 0,
  tiempoOriginal = 0,
  onOptimized,
}: AdvancedOptimizerProps) {
  const { showToast } = useNotificationStore()
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [result, setResult] = useState<OptimizationResult | null>(null)

  // Objetivos
  const [minimizarDistancia, setMinimizarDistancia] = useState(true)
  const [minimizarTiempo, setMinimizarTiempo] = useState(true)
  const [minimizarCombustible, setMinimizarCombustible] = useState(false)
  const [respetarHorarios, setRespetarHorarios] = useState(false)

  // Restricciones
  const [capacidadVehiculo, setCapacidadVehiculo] = useState<number | undefined>()
  const [horarioInicio, setHorarioInicio] = useState('08:00')
  const [horarioFin, setHorarioFin] = useState('18:00')
  const [clientesUrgentes, setClientesUrgentes] = useState<string[]>([])

  const handleOptimize = async () => {
    setIsOptimizing(true)
    setResult(null)

    try {
      const response = await fetch('/api/rutas/optimize-advanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rutaId,
          options: {
            objetivos: {
              minimizarDistancia,
              minimizarTiempo,
              minimizarCombustible,
              respetarHorarios,
            },
            restricciones: {
              capacidadVehiculo,
              horarioRepartidor: respetarHorarios
                ? {
                    inicio: horarioInicio,
                    fin: horarioFin,
                  }
                : undefined,
              clientesUrgentes: clientesUrgentes.length > 0 ? clientesUrgentes : undefined,
            },
          },
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al optimizar ruta')
      }

      const optimizationResult: OptimizationResult = {
        success: true,
        ordenVisita: data.data.ordenVisita,
        distanciaTotalKm: data.data.distanciaTotalKm,
        duracionTotalMin: data.data.duracionTotalMin,
        optimizadaPor: data.data.optimizadaPor,
        metricas: data.data.metricas,
      }

      setResult(optimizationResult)
      onOptimized?.(optimizationResult)
      showToast('success', 'Ruta optimizada exitosamente')
    } catch (error: any) {
      console.error('Error al optimizar:', error)
      setResult({
        success: false,
        ordenVisita: [],
        distanciaTotalKm: 0,
        duracionTotalMin: 0,
        optimizadaPor: 'local',
        error: error.message || 'Error desconocido',
      })
      showToast('error', error.message || 'Error al optimizar ruta')
    } finally {
      setIsOptimizing(false)
    }
  }

  const handleApply = async () => {
    if (!result || !result.success) return

    try {
      // Aquí se aplicaría la optimización usando la función RPC
      // Por ahora solo mostramos un mensaje
      showToast('success', 'Optimización aplicada a la ruta')
      // TODO: Implementar aplicación de optimización
    } catch (error: any) {
      showToast('error', error.message || 'Error al aplicar optimización')
    }
  }

  return (
    <div className="space-y-6">
      {/* Configuración */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Optimización</CardTitle>
          <CardDescription>
            Configura los objetivos y restricciones para optimizar la ruta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Objetivos */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Objetivos</Label>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="min-distancia"
                  checked={minimizarDistancia}
                  onCheckedChange={(checked) => setMinimizarDistancia(!!checked)}
                />
                <Label htmlFor="min-distancia" className="flex items-center gap-2 cursor-pointer">
                  <TrendingDown className="h-4 w-4" />
                  Minimizar distancia
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="min-tiempo"
                  checked={minimizarTiempo}
                  onCheckedChange={(checked) => setMinimizarTiempo(!!checked)}
                />
                <Label htmlFor="min-tiempo" className="flex items-center gap-2 cursor-pointer">
                  <Clock className="h-4 w-4" />
                  Minimizar tiempo
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="min-combustible"
                  checked={minimizarCombustible}
                  onCheckedChange={(checked) => setMinimizarCombustible(!!checked)}
                />
                <Label htmlFor="min-combustible" className="flex items-center gap-2 cursor-pointer">
                  <Fuel className="h-4 w-4" />
                  Minimizar combustible
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="respetar-horarios"
                  checked={respetarHorarios}
                  onCheckedChange={(checked) => setRespetarHorarios(!!checked)}
                />
                <Label htmlFor="respetar-horarios" className="flex items-center gap-2 cursor-pointer">
                  <Clock className="h-4 w-4" />
                  Respetar horarios de clientes
                </Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Restricciones */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Restricciones</Label>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="capacidad">Capacidad del vehículo (kg)</Label>
                <Input
                  id="capacidad"
                  type="number"
                  placeholder="Ej: 1500"
                  value={capacidadVehiculo || ''}
                  onChange={(e) =>
                    setCapacidadVehiculo(e.target.value ? Number(e.target.value) : undefined)
                  }
                />
              </div>

              {respetarHorarios && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="horario-inicio">Horario inicio</Label>
                    <Input
                      id="horario-inicio"
                      type="time"
                      value={horarioInicio}
                      onChange={(e) => setHorarioInicio(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="horario-fin">Horario fin</Label>
                    <Input
                      id="horario-fin"
                      type="time"
                      value={horarioFin}
                      onChange={(e) => setHorarioFin(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <Button
            onClick={handleOptimize}
            disabled={isOptimizing}
            className="w-full"
            size="lg"
          >
            {isOptimizing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Optimizando...
              </>
            ) : (
              <>
                <MapPin className="mr-2 h-4 w-4" />
                Optimizar Ruta
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Resultados */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Optimización Completada
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  Error en Optimización
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.success && result.metricas ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">Distancia</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">
                        {result.distanciaTotalKm.toFixed(1)} km
                      </span>
                      {result.metricas.ahorroDistancia && result.metricas.ahorroDistancia > 0 && (
                        <Badge variant="default" className="text-xs bg-green-500 hover:bg-green-600 text-white">
                          -{result.metricas.ahorroDistancia.toFixed(1)}%
                        </Badge>
                      )}
                    </div>
                    {result.metricas.distanciaOriginal && (
                      <p className="text-xs text-muted-foreground">
                        Original: {result.metricas.distanciaOriginal.toFixed(1)} km
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground">Tiempo</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">
                        {result.duracionTotalMin} min
                      </span>
                      {result.metricas.ahorroTiempo && result.metricas.ahorroTiempo > 0 && (
                        <Badge variant="default" className="text-xs bg-green-500 hover:bg-green-600 text-white">
                          -{result.metricas.ahorroTiempo.toFixed(1)}%
                        </Badge>
                      )}
                    </div>
                    {result.metricas.tiempoOriginal && (
                      <p className="text-xs text-muted-foreground">
                        Original: {result.metricas.tiempoOriginal} min
                      </p>
                    )}
                  </div>
                </div>

                {result.metricas.ahorroCombustible && result.metricas.ahorroCombustible > 0 && (
                  <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-semibold text-green-900">
                          Ahorro estimado en combustible
                        </Label>
                        <p className="text-2xl font-bold text-green-700">
                          ${result.metricas.ahorroCombustible.toFixed(0)}
                        </p>
                      </div>
                      <Fuel className="h-8 w-8 text-green-600" />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    Optimizado por: {result.optimizadaPor}
                  </Badge>
                </div>

                <Button onClick={handleApply} className="w-full" size="lg">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Aplicar Optimización
                </Button>
              </>
            ) : (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm text-red-800">
                  {result.error || 'Error al optimizar la ruta'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

