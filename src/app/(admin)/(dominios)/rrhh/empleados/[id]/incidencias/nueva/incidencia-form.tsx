'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, ArrowLeft, Loader2, Save } from 'lucide-react'
import { crearIncidenciaLegajoAction } from '@/actions/rrhh.actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  legajoIncidenciaSchema,
  type LegajoIncidenciaFormData,
  type LegajoIncidenciaFormInput,
} from '@/lib/schemas/rrhh.schema'
import { buildDisciplinaTitulo, getDisciplinaEtapaLabel } from '@/lib/utils/rrhh-disciplinario'
import { useNotificationStore } from '@/store/notificationStore'

type NuevaIncidenciaFormProps = {
  empleadoId: string
  empleadoNombre: string
  empleadoIdentificacion: string
}

function getDefaultFechaEvento(): string {
  const now = new Date()
  const timezoneOffset = now.getTimezoneOffset() * 60 * 1000
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

export function NuevaIncidenciaForm({
  empleadoId,
  empleadoNombre,
  empleadoIdentificacion,
}: NuevaIncidenciaFormProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LegajoIncidenciaFormInput, unknown, LegajoIncidenciaFormData>({
    resolver: zodResolver(legajoIncidenciaSchema),
    defaultValues: {
      empleado_id: empleadoId,
      etapa: 'verbal',
      motivo: '',
      fecha_evento: getDefaultFechaEvento(),
      titulo: buildDisciplinaTitulo('verbal', ''),
      descripcion: '',
      suspension_dias: undefined,
      fecha_inicio_suspension: '',
      turno_inicio: undefined,
      fecha_reintegro: '',
      turno_reintegro: undefined,
    },
  })

  const etapa = useWatch({ control, name: 'etapa' })
  const motivo = useWatch({ control, name: 'motivo' })
  const suspensionDias = useWatch({ control, name: 'suspension_dias' })
  const fechaInicioSuspension = useWatch({ control, name: 'fecha_inicio_suspension' })

  useEffect(() => {
    if (etapa !== 'suspension' || !fechaInicioSuspension || !suspensionDias) return

    const inicio = new Date(`${fechaInicioSuspension}T12:00:00`)
    if (Number.isNaN(inicio.getTime())) return

    const reintegro = new Date(inicio.getTime() + Number(suspensionDias) * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)

    setValue('fecha_reintegro', reintegro, { shouldDirty: true, shouldValidate: true })
  }, [etapa, fechaInicioSuspension, suspensionDias, setValue])

  const onSubmit = async (data: LegajoIncidenciaFormData) => {
    const result = await crearIncidenciaLegajoAction(data)

    if (!result.success) {
      showToast('error', result.error || 'No se pudo registrar la incidencia', 'Error')
      return
    }

    showToast('success', result.message || 'Medida registrada en el legajo', 'Legajo actualizado')
    router.push(`/rrhh/empleados/${empleadoId}`)
    router.refresh()
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link href={`/rrhh/empleados/${empleadoId}`}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al legajo
          </Link>
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <input type="hidden" {...register('empleado_id')} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Nueva medida disciplinaria
            </CardTitle>
            <CardDescription>
              Esta medida se guarda dentro del legajo y deja generado el documento para notificacion y firma.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
              <div className="font-medium text-amber-950">{empleadoNombre}</div>
              <div className="mt-1 text-amber-800">{empleadoIdentificacion}</div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-900">Reglas de la incidencia</div>
              <ul className="mt-2 space-y-2 text-sm text-slate-700">
                <li>Se agrega al legajo del empleado y aparece en el timeline de RRHH.</li>
                <li>Cada medida genera un documento listo para imprimir y firma del empleado.</li>
                <li>Se pueden registrar varias medidas en paralelo porque cada una queda ligada a su propio motivo.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="etapa">Tipo de medida *</Label>
              <Controller
                control={control}
                name="etapa"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value)
                      const nextTitulo = buildDisciplinaTitulo(value as 'verbal' | 'advertencia_escrita' | 'suspension', motivo || '')
                      setValue('titulo', nextTitulo, { shouldDirty: true, shouldValidate: true })
                    }}
                  >
                    <SelectTrigger id="etapa" className="w-full">
                      <SelectValue placeholder="Selecciona una medida" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="verbal">Primera incidencia verbal</SelectItem>
                      <SelectItem value="advertencia_escrita">Advertencia escrita</SelectItem>
                      <SelectItem value="suspension">Suspension</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.etapa && <p className="text-sm text-red-600">{errors.etapa.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo *</Label>
              <Input
                id="motivo"
                placeholder="Ej: Ausencias injustificadas, incumplimiento de horario, mal desempeno"
                {...register('motivo', {
                  onChange: (event) => {
                    const nextMotivo = event.target.value
                    setValue('titulo', buildDisciplinaTitulo(etapa, nextMotivo), {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  },
                })}
              />
              {errors.motivo && <p className="text-sm text-red-600">{errors.motivo.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="titulo">Titulo del legajo *</Label>
              <Input
                id="titulo"
                placeholder={getDisciplinaEtapaLabel(etapa)}
                {...register('titulo')}
              />
              {errors.titulo && <p className="text-sm text-red-600">{errors.titulo.message}</p>}
            </div>

            {etapa === 'suspension' && (
              <div className="grid gap-4 rounded-lg border border-amber-200 bg-amber-50/40 p-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="suspension_dias">Dias de suspension *</Label>
                  <Input
                    id="suspension_dias"
                    type="number"
                    min={1}
                    max={365}
                    placeholder="Ej: 3"
                    {...register('suspension_dias')}
                  />
                  {errors.suspension_dias && <p className="text-sm text-red-600">{errors.suspension_dias.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fecha_inicio_suspension">Inicio de suspension *</Label>
                  <Input id="fecha_inicio_suspension" type="date" {...register('fecha_inicio_suspension')} />
                  {errors.fecha_inicio_suspension && (
                    <p className="text-sm text-red-600">{errors.fecha_inicio_suspension.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="turno_inicio">Turno de inicio *</Label>
                  <Controller
                    control={control}
                    name="turno_inicio"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="turno_inicio" className="w-full">
                          <SelectValue placeholder="Selecciona un turno" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manana">Manana</SelectItem>
                          <SelectItem value="tarde">Tarde</SelectItem>
                          <SelectItem value="turno_completo">Turno completo</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.turno_inicio && <p className="text-sm text-red-600">{errors.turno_inicio.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fecha_reintegro">Reintegro previsto</Label>
                  <Input id="fecha_reintegro" type="date" {...register('fecha_reintegro')} />
                  {errors.fecha_reintegro && <p className="text-sm text-red-600">{errors.fecha_reintegro.message}</p>}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="turno_reintegro">Turno de reintegro</Label>
                  <Controller
                    control={control}
                    name="turno_reintegro"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="turno_reintegro" className="w-full md:max-w-xs">
                          <SelectValue placeholder="Selecciona un turno" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manana">Manana</SelectItem>
                          <SelectItem value="tarde">Tarde</SelectItem>
                          <SelectItem value="turno_completo">Turno completo</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.turno_reintegro && (
                    <p className="text-sm text-red-600">{errors.turno_reintegro.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Estos datos se imprimen en el documento y tambien se usan para impactar la liquidacion del periodo.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="fecha_evento">Fecha y hora *</Label>
              <Input id="fecha_evento" type="datetime-local" {...register('fecha_evento')} />
              {errors.fecha_evento && <p className="text-sm text-red-600">{errors.fecha_evento.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Detalle</Label>
              <Textarea
                id="descripcion"
                rows={5}
                placeholder="Describe el hecho, contexto y observaciones que deben figurar en el documento."
                {...register('descripcion')}
              />
              {errors.descripcion && <p className="text-sm text-red-600">{errors.descripcion.message}</p>}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" asChild disabled={isSubmitting}>
            <Link href={`/rrhh/empleados/${empleadoId}`}>Cancelar</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Guardar medida
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
