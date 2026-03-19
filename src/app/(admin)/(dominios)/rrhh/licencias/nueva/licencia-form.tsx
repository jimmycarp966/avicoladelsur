'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  CalendarDays,
  Calculator,
  Users,
  ArrowLeft,
  Loader2,
  Save,
  ShieldCheck,
  Upload,
  AlertCircle,
} from 'lucide-react'
import Link from 'next/link'
import { licenciaSchema, type LicenciaFormData } from '@/lib/schemas/rrhh.schema'
import { crearLicenciaAction, obtenerEmpleadosActivosAction } from '@/actions/rrhh.actions'
import { useNotificationStore } from '@/store/notificationStore'
import type { Empleado } from '@/types/domain.types'
import { getEmpleadoNombre } from '@/lib/utils/empleado-display'

type NuevaLicenciaFormProps = {
  defaultTipo?: LicenciaFormData['tipo']
}

export function NuevaLicenciaForm({ defaultTipo }: NuevaLicenciaFormProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(false)
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [certificadoFile, setCertificadoFile] = useState<File | null>(null)
  const [diasCalculados, setDiasCalculados] = useState<number>(0)

  const {
    handleSubmit,
    watch,
    setValue,
    register,
    formState: { errors },
  } = useForm<LicenciaFormData>({
    resolver: zodResolver(licenciaSchema),
    defaultValues: {
      excepcion_plazo: false,
      tipo: defaultTipo,
    },
  })

  const tipoSeleccionado = watch('tipo')
  const esVacaciones = tipoSeleccionado === 'vacaciones'
  const fechaInicio = watch('fecha_inicio')
  const fechaFin = watch('fecha_fin')
  const fechaPresentacion = watch('fecha_presentacion')
  const excepcionPlazo = watch('excepcion_plazo')

  useEffect(() => {
    if (!esVacaciones) return

    setCertificadoFile(null)
    setValue('fecha_presentacion', '')
    setValue('diagnostico_reportado', '')
    setValue('excepcion_plazo', false)
    setValue('motivo_excepcion', '')
  }, [esVacaciones, setValue])

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

  const empleadoSeleccionado = empleados.find((e) => e.id === watch('empleado_id'))

  const estadoPlazo = useMemo(() => {
    if (esVacaciones) return null
    const fechaControl = fechaPresentacion || fechaInicio
    if (!fechaControl) return null
    const inicio = fechaPresentacion ? new Date(fechaPresentacion) : new Date(`${fechaInicio}T00:00:00`)
    if (Number.isNaN(inicio.getTime())) return null
    const limite = new Date(inicio.getTime() + 24 * 60 * 60 * 1000)
    const ahora = new Date()
    const restanteMs = limite.getTime() - ahora.getTime()
    return {
      limite,
      enTermino: restanteMs >= 0,
      horasRestantes: Math.round(restanteMs / (1000 * 60 * 60)),
    }
  }, [esVacaciones, fechaPresentacion, fechaInicio])

  const onSubmit = async (data: LicenciaFormData) => {
    try {
      const esVacacionesForm = data.tipo === 'vacaciones'

      if (!esVacacionesForm && !certificadoFile) {
        showToast('error', 'Debes adjuntar el certificado en imagen', 'Certificado requerido')
        return
      }

      setIsLoading(true)
      const payload = new FormData()
      payload.append('empleado_id', data.empleado_id)
      payload.append('tipo', data.tipo)
      payload.append('fecha_inicio', data.fecha_inicio)
      payload.append('fecha_fin', data.fecha_fin)
      payload.append('observaciones', data.observaciones || '')
      if (!esVacacionesForm) {
        if (data.fecha_presentacion) {
          payload.append('fecha_presentacion', data.fecha_presentacion)
        }
        payload.append('diagnostico_reportado', data.diagnostico_reportado || '')
        payload.append('excepcion_plazo', data.excepcion_plazo ? 'true' : 'false')
        payload.append('motivo_excepcion', data.motivo_excepcion || '')
        payload.append('certificado', certificadoFile!)
      }

      const result = await crearLicenciaAction(payload)

      if (result.success) {
        showToast(
          'success',
          result.message ||
            (esVacacionesForm
              ? 'La solicitud de vacaciones fue creada correctamente'
              : 'La solicitud de licencia fue creada correctamente'),
          esVacacionesForm ? 'Vacaciones programadas' : 'Licencia creada'
        )
        router.push('/rrhh/licencias')
      } else {
        showToast('error', result.error || 'No se pudo crear la licencia', 'Error al crear licencia')
      }
    } catch (error) {
      console.error('Error en onSubmit licencia:', error)
      showToast('error', 'Error inesperado al crear la licencia', 'Error inesperado')
    } finally {
      setIsLoading(false)
    }
  }

  const tiposLicencia = [
    { value: 'vacaciones', label: 'Vacaciones', description: 'Periodo de descanso anual, sin certificado' },
    { value: 'enfermedad', label: 'Enfermedad', description: 'Licencia por enfermedad' },
    { value: 'maternidad', label: 'Maternidad', description: 'Licencia por maternidad/paternidad' },
    { value: 'estudio', label: 'Estudio', description: 'Licencia por estudios' },
    { value: 'otro', label: 'Otro', description: 'Otro tipo de licencia' },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/rrhh/licencias">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Licencias
          </Link>
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Informacion de la Licencia
            </CardTitle>
            <CardDescription>
              Seleccion del empleado y datos generales de la solicitud
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="empleado_id">Empleado *</Label>
              <Select value={watch('empleado_id') || ''} onValueChange={(value) => setValue('empleado_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar empleado" />
                </SelectTrigger>
                <SelectContent>
                  {empleados.map((empleado) => {
                    const nombreCompleto = getEmpleadoNombre(empleado)
                    return (
                      <SelectItem key={empleado.id} value={empleado.id}>
                        {nombreCompleto}
                        {empleado.legajo ? ` - Legajo ${empleado.legajo}` : ''}
                        {empleado.sucursal?.nombre ? ` (${empleado.sucursal.nombre})` : ''}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {errors.empleado_id && <p className="text-sm text-red-600">{errors.empleado_id.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Licencia *</Label>
              <Select
                value={watch('tipo') || ''}
                onValueChange={(value) => setValue('tipo', value as LicenciaFormData['tipo'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo de licencia" />
                </SelectTrigger>
                <SelectContent>
                  {tiposLicencia.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      <div>
                        <div className="font-medium">{tipo.label}</div>
                        <div className="text-xs text-muted-foreground">{tipo.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.tipo && <p className="text-sm text-red-600">{errors.tipo.message}</p>}
            </div>

            {empleadoSeleccionado && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                <div className="font-medium text-blue-900 mb-2">Empleado Seleccionado</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    Nombre: {getEmpleadoNombre(empleadoSeleccionado)}
                  </div>
                  <div>Legajo: {empleadoSeleccionado.legajo || 'Sin asignar'}</div>
                  <div>Sucursal: {empleadoSeleccionado.sucursal?.nombre || 'Sin asignar'}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-green-600" />
              {esVacaciones ? 'Fechas de vacaciones' : 'Fechas, Diagnostico y Plazo 24h'}
            </CardTitle>
            <CardDescription>
              {esVacaciones
                ? 'Solo necesitamos el periodo solicitado. No hace falta certificado, diagnostico ni plazo 24h.'
                : 'El certificado debe presentarse dentro de 24 horas desde la fecha de presentacion declarada. Si no se informa, se usa la fecha de inicio.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fecha_inicio">Fecha de Inicio *</Label>
                <Input id="fecha_inicio" type="date" {...register('fecha_inicio')} />
                {errors.fecha_inicio && <p className="text-sm text-red-600">{errors.fecha_inicio.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fecha_fin">Fecha de Fin *</Label>
                <Input id="fecha_fin" type="date" {...register('fecha_fin')} />
                {errors.fecha_fin && <p className="text-sm text-red-600">{errors.fecha_fin.message}</p>}
              </div>
            </div>

            {esVacaciones && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                Vacaciones: se cargan solo de fecha a fecha y se consideran dias corridos.
                No hace falta certificado, diagnostico ni control 24 horas.
              </div>
            )}

            {!esVacaciones && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fecha_presentacion">Fecha de presentacion del certificado (control 24h)</Label>
                  <Input id="fecha_presentacion" type="datetime-local" {...register('fecha_presentacion')} />
                  {errors.fecha_presentacion && (
                    <p className="text-sm text-red-600">{errors.fecha_presentacion.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="diagnostico_reportado">Diagnostico reportado</Label>
                  <Input
                    id="diagnostico_reportado"
                    placeholder="Ej: Gastroenteritis aguda"
                    {...register('diagnostico_reportado')}
                  />
                  {errors.diagnostico_reportado && (
                    <p className="text-sm text-red-600">{errors.diagnostico_reportado.message}</p>
                  )}
                </div>
              </div>
            )}

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-900">Duracion de licencia</span>
                </div>
                <div className="text-2xl font-bold text-green-700">{diasCalculados}</div>
              </div>
              <div className="text-sm text-green-700 mt-1">
                dia{diasCalculados !== 1 ? 's' : ''}{esVacaciones ? ' corridos' : ''}
              </div>
            </div>

            {!esVacaciones && estadoPlazo && (
              <div
                className={`rounded-lg p-4 border ${
                  estadoPlazo.enTermino ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'
                }`}
              >
                <p className={`text-sm font-medium ${estadoPlazo.enTermino ? 'text-blue-900' : 'text-orange-900'}`}>
                  Limite de presentacion: {estadoPlazo.limite.toLocaleString()}
                </p>
                <p className={`text-sm ${estadoPlazo.enTermino ? 'text-blue-700' : 'text-orange-700'}`}>
                  {estadoPlazo.enTermino
                    ? `En termino. Restan aprox ${estadoPlazo.horasRestantes} horas.`
                    : 'Fuera de termino: marque excepcion para continuar.'}
                </p>
              </div>
            )}

            {!esVacaciones && (
              <>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="excepcion_plazo"
                    checked={!!excepcionPlazo}
                    onCheckedChange={(checked) => setValue('excepcion_plazo', checked === true)}
                  />
                  <Label htmlFor="excepcion_plazo" className="cursor-pointer">
                    Aplicar excepcion de plazo (fuera de 24h)
                  </Label>
                </div>

                {excepcionPlazo && (
                  <div className="space-y-2">
                    <Label htmlFor="motivo_excepcion">Motivo de excepcion *</Label>
                    <Textarea
                      id="motivo_excepcion"
                      rows={2}
                      placeholder="Detalle de la excepcion autorizada por RRHH"
                      {...register('motivo_excepcion')}
                    />
                    {errors.motivo_excepcion && (
                      <p className="text-sm text-red-600">{errors.motivo_excepcion.message}</p>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {esVacaciones ? (
                <CalendarDays className="w-5 h-5 text-emerald-600" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-purple-600" />
              )}
              {esVacaciones ? 'Observaciones de la solicitud' : 'Certificado y Auditoria IA'}
            </CardTitle>
            <CardDescription>
              {esVacaciones
                ? 'Usá este espacio para aclarar cobertura, viaje, fechas especiales o cualquier nota interna.'
                : 'Sin certificado no se valida. La IA analiza imagen y RRHH revisa manualmente en estado pendiente.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {esVacaciones ? (
              <div className="space-y-2">
                <Label htmlFor="observaciones">Observaciones</Label>
                <Textarea
                  id="observaciones"
                  placeholder="Notas internas para RRHH..."
                  rows={3}
                  {...register('observaciones')}
                />
                {errors.observaciones && <p className="text-sm text-red-600">{errors.observaciones.message}</p>}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="certificado">Certificado medico (imagen) *</Label>
                  <Input
                    id="certificado"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => setCertificadoFile(event.target.files?.[0] || null)}
                  />
                  {certificadoFile ? (
                    <p className="text-sm text-muted-foreground">
                      <Upload className="w-4 h-4 inline mr-1" />
                      {certificadoFile.name} ({Math.round(certificadoFile.size / 1024)} KB)
                    </p>
                  ) : (
                    <p className="text-sm text-red-600">Adjuntar certificado es obligatorio.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observaciones">Observaciones</Label>
                  <Textarea
                    id="observaciones"
                    placeholder="Notas internas para RRHH..."
                    rows={3}
                    {...register('observaciones')}
                  />
                  {errors.observaciones && <p className="text-sm text-red-600">{errors.observaciones.message}</p>}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div
          className={`rounded-lg border p-4 ${
            esVacaciones ? 'border-emerald-200 bg-emerald-50' : 'border-yellow-200 bg-yellow-50'
          }`}
        >
          <div className="flex items-start gap-3">
            {esVacaciones ? (
              <CalendarDays className="mt-0.5 h-5 w-5 text-emerald-700" />
            ) : (
              <AlertCircle className="mt-0.5 h-5 w-5 text-yellow-700" />
            )}
            <div>
              <h3 className={`font-semibold ${esVacaciones ? 'text-emerald-900' : 'text-yellow-900'}`}>
                {esVacaciones ? 'Flujo de vacaciones' : 'Flujo de validacion'}
              </h3>
              <p className={`mt-1 text-sm ${esVacaciones ? 'text-emerald-800' : 'text-yellow-800'}`}>
                {esVacaciones
                  ? '1) Se guardan fechas y observaciones. 2) RRHH revisa la solicitud y mantiene el seguimiento hasta resolverla.'
                  : '1) Se valida carga del certificado. 2) IA audita nombre/diagnostico de la imagen. 3) RRHH realiza revision manual y mantiene estado pendiente hasta resolucion.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
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
                {esVacaciones ? 'Programar Vacaciones' : 'Crear Licencia'}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

