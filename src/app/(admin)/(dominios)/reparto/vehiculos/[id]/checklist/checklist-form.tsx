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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Loader2, Save } from 'lucide-react'
import { registrarChecklistVehiculoAction } from '@/actions/reparto.actions'
import { useNotificationStore } from '@/store/notificationStore'

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
      aceite_motor: false,
      luces: false,
      frenos: false,
      presion_neumaticos: false,
      limpieza_interior: false,
      limpieza_exterior: false,
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
        ...data,
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
          <CardDescription>
            Verifica el estado del vehículo antes de iniciar la jornada
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Verificaciones */}
          <div className="space-y-4">
            <h3 className="font-semibold">Verificaciones</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="aceite_motor"
                  checked={watch('aceite_motor')}
                  onCheckedChange={(checked) => setValue('aceite_motor', checked === true)}
                />
                <Label htmlFor="aceite_motor" className="cursor-pointer">
                  Aceite de motor
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="luces"
                  checked={watch('luces')}
                  onCheckedChange={(checked) => setValue('luces', checked === true)}
                />
                <Label htmlFor="luces" className="cursor-pointer">
                  Luces
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="frenos"
                  checked={watch('frenos')}
                  onCheckedChange={(checked) => setValue('frenos', checked === true)}
                />
                <Label htmlFor="frenos" className="cursor-pointer">
                  Frenos
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="presion_neumaticos"
                  checked={watch('presion_neumaticos')}
                  onCheckedChange={(checked) => setValue('presion_neumaticos', checked === true)}
                />
                <Label htmlFor="presion_neumaticos" className="cursor-pointer">
                  Presión de neumáticos
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="limpieza_interior"
                  checked={watch('limpieza_interior')}
                  onCheckedChange={(checked) => setValue('limpieza_interior', checked === true)}
                />
                <Label htmlFor="limpieza_interior" className="cursor-pointer">
                  Limpieza interior
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="limpieza_exterior"
                  checked={watch('limpieza_exterior')}
                  onCheckedChange={(checked) => setValue('limpieza_exterior', checked === true)}
                />
                <Label htmlFor="limpieza_exterior" className="cursor-pointer">
                  Limpieza exterior
                </Label>
              </div>
            </div>
          </div>

          {/* Información adicional */}
          <div className="grid gap-4 md:grid-cols-2">
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
            </div>

            <div>
              <Label htmlFor="kilometraje">Kilometraje</Label>
              <Input
                id="kilometraje"
                type="number"
                min="0"
                {...register('kilometraje', { valueAsNumber: true })}
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="observaciones">Observaciones</Label>
            <Textarea
              id="observaciones"
              {...register('observaciones')}
              rows={4}
              placeholder="Notas adicionales sobre el estado del vehículo..."
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
              Registrar Checklist
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

