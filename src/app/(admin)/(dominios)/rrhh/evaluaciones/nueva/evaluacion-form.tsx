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
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Loader2, Save, Star, User, Building } from 'lucide-react'
import Link from 'next/link'
import { evaluacionSchema, type EvaluacionFormData } from '@/lib/schemas/rrhh.schema'
import {
  crearEvaluacionAction,
  obtenerEmpleadosActivosAction,
  obtenerSucursalesActivasAction,
} from '@/actions/rrhh.actions'
import { MetricasSoportePanel } from '@/components/rrhh/MetricasSoportePanel'
import { useNotificationStore } from '@/store/notificationStore'
import type { Empleado, Sucursal } from '@/types/domain.types'

interface EvaluacionCriteria {
  name: keyof Pick<EvaluacionFormData, 'puntualidad' | 'rendimiento' | 'actitud' | 'responsabilidad' | 'trabajo_equipo'>
  label: string
  description: string
  icon: string
}

const criteriosEvaluacion: EvaluacionCriteria[] = [
  {
    name: 'puntualidad',
    label: 'Puntualidad',
    description: 'Asistencia oportuna y cumplimiento de horarios laborales',
    icon: '⏰'
  },
  {
    name: 'rendimiento',
    label: 'Rendimiento',
    description: 'Productividad y calidad en el cumplimiento de tareas asignadas',
    icon: '📈'
  },
  {
    name: 'actitud',
    label: 'Actitud',
    description: 'Comportamiento laboral y disposición para el trabajo en equipo',
    icon: '😊'
  },
  {
    name: 'responsabilidad',
    label: 'Responsabilidad',
    description: 'Compromiso con las tareas y cuidado de recursos asignados',
    icon: '🎯'
  },
  {
    name: 'trabajo_equipo',
    label: 'Trabajo en Equipo',
    description: 'Colaboración y contribución al ambiente laboral positivo',
    icon: '🤝'
  }
]

