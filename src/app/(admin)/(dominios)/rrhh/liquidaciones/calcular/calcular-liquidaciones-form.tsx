'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Calculator, Loader2, Users, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { calcularLiquidacionMensual } from '@/actions/rrhh.actions'
import { useNotificationStore } from '@/store/notificationStore'
import { createClient } from '@/lib/supabase/client'
import type { Empleado } from '@/types/domain.types'

interface EmpleadoSeleccionado extends Empleado {
  selected: boolean
}

export function CalcularLiquidacionesForm() {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(false)
  const [empleados, setEmpleados] = useState<EmpleadoSeleccionado[]>([])
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [selectAll, setSelectAll] = useState(false)

  // Cargar empleados activos
  useEffect(() => {
    const loadEmpleados = async () => {
      const supabase = createClient()

      const { data, error } = await supabase
        .from('rrhh_empleados')
        .select(`
          *,
          usuario:usuarios(id, nombre, apellido, email),
          sucursal:sucursales(id, nombre),
          categoria:rrhh_categorias(id, nombre, sueldo_basico)
        `)
        .eq('activo', true)
        .order('created_at')

      if (data) {
        setEmpleados(data.map(emp => ({ ...emp, selected: false })))
      }
    }

    loadEmpleados()
  }, [])

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked)
    setEmpleados(prev => prev.map(emp => ({ ...emp, selected: checked })))
  }

  const handleSelectEmpleado = (empleadoId: string, checked: boolean) => {
    setEmpleados(prev => prev.map(emp =>
      emp.id === empleadoId ? { ...emp, selected: checked } : emp
    ))
    // Verificar si todos están seleccionados
    const updatedEmpleados = empleados.map(emp =>
      emp.id === empleadoId ? { ...emp, selected: checked } : emp
    )
    setSelectAll(updatedEmpleados.every(emp => emp.selected))
  }

  const empleadosSeleccionados = empleados.filter(emp => emp.selected)

  const handleCalcular = async () => {
    if (empleadosSeleccionados.length === 0) {
      showToast(
        'error',
        'Debe seleccionar al menos un empleado',
        'Error de validación'
      )
      return
    }

    try {
      setIsLoading(true)
      let successCount = 0
      let errorCount = 0

      for (const empleado of empleadosSeleccionados) {
        try {
          const result = await calcularLiquidacionMensual(empleado.id, mes, anio)
          if (result.success) {
            successCount++
          } else {
            errorCount++
            console.error(`Error calculando liquidación para ${empleado.usuario?.nombre}:`, result.error)
          }
        } catch (error) {
          errorCount++
          console.error(`Error procesando empleado ${empleado.id}:`, error)
        }
      }

      if (successCount > 0) {
        showToast(
          'success',
          `Se calcularon ${successCount} liquidaciones exitosamente${errorCount > 0 ? ` (${errorCount} errores)` : ''}`,
          'Cálculo completado'
        )
        router.push('/rrhh/liquidaciones')
      } else {
        showToast(
          'error',
          'No se pudo calcular ninguna liquidación',
          'Error en el cálculo'
        )
      }
    } catch (error) {
      console.error('Error en handleCalcular:', error)
      showToast(
        'error',
        'Ha ocurrido un error inesperado al calcular las liquidaciones',
        'Error inesperado'
      )
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

  return (
    <div className="max-w-6xl mx-auto">
      {/* Botón volver */}
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/rrhh/liquidaciones">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Liquidaciones
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel de configuración */}
        <div className="lg:col-span-1 space-y-6">
          {/* Período */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                Período de Liquidación
              </CardTitle>
              <CardDescription>
                Selecciona el mes y año para calcular las liquidaciones
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Mes</label>
                <Select value={mes.toString()} onValueChange={(value) => setMes(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meses.map((mes) => (
                      <SelectItem key={mes.value} value={mes.value.toString()}>
                        {mes.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Año</label>
                <Select value={anio.toString()} onValueChange={(value) => setAnio(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {anios.map((anio) => (
                      <SelectItem key={anio} value={anio.toString()}>
                        {anio}
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

          {/* Resumen y acción */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-green-600" />
                Calcular Liquidaciones
              </CardTitle>
              <CardDescription>
                Se calcularán las liquidaciones para el período {meses.find(m => m.value === mes)?.label} {anio}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {empleadosSeleccionados.length === 0 && (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm text-yellow-800">
                    Selecciona al menos un empleado para continuar
                  </span>
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

        {/* Lista de empleados */}
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
                  <Checkbox
                    id="select-all"
                    checked={selectAll}
                    onCheckedChange={handleSelectAll}
                  />
                  <label htmlFor="select-all" className="text-sm font-medium">
                    Seleccionar todos
                  </label>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {empleados.map((empleado) => {
                  const nombre = empleado.usuario?.nombre || ''
                  const apellido = empleado.usuario?.apellido || ''
                  const nombreCompleto = `${nombre} ${apellido}`.trim()

                  return (
                    <div
                      key={empleado.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={empleado.selected}
                          onCheckedChange={(checked) => handleSelectEmpleado(empleado.id, checked as boolean)}
                        />
                        <div>
                          <div className="font-medium">
                            {nombreCompleto || 'Sin nombre'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Legajo: {empleado.legajo || 'Sin asignar'} •
                            Sucursal: {empleado.sucursal?.nombre || 'Sin asignar'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-green-600">
                          ${empleado.sueldo_actual?.toLocaleString() || empleado.categoria?.sueldo_basico.toLocaleString() || '0'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {empleado.categoria?.nombre || 'Sin categoría'}
                        </div>
                      </div>
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
