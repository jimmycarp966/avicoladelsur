'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { registrarChecklistVehiculoAction } from '@/actions/reparto.actions'
import { createClient } from '@/lib/supabase/client'

const checklistSchema = z.object({
  aceite_motor_porcentaje: z.number().int().min(0).max(100).refine((v) => v % 10 === 0, 'Debe ir de 10 en 10'),
  frenos: z.boolean(),
  luces_observacion: z.string().max(500).optional(),
  presion_neumaticos_psi: z.number().min(0).max(120),
  limpieza_interior_estado: z.enum(['mala', 'buena', 'excelente']),
  limpieza_exterior_estado: z.enum(['mala', 'buena', 'excelente']),
  combustible: z.number().min(0).max(100).optional(),
  kilometraje: z.number().int().min(0).optional(),
  observaciones: z.string().max(500).optional(),
})

type ChecklistFormData = z.infer<typeof checklistSchema>

interface ChecklistFinFormProps {
  rutaId: string
  vehiculoId: string
  onComplete: () => void
}

export function ChecklistFinForm({ rutaId, vehiculoId, onComplete }: ChecklistFinFormProps) {
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<ChecklistFormData>({
    resolver: zodResolver(checklistSchema),
    defaultValues: {
      aceite_motor_porcentaje: 50,
      frenos: false,
      luces_observacion: '',
      presion_neumaticos_psi: 32,
      limpieza_interior_estado: 'buena',
      limpieza_exterior_estado: 'buena',
    },
  })

  const onSubmit = async (data: ChecklistFormData) => {
    setLoading(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        toast.error('Usuario no autenticado')
        setLoading(false)
        return
      }

      const result = await registrarChecklistVehiculoAction({
        vehiculo_id: vehiculoId,
        frenos: data.frenos,
        aceite_motor_porcentaje: data.aceite_motor_porcentaje,
        luces_observacion: data.luces_observacion,
        presion_neumaticos_psi: data.presion_neumaticos_psi,
        limpieza_interior_estado: data.limpieza_interior_estado,
        limpieza_exterior_estado: data.limpieza_exterior_estado,
        combustible: data.combustible,
        kilometraje: data.kilometraje,
        observaciones: data.observaciones,
      })

      if (!result.success) {
        toast.error(result.error || 'Error al registrar checklist')
        setLoading(false)
        return
      }

      const checklistId = result.data?.checklistId
      if (!checklistId) {
        toast.error('Error al obtener checklist creado')
        setLoading(false)
        return
      }

      const { error: updateError } = await supabase
        .from('rutas_reparto')
        .update({ checklist_fin_id: checklistId })
        .eq('id', rutaId)

      if (updateError) {
        toast.error('Error al vincular checklist a la ruta')
        setLoading(false)
        return
      }

      toast.success('Checklist de finalizacion completado')
      onComplete()
    } catch (error: any) {
      console.error('Error:', error)
      toast.error('Error al completar checklist')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Checklist de Finalizacion de Ruta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label className="text-base font-semibold">Verificaciones Finales</Label>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="aceite_motor_porcentaje">Aceite motor (%)</Label>
                <span className="text-sm font-semibold">{watch('aceite_motor_porcentaje')}%</span>
              </div>
              <Input
                id="aceite_motor_porcentaje"
                type="range"
                min="0"
                max="100"
                step="10"
                value={watch('aceite_motor_porcentaje')}
                onChange={(e) => setValue('aceite_motor_porcentaje', Number(e.target.value), { shouldValidate: true })}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="frenos" checked={watch('frenos')} onCheckedChange={(checked) => setValue('frenos', checked === true)} />
              <Label htmlFor="frenos" className="font-normal cursor-pointer">Frenos</Label>
            </div>

            <div>
              <Label htmlFor="luces_observacion">Luces (observacion)</Label>
              <Input id="luces_observacion" {...register('luces_observacion')} placeholder="Ej: sin novedades" />
            </div>

            <div>
              <Label htmlFor="presion_neumaticos_psi">Presion neumaticos (PSI)</Label>
              <Input id="presion_neumaticos_psi" type="number" min="0" max="120" step="1" {...register('presion_neumaticos_psi', { valueAsNumber: true })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Limpieza interior</Label>
                <Select value={watch('limpieza_interior_estado')} onValueChange={(value) => setValue('limpieza_interior_estado', value as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mala">Mala</SelectItem>
                    <SelectItem value="buena">Buena</SelectItem>
                    <SelectItem value="excelente">Excelente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Limpieza exterior</Label>
                <Select value={watch('limpieza_exterior_estado')} onValueChange={(value) => setValue('limpieza_exterior_estado', value as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mala">Mala</SelectItem>
                    <SelectItem value="buena">Buena</SelectItem>
                    <SelectItem value="excelente">Excelente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="combustible">Combustible (%)</Label>
              <Input id="combustible" type="number" min="0" max="100" {...register('combustible', { setValueAs: (v) => v === '' ? undefined : Number(v) })} placeholder="0-100" />
            </div>
            <div>
              <Label htmlFor="kilometraje">Kilometraje final</Label>
              <Input id="kilometraje" type="number" min="0" {...register('kilometraje', { setValueAs: (v) => v === '' ? undefined : Number(v) })} placeholder="km" />
            </div>
          </div>

          <div>
            <Label htmlFor="observaciones">Observaciones</Label>
            <Textarea id="observaciones" {...register('observaciones')} placeholder="Notas adicionales sobre el estado del vehículo..." rows={3} />
          </div>

          {(errors.aceite_motor_porcentaje || errors.presion_neumaticos_psi || errors.combustible || errors.kilometraje) && (
            <div className="text-sm text-red-500 space-y-1">
              {errors.aceite_motor_porcentaje && <p>{errors.aceite_motor_porcentaje.message}</p>}
              {errors.presion_neumaticos_psi && <p>{errors.presion_neumaticos_psi.message}</p>}
              {errors.combustible && <p>{errors.combustible.message}</p>}
              {errors.kilometraje && <p>{errors.kilometraje.message}</p>}
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Guardando...' : 'Completar Checklist'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
