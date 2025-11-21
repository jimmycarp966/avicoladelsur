'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Loader2, Save } from 'lucide-react'
import { crearVehiculo } from '@/actions/reparto.actions'
import { useNotificationStore } from '@/store/notificationStore'

const crearVehiculoSchema = z.object({
  patente: z.string().min(1, 'La patente es requerida'),
  marca: z.string().min(1, 'La marca es requerida'),
  modelo: z.string().min(1, 'El modelo es requerido'),
  tipo_vehiculo: z.enum(['Camion', 'Furgon', 'Camioneta', 'Moto', 'Pickup']),
  capacidad_kg: z.number().positive('La capacidad debe ser mayor a 0'),
  fecha_vto_seguro: z.string().optional(),
})

type CrearVehiculoFormData = z.infer<typeof crearVehiculoSchema>

// Tipos de vehículo disponibles
const tiposVehiculo = ['Camion', 'Furgon', 'Camioneta', 'Moto', 'Pickup'] as const
type TipoVehiculo = typeof tiposVehiculo[number]

export function VehiculoForm() {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CrearVehiculoFormData>({
    resolver: zodResolver(crearVehiculoSchema),
    defaultValues: {
      patente: '',
      marca: '',
      modelo: '',
      tipo_vehiculo: 'Camioneta',
      capacidad_kg: 0,
      fecha_vto_seguro: '',
    },
  })

  const onSubmit = async (data: CrearVehiculoFormData) => {
    try {
      setIsLoading(true)

      const result = await crearVehiculo({
        patente: data.patente,
        marca: data.marca,
        modelo: data.modelo,
        tipo_vehiculo: data.tipo_vehiculo,
        capacidad_kg: data.capacidad_kg,
      })

      if (result.success) {
        showToast('success', result.message || 'Vehículo creado exitosamente')
        router.push('/reparto/vehiculos')
      } else {
        showToast('error', result.error || 'Error al crear vehículo')
      }
    } catch (error: any) {
      console.error('Error creando vehículo:', error)
      showToast('error', error.message || 'Error al crear vehículo')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información del Vehículo</CardTitle>
          <CardDescription>
            Completa los datos del nuevo vehículo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="patente">Patente *</Label>
              <Input
                id="patente"
                {...register('patente')}
                placeholder="ABC123"
                className={errors.patente ? 'border-red-500' : ''}
              />
              {errors.patente && (
                <p className="text-sm text-red-500 mt-1">{errors.patente.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="tipo_vehiculo">Tipo de Vehículo *</Label>
              <Select
                value={watch('tipo_vehiculo')}
                onValueChange={(value) => {
                  setValue('tipo_vehiculo', value as TipoVehiculo)
                }}
              >
                <SelectTrigger id="tipo_vehiculo" className={errors.tipo_vehiculo ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Selecciona un tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Camion">Camion</SelectItem>
                  <SelectItem value="Furgon">Furgon</SelectItem>
                  <SelectItem value="Camioneta">Camioneta</SelectItem>
                  <SelectItem value="Moto">Moto</SelectItem>
                  <SelectItem value="Pickup">Pickup</SelectItem>
                </SelectContent>
              </Select>
              {errors.tipo_vehiculo && (
                <p className="text-sm text-red-500 mt-1">{errors.tipo_vehiculo.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="marca">Marca *</Label>
              <Input
                id="marca"
                {...register('marca')}
                placeholder="Toyota"
                className={errors.marca ? 'border-red-500' : ''}
              />
              {errors.marca && (
                <p className="text-sm text-red-500 mt-1">{errors.marca.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="modelo">Modelo *</Label>
              <Input
                id="modelo"
                {...register('modelo')}
                placeholder="Hilux"
                className={errors.modelo ? 'border-red-500' : ''}
              />
              {errors.modelo && (
                <p className="text-sm text-red-500 mt-1">{errors.modelo.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="capacidad_kg">Capacidad (kg) *</Label>
              <Input
                id="capacidad_kg"
                type="number"
                step="0.01"
                min="0.01"
                {...register('capacidad_kg', { valueAsNumber: true })}
                placeholder="1000"
                className={errors.capacidad_kg ? 'border-red-500' : ''}
              />
              {errors.capacidad_kg && (
                <p className="text-sm text-red-500 mt-1">{errors.capacidad_kg.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="fecha_vto_seguro">Fecha Vencimiento Seguro</Label>
              <Input
                id="fecha_vto_seguro"
                type="date"
                {...register('fecha_vto_seguro')}
              />
            </div>
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
              Creando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Crear Vehículo
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

