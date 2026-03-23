'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, ArrowLeft, Loader2, Save } from 'lucide-react'
import { crearIncidenciaLegajoAction } from '@/actions/rrhh.actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { legajoIncidenciaSchema, type LegajoIncidenciaFormData } from '@/lib/schemas/rrhh.schema'
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
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LegajoIncidenciaFormData>({
    resolver: zodResolver(legajoIncidenciaSchema),
    defaultValues: {
      empleado_id: empleadoId,
      fecha_evento: getDefaultFechaEvento(),
      titulo: '',
      descripcion: '',
    },
  })

  const onSubmit = async (data: LegajoIncidenciaFormData) => {
    const result = await crearIncidenciaLegajoAction(data)

    if (!result.success) {
      showToast('error', result.error || 'No se pudo registrar la incidencia', 'Error')
      return
    }

    showToast('success', result.message || 'Incidencia registrada en el legajo', 'Legajo actualizado')
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
              Nueva incidencia
            </CardTitle>
            <CardDescription>
              Esta incidencia se guarda dentro del legajo y aparece automaticamente en el historial del empleado.
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
                <li>La fecha y hora que cargues se usan como referencia del hecho registrado.</li>
                <li>Este registro documenta seguimiento administrativo, pero no modifica sueldos ni liquidaciones por si solo.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="titulo">Titulo *</Label>
              <Input
                id="titulo"
                placeholder="Ej: Llamado de atencion por incumplimiento"
                {...register('titulo')}
              />
              {errors.titulo && <p className="text-sm text-red-600">{errors.titulo.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="fecha_evento">Fecha y hora *</Label>
              <Input id="fecha_evento" type="datetime-local" {...register('fecha_evento')} />
              {errors.fecha_evento && <p className="text-sm text-red-600">{errors.fecha_evento.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripcion</Label>
              <Textarea
                id="descripcion"
                rows={5}
                placeholder="Detalle breve de la incidencia, contexto y seguimiento esperado."
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
                Guardar incidencia
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
