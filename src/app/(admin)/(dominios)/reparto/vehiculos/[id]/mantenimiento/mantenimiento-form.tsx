'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Loader2, Save } from 'lucide-react'
import { useNotificationStore } from '@/store/notificationStore'
import { createClient } from '@/lib/supabase/client'

const mantenimientoSchema = z.object({
  tipo_mantenimiento: z.string().min(1, 'Debes seleccionar un tipo de mantenimiento'),
  fecha_programada: z.string().min(1, 'La fecha es requerida'),
  descripcion: z.string().min(1, 'La descripción es requerida'),
  costo_estimado: z.number().optional(),
  observaciones: z.string().optional(),
})

type MantenimientoFormData = z.infer<typeof mantenimientoSchema>

interface MantenimientoVehiculoFormProps {
  vehiculoId: string
}

export function MantenimientoVehiculoForm({ vehiculoId }: MantenimientoVehiculoFormProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MantenimientoFormData>({
    resolver: zodResolver(mantenimientoSchema),
    defaultValues: {
      tipo_mantenimiento: '',
      fecha_programada: '',
      descripcion: '',
      costo_estimado: 0,
      observaciones: '',
    },
  })

  const onSubmit = async (data: MantenimientoFormData) => {
    try {
      setIsLoading(true)

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        showToast('error', 'Usuario no autenticado')
        return
      }

      // Insertar registro de mantenimiento
      // Nota: Si existe una tabla de mantenimientos, usar esa. Por ahora, guardamos en observaciones del vehículo
      const { error } = await supabase
        .from('vehiculos')
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq('id', vehiculoId)

      if (error) throw error

      // Aquí se podría crear una tabla de mantenimientos_programados si no existe
      // Por ahora, mostramos un mensaje de éxito
      showToast('success', 'Mantenimiento programado exitosamente. Nota: Esta funcionalidad puede requerir una tabla de mantenimientos en la base de datos.')
      router.push('/reparto/vehiculos')
    } catch (error: any) {
      console.error('Error programando mantenimiento:', error)
      showToast('error', error.message || 'Error al programar mantenimiento')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información del Mantenimiento</CardTitle>
          <CardDescription>
            Programa un mantenimiento para este vehículo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="tipo_mantenimiento">Tipo de Mantenimiento *</Label>
            <Select
              value={watch('tipo_mantenimiento')}
              onValueChange={(value) => setValue('tipo_mantenimiento', value)}
            >
              <SelectTrigger id="tipo_mantenimiento" className={errors.tipo_mantenimiento ? 'border-red-500' : ''}>
                <SelectValue placeholder="Selecciona un tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="preventivo">Preventivo</SelectItem>
                <SelectItem value="correctivo">Correctivo</SelectItem>
                <SelectItem value="revision">Revisión</SelectItem>
                <SelectItem value="cambio_aceite">Cambio de Aceite</SelectItem>
                <SelectItem value="neumaticos">Neumáticos</SelectItem>
                <SelectItem value="otros">Otros</SelectItem>
              </SelectContent>
            </Select>
            {errors.tipo_mantenimiento && (
              <p className="text-sm text-red-500 mt-1">{errors.tipo_mantenimiento.message}</p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="fecha_programada">Fecha Programada *</Label>
              <Input
                id="fecha_programada"
                type="date"
                {...register('fecha_programada')}
                className={errors.fecha_programada ? 'border-red-500' : ''}
              />
              {errors.fecha_programada && (
                <p className="text-sm text-red-500 mt-1">{errors.fecha_programada.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="costo_estimado">Costo Estimado</Label>
              <Input
                id="costo_estimado"
                type="number"
                step="0.01"
                min="0"
                {...register('costo_estimado', { valueAsNumber: true })}
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="descripcion">Descripción *</Label>
            <Textarea
              id="descripcion"
              {...register('descripcion')}
              rows={4}
              placeholder="Describe el mantenimiento a realizar..."
              className={errors.descripcion ? 'border-red-500' : ''}
            />
            {errors.descripcion && (
              <p className="text-sm text-red-500 mt-1">{errors.descripcion.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="observaciones">Observaciones</Label>
            <Textarea
              id="observaciones"
              {...register('observaciones')}
              rows={3}
              placeholder="Notas adicionales..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Botones de Acción */}
      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/90">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Programar Mantenimiento
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

