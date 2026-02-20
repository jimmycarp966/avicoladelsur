'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Clock, User, Loader2, Save, AlertTriangle, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { asistenciaSchema, type AsistenciaFormData } from '@/lib/schemas/rrhh.schema'
import { marcarAsistenciaAction, obtenerEmpleadosActivosAction } from '@/actions/rrhh.actions'
import { useNotificationStore } from '@/store/notificationStore'
import type { Empleado } from '@/types/domain.types'

export function MarcarAsistenciaForm() {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(false)
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [retrasoCalculado, setRetrasoCalculado] = useState<number>(0)
  const [faltaSinAviso, setFaltaSinAviso] = useState<boolean>(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AsistenciaFormData>({
    resolver: zodResolver(asistenciaSchema),
    defaultValues: {
      fecha: new Date().toISOString().split('T')[0],
      estado: 'presente',
    },
  })

  const empleadoId = watch('empleado_id')
  const horaEntrada = watch('hora_entrada')
  const turno = watch('turno')
  const fecha = watch('fecha')

  // Cargar empleados activos
  useEffect(() => {
    const loadEmpleados = async () => {
      const result = await obtenerEmpleadosActivosAction()
      if (result.success) {
        setEmpleados((result.data || []) as Empleado[])
      } else {
        showToast('error', result.error || 'No se pudieron cargar empleados', 'Error')
      }
    }

    void loadEmpleados()
  }, [showToast])

  // Calcular retraso automáticamente
  useEffect(() => {
    if (horaEntrada && turno && fecha) {
      const horaEntradaDate = new Date(`${fecha}T${horaEntrada}`)
      const horaLimite = getHoraLimite(turno)
      const retrasoMs = horaEntradaDate.getTime() - horaLimite.getTime()
      const retrasoMin = Math.max(0, Math.round(retrasoMs / (1000 * 60)))

      setRetrasoCalculado(retrasoMin)
      setFaltaSinAviso(retrasoMin > 15)
    }
  }, [horaEntrada, turno, fecha, setValue])

  const getHoraLimite = (turno: string): Date => {
    const fechaBase = new Date(fecha)
    switch (turno) {
      case 'mañana':
        fechaBase.setHours(9, 0, 0, 0) // 9:00 AM
        break
      case 'tarde':
        fechaBase.setHours(15, 0, 0, 0) // 3:00 PM
        break
      case 'noche':
        fechaBase.setHours(21, 0, 0, 0) // 9:00 PM
        break
      default:
        fechaBase.setHours(9, 0, 0, 0)
    }
    return fechaBase
  }

  const empleadoSeleccionado = empleados.find(e => e.id === empleadoId)

  const onSubmit = async (data: AsistenciaFormData) => {
    try {
      setIsLoading(true)

      const result = await marcarAsistenciaAction(data)

      if (result.success) {
        showToast(
          'success',
          result.message || 'La asistencia ha sido registrada exitosamente',
          'Asistencia registrada'
        )
        router.push('/rrhh/asistencia')
      } else {
        showToast(
          'error',
          result.error || 'Ha ocurrido un error inesperado',
          'Error al registrar asistencia'
        )
      }
    } catch (error) {
      console.error('Error en onSubmit:', error)
      showToast(
        'error',
        'Ha ocurrido un error inesperado al registrar la asistencia',
        'Error inesperado'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const getRetrasoBadge = () => {
    if (faltaSinAviso) {
      return <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200"><AlertTriangle className="w-3 h-3 mr-1" />Falta Sin Aviso</Badge>
    }
    if (retrasoCalculado > 0) {
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" />Retraso: {retrasoCalculado} min</Badge>
    }
    return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Puntual</Badge>
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Botón volver */}
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/rrhh/asistencia">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Asistencia
          </Link>
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Información básica */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Registro de Asistencia
            </CardTitle>
            <CardDescription>
              Selecciona el empleado y registra su entrada/salida
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Empleado */}
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

              {/* Fecha */}
              <div className="space-y-2">
                <Label htmlFor="fecha">Fecha *</Label>
                <Input
                  id="fecha"
                  type="date"
                  {...register('fecha')}
                />
                {errors.fecha && (
                  <p className="text-sm text-red-600">{errors.fecha.message}</p>
                )}
              </div>

              {/* Turno */}
              <div className="space-y-2">
                <Label htmlFor="turno">Turno</Label>
                <Select
                  value={watch('turno') || ''}
                  onValueChange={(value) => setValue('turno', value as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar turno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mañana">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🌅</span>
                        <div>
                          <div className="font-medium">Mañana</div>
                          <div className="text-xs text-muted-foreground">Hasta 15:00</div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="tarde">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🌇</span>
                        <div>
                          <div className="font-medium">Tarde</div>
                          <div className="text-xs text-muted-foreground">Desde 15:00</div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="noche">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🌙</span>
                        <div>
                          <div className="font-medium">Noche</div>
                          <div className="text-xs text-muted-foreground">Desde 21:00</div>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {errors.turno && (
                  <p className="text-sm text-red-600">{errors.turno.message}</p>
                )}
              </div>

              {/* Estado */}
              <div className="space-y-2">
                <Label htmlFor="estado">Estado *</Label>
                <Select
                  value={watch('estado') || 'presente'}
                  onValueChange={(value) => setValue('estado', value as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="presente">Presente</SelectItem>
                    <SelectItem value="ausente">Ausente</SelectItem>
                    <SelectItem value="licencia">Licencia</SelectItem>
                    <SelectItem value="tarde">Tarde</SelectItem>
                  </SelectContent>
                </Select>
                {errors.estado && (
                  <p className="text-sm text-red-600">{errors.estado.message}</p>
                )}
              </div>
            </div>

            {/* Información del empleado seleccionado */}
            {empleadoSeleccionado && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-blue-600" />
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

        {/* Registro de horas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-green-600" />
              Registro de Horas
            </CardTitle>
            <CardDescription>
              Hora de entrada/salida y cálculo automático de retrasos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Hora de entrada */}
              <div className="space-y-2">
                <Label htmlFor="hora_entrada">Hora de Entrada</Label>
                <Input
                  id="hora_entrada"
                  type="time"
                  {...register('hora_entrada')}
                />
                {errors.hora_entrada && (
                  <p className="text-sm text-red-600">{errors.hora_entrada.message}</p>
                )}
              </div>

              {/* Hora de salida */}
              <div className="space-y-2">
                <Label htmlFor="hora_salida">Hora de Salida</Label>
                <Input
                  id="hora_salida"
                  type="time"
                  {...register('hora_salida')}
                />
                {errors.hora_salida && (
                  <p className="text-sm text-red-600">{errors.hora_salida.message}</p>
                )}
              </div>
            </div>

            {/* Cálculo de retraso */}
            {horaEntrada && turno && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-yellow-600" />
                    <span className="font-medium text-yellow-900">Análisis de Puntualidad</span>
                  </div>
                  <div>
                    {getRetrasoBadge()}
                  </div>
                </div>
                <div className="mt-2 text-sm text-yellow-700">
                  <div>Hora límite para {turno}: {getHoraLimite(turno).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
                  {faltaSinAviso && (
                    <div className="mt-1 font-medium text-red-700">
                      ⚠️ Una sola falta sin aviso implica pérdida de presentismo y jornal completo
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Observaciones */}
            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                placeholder="Observaciones adicionales sobre la asistencia..."
                rows={3}
                {...register('observaciones')}
              />
              {errors.observaciones && (
                <p className="text-sm text-red-600">{errors.observaciones.message}</p>
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
                Registrando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Registrar Asistencia
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
