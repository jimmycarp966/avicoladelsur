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

export function NuevaLicenciaForm() {
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
    },
  })

  const fechaInicio = watch('fecha_inicio')
  const fechaFin = watch('fecha_fin')
  const fechaSintomas = watch('fecha_sintomas')
  const excepcionPlazo = watch('excepcion_plazo')

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
    if (!fechaSintomas) return null
    const inicio = new Date(fechaSintomas)
    if (Number.isNaN(inicio.getTime())) return null
    const limite = new Date(inicio.getTime() + 24 * 60 * 60 * 1000)
    const ahora = new Date()
    const restanteMs = limite.getTime() - ahora.getTime()
    return {
      limite,
      enTermino: restanteMs >= 0,
      horasRestantes: Math.round(restanteMs / (1000 * 60 * 60)),
    }
  }, [fechaSintomas])

  const onSubmit = async (data: LicenciaFormData) => {
    try {
      if (!certificadoFile) {
        showToast('error', 'Debes adjuntar el certificado en imagen', 'Certificado requerido')
        return
      }

      setIsLoading(true)
      const payload = new FormData()
      payload.append('empleado_id', data.empleado_id)
      payload.append('tipo', data.tipo)
      payload.append('fecha_inicio', data.fecha_inicio)
      payload.append('fecha_fin', data.fecha_fin)
      payload.append('fecha_sintomas', data.fecha_sintomas)
      payload.append('observaciones', data.observaciones || '')
      payload.append('diagnostico_reportado', data.diagnostico_reportado || '')
      payload.append('excepcion_plazo', data.excepcion_plazo ? 'true' : 'false')
      payload.append('motivo_excepcion', data.motivo_excepcion || '')
      payload.append('certificado', certificadoFile)

      const result = await crearLicenciaAction(payload)

      if (result.success) {
        showToast(
          'success',
          result.message || 'La solicitud de licencia fue creada correctamente',
          'Licencia creada'
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
    { value: 'vacaciones', label: 'Vacaciones', description: 'Periodo de descanso anual' },
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
            <CardDescription>Seleccion del empleado y datos generales de la solicitud</CardDescription>
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
                    const nombre = empleado.usuario?.nombre || ''
                    const apellido = empleado.usuario?.apellido || ''
                    return (
                      <SelectItem key={empleado.id} value={empleado.id}>
                        {`${nombre} ${apellido}`.trim()} - {empleado.legajo || 'Sin legajo'} ({empleado.sucursal?.nombre})
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {errors.empleado_id && <p className="text-sm text-red-600">{errors.empleado_id.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Licencia *</Label>
              <Select value={watch('tipo') || ''} onValueChange={(value) => setValue('tipo', value as any)}>
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
                    Nombre: {empleadoSeleccionado.usuario?.nombre} {empleadoSeleccionado.usuario?.apellido}
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
              Fechas, Diagnostico y Plazo 24h
            </CardTitle>
            <CardDescription>
              El certificado debe presentarse dentro de 24 horas desde el inicio informado (salvo excepcion)
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fecha_sintomas">Inicio del hecho (control 24h) *</Label>
                <Input id="fecha_sintomas" type="datetime-local" {...register('fecha_sintomas')} />
                {errors.fecha_sintomas && <p className="text-sm text-red-600">{errors.fecha_sintomas.message}</p>}
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

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-900">Duracion de licencia</span>
                </div>
                <div className="text-2xl font-bold text-green-700">{diasCalculados}</div>
              </div>
              <div className="text-sm text-green-700 mt-1">dia{diasCalculados !== 1 ? 's' : ''}</div>
            </div>

            {estadoPlazo && (
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-600" />
              Certificado y Auditoria IA
            </CardTitle>
            <CardDescription>
              Sin certificado no se valida. La IA analiza imagen y RRHH revisa manualmente en estado pendiente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-700 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-900">Flujo de validacion</h3>
              <p className="text-yellow-800 text-sm mt-1">
                1) Se valida carga del certificado. 2) IA audita nombre/diagnostico de la imagen.
                3) RRHH realiza revision manual y mantiene estado pendiente hasta resolucion.
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
                Crear Licencia
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
