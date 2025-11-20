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
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { registrarChecklistVehiculo } from '@/actions/reparto.actions'
import { createClient } from '@/lib/supabase/client'

const checklistSchema = z.object({
  aceite_motor: z.boolean(),
  luces: z.boolean(),
  frenos: z.boolean(),
  presion_neumaticos: z.boolean(),
  limpieza_interior: z.boolean(),
  limpieza_exterior: z.boolean(),
  combustible: z.number().min(0).max(100).optional(),
  kilometraje: z.number().int().min(0).optional(),
  observaciones: z.string().max(500).optional(),
})

type ChecklistFormData = z.infer<typeof checklistSchema>

interface ChecklistInicioFormProps {
  rutaId: string
  vehiculoId: string
  onComplete: () => void
}

export function ChecklistInicioForm({ rutaId, vehiculoId, onComplete }: ChecklistInicioFormProps) {
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<ChecklistFormData>({
    resolver: zodResolver(checklistSchema),
    defaultValues: {
      aceite_motor: false,
      luces: false,
      frenos: false,
      presion_neumaticos: false,
      limpieza_interior: false,
      limpieza_exterior: false,
    }
  })

  const onSubmit = async (data: ChecklistFormData) => {
    setLoading(true)

    try {
      // Obtener usuario actual
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        toast.error('Usuario no autenticado')
        return
      }

      // Registrar checklist
      const result = await registrarChecklistVehiculo({
        vehiculo_id: vehiculoId,
        ...data,
      })

      if (!result.success) {
        toast.error(result.error || 'Error al registrar checklist')
        return
      }

      // Obtener el ID del checklist recién creado
      const { data: checklistData, error: checklistError } = await supabase
        .from('checklists_vehiculos')
        .select('id')
        .eq('vehiculo_id', vehiculoId)
        .eq('usuario_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (checklistError || !checklistData) {
        toast.error('Error al obtener checklist creado')
        return
      }

      // Vincular checklist a la ruta
      const { error: updateError } = await supabase
        .from('rutas_reparto')
        .update({ checklist_inicio_id: checklistData.id })
        .eq('id', rutaId)

      if (updateError) {
        toast.error('Error al vincular checklist a la ruta')
        return
      }

      toast.success('Checklist de inicio completado')
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
          <CardTitle className="text-lg">Checklist de Inicio de Ruta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Checks básicos */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Verificaciones</Label>
            <div className="space-y-2">
              {[
                { key: 'aceite_motor', label: 'Aceite de motor' },
                { key: 'luces', label: 'Luces' },
                { key: 'frenos', label: 'Frenos' },
                { key: 'presion_neumaticos', label: 'Presión de neumáticos' },
                { key: 'limpieza_interior', label: 'Limpieza interior' },
                { key: 'limpieza_exterior', label: 'Limpieza exterior' },
              ].map((item) => (
                <div key={item.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={item.key}
                    checked={watch(item.key as keyof ChecklistFormData) as boolean}
                    onCheckedChange={(checked) => setValue(item.key as keyof ChecklistFormData, checked as boolean)}
                  />
                  <Label htmlFor={item.key} className="font-normal cursor-pointer">
                    {item.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Combustible y kilometraje */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="combustible">Combustible (%)</Label>
              <Input
                id="combustible"
                type="number"
                min="0"
                max="100"
                {...register('combustible', { valueAsNumber: true })}
                placeholder="0-100"
              />
              {errors.combustible && (
                <p className="text-sm text-red-500">{errors.combustible.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="kilometraje">Kilometraje</Label>
              <Input
                id="kilometraje"
                type="number"
                min="0"
                {...register('kilometraje', { valueAsNumber: true })}
                placeholder="km"
              />
              {errors.kilometraje && (
                <p className="text-sm text-red-500">{errors.kilometraje.message}</p>
              )}
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <Label htmlFor="observaciones">Observaciones</Label>
            <Textarea
              id="observaciones"
              {...register('observaciones')}
              placeholder="Notas adicionales..."
              rows={3}
            />
            {errors.observaciones && (
              <p className="text-sm text-red-500">{errors.observaciones.message}</p>
            )}
          </div>

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

