'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CalendarDays, Calculator, Users, ArrowLeft, Loader2, Save } from 'lucide-react'
import Link from 'next/link'
import { licenciaSchema, type LicenciaFormData } from '@/lib/schemas/rrhh.schema'
import { crearLicenciaAction } from '@/actions/rrhh.actions'
import { useNotificationStore } from '@/store/notificationStore'
import { createClient } from '@/lib/supabase/client'
import type { Empleado } from '@/types/domain.types'

export function NuevaLicenciaForm() {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(false)
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [diasCalculados, setDiasCalculados] = useState<number>(0)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<LicenciaFormData>({
    resolver: zodResolver(licenciaSchema),
  })

  const fechaInicio = watch('fecha_inicio')
  const fechaFin = watch('fecha_fin')

  // Calcular días automáticamente
  useEffect(() => {
    if (fechaInicio && fechaFin) {
      const inicio = new Date(fechaInicio)
      const fin = new Date(fechaFin)
      const dias = Math.ceil((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1
      setDiasCalculados(dias > 0 ? dias : 0)
    } else {
      setDiasCalculados(0)
    }
  }, [fechaInicio, fechaFin])

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
          categoria:rrhh_categorias(id, nombre)
        `)
        .eq('activo', true)
        .order('created_at')

      if (data) {
        setEmpleados(data)
      }
    }

    loadEmpleados()
  }, [])

  const onSubmit = async (data: LicenciaFormData) => {
    try {
      setIsLoading(true)

      const result = await crearLicenciaAction(data)

      if (result.success) {
        showToast(
          'success',
          result.message || 'La solicitud de licencia ha sido creada exitosamente',
          'Licencia creada'
        )
        router.push('/rrhh/licencias')
      } else {
        showToast(
          'error',
          result.error || 'Ha ocurrido un error inesperado',
          'Error al crear licencia'
        )
      }
    } catch (error) {
      console.error('Error en onSubmit:', error)
      showToast(
        'error',
        'Ha ocurrido un error inesperado al crear la licencia',
        'Error inesperado'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const empleadoSeleccionado = empleados.find(e => e.id === watch('empleado_id'))

  const tiposLicencia = [
    { value: 'vacaciones', label: 'Vacaciones', icon: '🏖️', description: 'Período de descanso anual' },
    { value: 'enfermedad', label: 'Enfermedad', icon: '🏥', description: 'Licencia por enfermedad' },
    { value: 'maternidad', label: 'Maternidad', icon: '👶', description: 'Licencia por maternidad/paternidad' },
    { value: 'estudio', label: 'Estudio', icon: '📚', description: 'Licencia por estudios' },
    { value: 'otro', label: 'Otro', icon: '📋', description: 'Otro tipo de licencia' },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      {/* Botón volver */}
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/rrhh/licencias">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Licencias
          </Link>
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Información básica */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Información de la Licencia
            </CardTitle>
            <CardDescription>
              Detalles del empleado y tipo de licencia solicitada
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="empleado_id">Empleado *</Label>
              <Select
                value={watch('empleado_id') || ''}
                onValueChange={(value) => setValue('empleado_id', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar empleado" />
                </SelectTrigger>
                <SelectContent>
                  {empleados.map((empleado) => {
                    const nombre = empleado.usuario?.nombre || ''
                    const apellido = empleado.usuario?.apellido || ''
                    const nombreCompleto = `${nombre} ${apellido}`.trim()
                    return (
                      <SelectItem key={empleado.id} value={empleado.id}>
                        {nombreCompleto} - {empleado.legajo || 'Sin legajo'} ({empleado.sucursal?.nombre})
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {errors.empleado_id && (
                <p className="text-sm text-red-600">{errors.empleado_id.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Licencia *</Label>
              <Select
                value={watch('tipo') || ''}
                onValueChange={(value) => setValue('tipo', value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo de licencia" />
                </SelectTrigger>
                <SelectContent>
                  {tiposLicencia.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{tipo.icon}</span>
                        <div>
                          <div className="font-medium">{tipo.label}</div>
                          <div className="text-xs text-muted-foreground">{tipo.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.tipo && (
                <p className="text-sm text-red-600">{errors.tipo.message}</p>
              )}
            </div>

            {/* Información del empleado seleccionado */}
            {empleadoSeleccionado && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-blue-900">Empleado Seleccionado</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Nombre:</span> {empleadoSeleccionado.usuario?.nombre} {empleadoSeleccionado.usuario?.apellido}
                  </div>
                  <div>
                    <span className="font-medium">Legajo:</span> {empleadoSeleccionado.legajo || 'Sin asignar'}
                  </div>
                  <div>
                    <span className="font-medium">Sucursal:</span> {empleadoSeleccionado.sucursal?.nombre || 'Sin asignar'}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fechas y duración */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-green-600" />
              Fechas y Duración
            </CardTitle>
            <CardDescription>
              Período de la licencia y cálculo automático de días
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fecha_inicio">Fecha de Inicio *</Label>
                <Input
                  id="fecha_inicio"
                  type="date"
                  {...register('fecha_inicio')}
                />
                {errors.fecha_inicio && (
                  <p className="text-sm text-red-600">{errors.fecha_inicio.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fecha_fin">Fecha de Fin *</Label>
                <Input
                  id="fecha_fin"
                  type="date"
                  {...register('fecha_fin')}
                />
                {errors.fecha_fin && (
                  <p className="text-sm text-red-600">{errors.fecha_fin.message}</p>
                )}
              </div>
            </div>

            {/* Cálculo de días */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-900">Cálculo de Días</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">{diasCalculados}</div>
                  <div className="text-sm text-green-700">día{diasCalculados !== 1 ? 's' : ''} hábiles</div>
                </div>
              </div>
              {fechaInicio && fechaFin && (
                <div className="mt-2 text-sm text-green-700">
                  Desde {new Date(fechaInicio).toLocaleDateString()} hasta {new Date(fechaFin).toLocaleDateString()}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                placeholder="Motivo detallado de la licencia..."
                rows={3}
                {...register('observaciones')}
              />
              {errors.observaciones && (
                <p className="text-sm text-red-600">{errors.observaciones.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Información importante */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="p-1 bg-yellow-100 rounded-lg">
              <CalendarDays className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <h3 className="font-semibold text-yellow-900">Importante</h3>
              <p className="text-yellow-700 text-sm mt-1">
                La licencia será creada en estado "Pendiente de aprobación". Un supervisor debe aprobarla
                antes de que sea efectiva. Durante el período de licencia, el empleado no generará
                registros de asistencia y podrá afectar cálculos de presentismo.
              </p>
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Crear Licencia
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