export function NuevaEvaluacionForm() {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(false)
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [promedioCalculado, setPromedioCalculado] = useState<number>(0)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EvaluacionFormData>({
    resolver: zodResolver(evaluacionSchema),
    defaultValues: {
      estado: 'borrador',
    },
  })

  // Calcular promedio automáticamente
  useEffect(() => {
    const puntuaciones = criteriosEvaluacion.map(criterio => watch(criterio.name))
    const validas = puntuaciones.filter(p => p !== undefined && p !== null)
    const promedio = validas.length > 0 ? validas.reduce((sum, p) => sum + p, 0) / validas.length : 0
    setPromedioCalculado(Number(promedio.toFixed(1)))
  }, criteriosEvaluacion.map(c => watch(c.name)))

  // Cargar datos de referencia
  useEffect(() => {
    const loadReferenceData = async () => {
      const [empleadosResult, sucursalesResult] = await Promise.all([
        obtenerEmpleadosActivosAction(),
        obtenerSucursalesActivasAction(),
      ])

      if (empleadosResult.success) {
        setEmpleados((empleadosResult.data || []) as Empleado[])
      } else {
        showToast('error', empleadosResult.error || 'No se pudieron cargar empleados', 'Error')
      }

      if (sucursalesResult.success) {
        setSucursales((sucursalesResult.data || []) as Sucursal[])
      } else {
        showToast('error', sucursalesResult.error || 'No se pudieron cargar sucursales', 'Error')
      }
    }

    void loadReferenceData()
  }, [showToast])

  const onSubmit = async (data: EvaluacionFormData) => {
    try {
      setIsLoading(true)

      const result = await crearEvaluacionAction(data)

      if (result.success) {
        showToast(
          'success',
          result.message || 'La evaluación ha sido creada exitosamente',
          'Evaluación creada'
        )
        router.push('/rrhh/evaluaciones')
      } else {
        showToast(
          'error',
          result.error || 'Ha ocurrido un error inesperado',
          'Error al crear evaluación'
        )
      }
    } catch (error) {
      console.error('Error en onSubmit:', error)
      showToast(
        'error',
        'Ha ocurrido un error inesperado al crear la evaluación',
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

  const anios = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - 1 + i)

  const empleadoSeleccionado = empleados.find(e => e.id === watch('empleado_id'))

  return (
    <div className="max-w-4xl mx-auto">
      {/* Botón volver */}
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/rrhh/evaluaciones">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Evaluaciones
          </Link>
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Información básica */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Información de la Evaluación
            </CardTitle>
            <CardDescription>
              Selecciona el empleado, período y sucursal para la evaluación
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Empleado */}
              <div className="space-y-2">
                <Label htmlFor="empleado_id">Empleado a Evaluar *</Label>
                <Select
                  value={watch('empleado_id') || ''}
                  onValueChange={(value) => setValue('empleado_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar empleado" />
                  </SelectTrigger>
                  <SelectContent>
                    {empleados.map((empleado) => {
                      const nombre = empleado.usuario?.nombre || empleado.nombre || ''
                      const apellido = empleado.usuario?.apellido || empleado.apellido || ''
                      const nombreCompleto = `${apellido} ${nombre}`.trim() || 'Sin nombre'
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

              {/* Sucursal */}
              <div className="space-y-2">
                <Label htmlFor="sucursal_id">Sucursal *</Label>
                <Select
                  value={watch('sucursal_id') || ''}
                  onValueChange={(value) => setValue('sucursal_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    {sucursales.map((sucursal) => (
                      <SelectItem key={sucursal.id} value={sucursal.id}>
                        {sucursal.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.sucursal_id && (
                  <p className="text-sm text-red-600">{errors.sucursal_id.message}</p>
                )}
              </div>

              {/* Período - Mes */}
              <div className="space-y-2">
                <Label htmlFor="periodo_mes">Mes del Período *</Label>
                <Select
                  value={watch('periodo_mes')?.toString() || ''}
                  onValueChange={(value) => setValue('periodo_mes', parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar mes" />
                  </SelectTrigger>
                  <SelectContent>
                    {meses.map((mes) => (
                      <SelectItem key={mes.value} value={mes.value.toString()}>
                        {mes.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.periodo_mes && (
                  <p className="text-sm text-red-600">{errors.periodo_mes.message}</p>
                )}
              </div>

              {/* Período - Año */}
              <div className="space-y-2">
                <Label htmlFor="periodo_anio">Año del Período *</Label>
                <Select
                  value={watch('periodo_anio')?.toString() || ''}
                  onValueChange={(value) => setValue('periodo_anio', parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar año" />
                  </SelectTrigger>
                  <SelectContent>
                    {anios.map((anio) => (
                      <SelectItem key={anio} value={anio.toString()}>
                        {anio}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.periodo_anio && (
                  <p className="text-sm text-red-600">{errors.periodo_anio.message}</p>
                )}
              </div>

              {/* Fecha de evaluación */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="fecha_evaluacion">Fecha de Evaluación *</Label>
                <Input
                  id="fecha_evaluacion"
                  type="date"
                  {...register('fecha_evaluacion')}
                />
                {errors.fecha_evaluacion && (
                  <p className="text-sm text-red-600">{errors.fecha_evaluacion.message}</p>
                )}
              </div>
            </div>

            {/* Información del empleado seleccionado */}
            {empleadoSeleccionado && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Building className="w-5 h-5 text-blue-600" />
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
                    <span className="font-medium">Categoría:</span> {empleadoSeleccionado.categoria?.nombre || 'Sin asignar'}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Panel de Soporte de Decisión — Huella Digital Operativa */}
        <MetricasSoportePanel
          empleadoId={watch('empleado_id')}
          mes={watch('periodo_mes')}
          anio={watch('periodo_anio')}
        />

        {/* Criterios de evaluación */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-600" />
              Criterios de Evaluación
            </CardTitle>
            <CardDescription>
              Evalúa cada criterio en una escala del 1 al 5 (1 = Deficiente, 5 = Excelente)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {criteriosEvaluacion.map((criterio) => (
              <div key={criterio.name} className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{criterio.icon}</span>
                  <div>
                    <Label className="text-base font-semibold">{criterio.label}</Label>
                    <p className="text-sm text-muted-foreground">{criterio.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Slider
                    value={[watch(criterio.name) || 3]}
                    onValueChange={(value) => setValue(criterio.name, value[0])}
                    max={5}
                    min={1}
                    step={1}
                    className="flex-1"
                  />
                  <div className="flex items-center gap-2 min-w-[120px]">
                    <Badge variant="outline" className="px-3 py-1">
                      {watch(criterio.name) || 3}/5
                    </Badge>
                    <div className="flex">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${i < (watch(criterio.name) || 3)
                            ? 'text-yellow-400 fill-current'
                            : 'text-gray-300'
                            }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Promedio calculado */}
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-yellow-900">Promedio General:</span>
                  <p className="text-sm text-yellow-700">Promedio automático de todos los criterios</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        className={`w-5 h-5 ${i < Math.round(promedioCalculado)
                          ? 'text-yellow-400 fill-current'
                          : 'text-gray-300'
                          }`}
                      />
                    ))}
                  </div>
                  <Badge variant="outline" className="px-4 py-2 text-lg font-bold bg-white">
                    {promedioCalculado.toFixed(1)}/5.0
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comentarios y observaciones */}
        <Card>
          <CardHeader>
            <CardTitle>Comentarios y Observaciones</CardTitle>
            <CardDescription>
              Comentarios constructivos sobre fortalezas, áreas de mejora y objetivos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fortalezas">Fortalezas</Label>
              <Textarea
                id="fortalezas"
                placeholder="Aspectos positivos destacados en la evaluación..."
                {...register('fortalezas')}
                rows={3}
              />
              {errors.fortalezas && (
                <p className="text-sm text-red-600">{errors.fortalezas.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="areas_mejora">Áreas de Mejora</Label>
              <Textarea
                id="areas_mejora"
                placeholder="Aspectos que pueden mejorarse y cómo..."
                {...register('areas_mejora')}
                rows={3}
              />
              {errors.areas_mejora && (
                <p className="text-sm text-red-600">{errors.areas_mejora.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="objetivos">Objetivos</Label>
              <Textarea
                id="objetivos"
                placeholder="Objetivos específicos para el próximo período..."
                {...register('objetivos')}
                rows={3}
              />
              {errors.objetivos && (
                <p className="text-sm text-red-600">{errors.objetivos.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="comentarios">Comentarios Adicionales</Label>
              <Textarea
                id="comentarios"
                placeholder="Comentarios generales sobre la evaluación..."
                {...register('comentarios')}
                rows={3}
              />
              {errors.comentarios && (
                <p className="text-sm text-red-600">{errors.comentarios.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

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
                Crear Evaluación
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
