'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertCircle, Calculator, Loader2, Users } from 'lucide-react'
import { calcularLiquidacionConAjustesAction } from '@/actions/rrhh.actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useNotificationStore } from '@/store/notificationStore'
import type { Empleado } from '@/types/domain.types'

interface EmpleadoSeleccionado extends Empleado {
  selected: boolean
  ajuste_manual: {
    horas_adicionales: number
    turno_especial_unidades: number
    observaciones: string
  }
}

interface CalcularLiquidacionesFormProps {
  initialEmpleados: Empleado[]
}

type ProgressState = {
  actual: number
  total: number
  nombreActual: string
} | null

function toPositiveNumber(value: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return parsed
}

export function CalcularLiquidacionesForm({ initialEmpleados }: CalcularLiquidacionesFormProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()

  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState<ProgressState>(null)
  const [empleados, setEmpleados] = useState<EmpleadoSeleccionado[]>(
    () =>
      initialEmpleados.map((emp) => ({
        ...emp,
        selected: false,
        ajuste_manual: {
          horas_adicionales: 0,
          turno_especial_unidades: 0,
          observaciones: '',
        },
      })),
  )
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [selectAll, setSelectAll] = useState(false)

  const empleadosSeleccionados = empleados.filter((emp) => emp.selected)

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked)
    setEmpleados((prev) => prev.map((emp) => ({ ...emp, selected: checked })))
  }

  const handleSelectEmpleado = (empleadoId: string, checked: boolean) => {
    setEmpleados((prev) => {
      const next = prev.map((emp) =>
        emp.id === empleadoId ? { ...emp, selected: checked } : emp,
      )
      setSelectAll(next.every((emp) => emp.selected))
      return next
    })
  }

  const handleAjusteManual = (
    empleadoId: string,
    field: 'horas_adicionales' | 'turno_especial_unidades' | 'observaciones',
    value: string,
  ) => {
    setEmpleados((prev) =>
      prev.map((emp) => {
        if (emp.id !== empleadoId) return emp

        if (field === 'observaciones') {
          return {
            ...emp,
            ajuste_manual: { ...emp.ajuste_manual, observaciones: value },
          }
        }

        return {
          ...emp,
          ajuste_manual: {
            ...emp.ajuste_manual,
            [field]: toPositiveNumber(value),
          },
        }
      }),
    )
  }

  const getNombreEmpleado = (empleado: EmpleadoSeleccionado) => {
    const nombreUsuario = `${empleado.usuario?.nombre || ''} ${empleado.usuario?.apellido || ''}`.trim()
    const nombreEmpleado = `${empleado.nombre || ''} ${empleado.apellido || ''}`.trim()
    return (
      nombreUsuario ||
      nombreEmpleado ||
      empleado.usuario?.email ||
      (empleado.legajo ? `Empleado ${empleado.legajo}` : 'Sin nombre')
    )
  }

  const handleCalcular = async () => {
    if (empleadosSeleccionados.length === 0) {
      showToast('error', 'Debe seleccionar al menos un empleado', 'Error de validacion')
      return
    }

    try {
      setIsLoading(true)
      let successCount = 0
      let errorCount = 0
      const liquidacionIds: string[] = []

      for (let i = 0; i < empleadosSeleccionados.length; i++) {
        const empleado = empleadosSeleccionados[i]
        const nombreCompleto = getNombreEmpleado(empleado)

        // MM-4: Actualizar progreso por empleado
        setProgress({
          actual: i + 1,
          total: empleadosSeleccionados.length,
          nombreActual: nombreCompleto,
        })

        try {
          const result = await calcularLiquidacionConAjustesAction(
            empleado.id,
            mes,
            anio,
            empleado.ajuste_manual,
          )

          if (result.success && result.data?.liquidacionId) {
            successCount++
            liquidacionIds.push(result.data.liquidacionId)
          } else {
            errorCount++
          }
        } catch {
          errorCount++
        }
      }

      setProgress(null)

      if (successCount > 0) {
        showToast(
          'success',
          `Se calcularon ${successCount} liquidaciones exitosamente${errorCount > 0 ? ` (${errorCount} errores)` : ''}`,
          'Calculo completado',
        )

        if (successCount === 1 && liquidacionIds.length === 1) {
          router.push(`/rrhh/liquidaciones/${liquidacionIds[0]}`)
        } else {
          router.push('/rrhh/liquidaciones')
        }

        router.refresh()
      } else {
        showToast('error', 'No se pudo calcular ninguna liquidacion', 'Error en el calculo')
      }
    } catch {
      setProgress(null)
      showToast('error', 'Ha ocurrido un error inesperado al calcular las liquidaciones', 'Error inesperado')
    } finally {
      setIsLoading(false)
    }
  }

  const meses = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' },
  ]
  const anios = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i)

  const progressPct = progress ? Math.round((progress.actual / progress.total) * 100) : 0

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/rrhh/liquidaciones">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Liquidaciones
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                Periodo de Liquidacion
              </CardTitle>
              <CardDescription>
                Selecciona el mes y año para calcular las liquidaciones
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Mes</label>
                <Select value={mes.toString()} onValueChange={(value) => setMes(Number(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meses.map((item) => (
                      <SelectItem key={item.value} value={item.value.toString()}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Año</label>
                <Select value={anio.toString()} onValueChange={(value) => setAnio(Number(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {anios.map((item) => (
                      <SelectItem key={item} value={item.toString()}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Empleados seleccionados:</span>
                  <Badge variant="secondary">{empleadosSeleccionados.length}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-green-600" />
                Calcular Liquidaciones
              </CardTitle>
              <CardDescription>
                Se calcularán las liquidaciones para{' '}
                {meses.find((m) => m.value === mes)?.label} {anio}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {empleadosSeleccionados.length === 0 && (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0" />
                  <span className="text-sm text-yellow-800">
                    Selecciona al menos un empleado para continuar
                  </span>
                </div>
              )}

              {/* MM-4: Barra de progreso durante el cálculo */}
              {progress && (
                <div className="space-y-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex justify-between text-sm text-blue-800">
                    <span className="font-medium">
                      Calculando {progress.actual} de {progress.total}
                    </span>
                    <span className="font-semibold">{progressPct}%</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-blue-700 truncate">{progress.nombreActual}</p>
                </div>
              )}

              <Button
                onClick={handleCalcular}
                disabled={isLoading || empleadosSeleccionados.length === 0}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Calculando...
                  </>
                ) : (
                  <>
                    <Calculator className="w-4 h-4 mr-2" />
                    Calcular {empleadosSeleccionados.length} Liquidaciones
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    Empleados Activos
                  </CardTitle>
                  <CardDescription>
                    Selecciona los empleados para calcular sus liquidaciones
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="select-all" checked={selectAll} onCheckedChange={handleSelectAll} />
                  <label htmlFor="select-all" className="text-sm font-medium">
                    Seleccionar todos
                  </label>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[38rem] overflow-y-auto pr-1">
                {empleados.map((empleado) => {
                  const nombreCompleto = getNombreEmpleado(empleado)

                  return (
                    <div
                      key={empleado.id}
                      className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={empleado.selected}
                            onCheckedChange={(checked) =>
                              handleSelectEmpleado(empleado.id, checked as boolean)
                            }
                          />
                          <div>
                            <div className="font-medium">{nombreCompleto}</div>
                            <div className="text-sm text-muted-foreground">
                              Legajo: {empleado.legajo || 'Sin asignar'} — Sucursal:{' '}
                              {empleado.sucursal?.nombre || 'Sin asignar'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-green-600">
                            $
                            {empleado.sueldo_actual?.toLocaleString() ||
                              empleado.categoria?.sueldo_basico.toLocaleString() ||
                              '0'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {empleado.categoria?.nombre || 'Sin categoria'}
                          </div>
                        </div>
                      </div>

                      {empleado.selected && (
                        <div className="mt-3 rounded-md border bg-white p-3 space-y-3">
                          <div className="text-xs font-medium text-muted-foreground">
                            Ajuste manual opcional RRHH
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-xs">Horas adicionales manuales</label>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={empleado.ajuste_manual.horas_adicionales}
                                onChange={(e) =>
                                  handleAjusteManual(empleado.id, 'horas_adicionales', e.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs">Turnos especiales manuales</label>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={empleado.ajuste_manual.turno_especial_unidades}
                                onChange={(e) =>
                                  handleAjusteManual(
                                    empleado.id,
                                    'turno_especial_unidades',
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs">Observaciones del ajuste</label>
                            <Textarea
                              rows={2}
                              value={empleado.ajuste_manual.observaciones}
                              onChange={(e) =>
                                handleAjusteManual(empleado.id, 'observaciones', e.target.value)
                              }
                              placeholder="Opcional: motivo o detalle del ajuste manual"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                {empleados.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay empleados activos para mostrar
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
