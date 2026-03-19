'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Loader2, Save } from 'lucide-react'
import { registrarChecklistVehiculoAction } from '@/actions/reparto.actions'
import { useNotificationStore } from '@/store/notificationStore'

const limpiezaValues = ['mala', 'buena', 'excelente'] as const

const checklistSchema = z.object({
  aceite_motor_porcentaje: z.number().int().min(0).max(100).refine((v) => v % 10 === 0, 'Debe ir de 10 en 10'),
  frenos: z.boolean(),
  luces_observacion: z.string().max(500).optional(),
  presion_neumaticos_psi: z.number().min(0).max(120),
  limpieza_interior_estado: z.enum(limpiezaValues),
  limpieza_exterior_estado: z.enum(limpiezaValues),
  combustible: z.number().min(0).max(100).optional(),
  kilometraje: z.number().int().min(0).optional(),
  observaciones: z.string().max(500).optional(),
})

type ChecklistFormData = z.infer<typeof checklistSchema>

interface ChecklistVehiculoFormProps {
  vehiculoId: string
}

export function ChecklistVehiculoForm({ vehiculoId }: ChecklistVehiculoFormProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ChecklistFormData>({
    resolver: zodResolver(checklistSchema),
    defaultValues: {
      aceite_motor_porcentaje: 50,
      frenos: false,
      luces_observacion: '',
      presion_neumaticos_psi: 32,
      limpieza_interior_estado: 'buena',
      limpieza_exterior_estado: 'buena',
      combustible: undefined,
      kilometraje: undefined,
      observaciones: '',
    },
  })

  const onSubmit = async (data: ChecklistFormData) => {
    try {
      setIsLoading(true)

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

      if (result.success) {
        showToast('success', result.message || 'Checklist registrado exitosamente')
        router.push('/reparto/vehiculos')
      } else {
        showToast('error', result.error || 'Error al registrar checklist')
      }
    } catch (error: any) {
      console.error('Error registrando checklist:', error)
      showToast('error', error.message || 'Error al registrar checklist')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Checklist Diario del Vehículo</CardTitle>
          <CardDescription>Verifica el estado del vehículo antes de iniciar la jornada</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold">Verificaciones</h3>

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
              {errors.aceite_motor_porcentaje && <p className="text-sm text-red-500">{errors.aceite_motor_porcentaje.message}</p>}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="frenos"
                checked={watch('frenos')}
                onCheckedChange={(checked) => setValue('frenos', checked === true)}
              />
              <Label htmlFor="frenos" className="cursor-pointer">Frenos</Label>
            </div>

            <div>
              <Label htmlFor="luces_observacion">Luces (observacion)</Label>
              <Input id="luces_observacion" {...register('luces_observacion')} placeholder="Ej: baja izquierda no enciende" />
            </div>

            <div>
              <Label htmlFor="presion_neumaticos_psi">Presion de neumaticos (PSI)</Label>
              <Input id="presion_neumaticos_psi" type="number" min="0" max="120" step="1" {...register('presion_neumaticos_psi', { valueAsNumber: true })} />
              {errors.presion_neumaticos_psi && <p className="text-sm text-red-500">{errors.presion_neumaticos_psi.message}</p>}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Limpieza interior</Label>
                <Select
                  value={watch('limpieza_interior_estado')}
                  onValueChange={(value) => setValue('limpieza_interior_estado', value as 'mala' | 'buena' | 'excelente')}
                >
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
                <Select
                  value={watch('limpieza_exterior_estado')}
                  onValueChange={(value) => setValue('limpieza_exterior_estado', value as 'mala' | 'buena' | 'excelente')}
                >
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

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="combustible">Combustible (%)</Label>
              <Input id="combustible" type="number" min="0" max="100" {...register('combustible', { setValueAs: (v) => v === '' ? undefined : Number(v) })} placeholder="0-100" />
            </div>
            <div>
              <Label htmlFor="kilometraje">Kilometraje</Label>
              <Input id="kilometraje" type="number" min="0" {...register('kilometraje', { setValueAs: (v) => v === '' ? undefined : Number(v) })} placeholder="0" />
            </div>
          </div>

          <div>
            <Label htmlFor="observaciones">Observaciones</Label>
            <Textarea id="observaciones" {...register('observaciones')} rows={4} placeholder="Notas adicionales sobre el estado del vehículo..." />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
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
              Registrar Checklist
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
