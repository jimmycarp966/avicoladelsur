'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader2, Save } from 'lucide-react'
import { actualizarVehiculoAction, obtenerVehiculoPorIdAction } from '@/actions/reparto.actions'
import { useNotificationStore } from '@/store/notificationStore'
import type { Vehiculo } from '@/types/domain.types'

const editarVehiculoSchema = z.object({
  patente: z.string().min(1, 'La patente es requerida'),
  marca: z.string().min(1, 'La marca es requerida'),
  modelo: z.string().min(1, 'El modelo es requerido'),
  tipo_vehiculo: z.enum(['Camion', 'Furgon', 'Camioneta', 'Moto', 'Pickup']),
  capacidad_kg: z.number().positive('La capacidad debe ser mayor a 0'),
  fecha_vto_seguro: z.string().optional(),
  seguro_vigente: z.boolean(),
  activo: z.boolean(),
})

type EditarVehiculoFormData = z.infer<typeof editarVehiculoSchema>

// Tipos de vehículo disponibles
const tiposVehiculo = ['Camion', 'Furgon', 'Camioneta', 'Moto', 'Pickup'] as const
type TipoVehiculo = typeof tiposVehiculo[number]

interface EditarVehiculoFormProps {
  vehiculoId: string
}

export function EditarVehiculoForm({ vehiculoId }: EditarVehiculoFormProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EditarVehiculoFormData>({
    resolver: zodResolver(editarVehiculoSchema),
  })

  useEffect(() => {
    loadVehiculo()
  }, [vehiculoId])

  const loadVehiculo = async () => {
    try {
      setIsLoadingData(true)
      const result = await obtenerVehiculoPorIdAction(vehiculoId)
      if (result.success && result.data) {
        const data = result.data as Vehiculo
        setVehiculo(data)
        // Cargar datos en el formulario
        setValue('patente', data.patente)
        setValue('marca', data.marca || '')
        setValue('modelo', data.modelo || '')
        setValue('tipo_vehiculo', (data.tipo_vehiculo as TipoVehiculo) || 'Camioneta')
        setValue('capacidad_kg', data.capacidad_kg)
        setValue('fecha_vto_seguro', data.fecha_vto_seguro || '')
        setValue('seguro_vigente', data.seguro_vigente ?? true)
        setValue('activo', data.activo ?? true)
      } else {
        showToast('error', result.error || 'Error al cargar vehículo')
        router.push('/reparto/vehiculos')
      }
    } catch (error: any) {
      console.error('Error cargando vehículo:', error)
      showToast('error', 'Error al cargar vehículo')
      router.push('/reparto/vehiculos')
    } finally {
      setIsLoadingData(false)
    }
  }

  const onSubmit = async (data: EditarVehiculoFormData) => {
    try {
      setIsLoading(true)

      const result = await actualizarVehiculoAction(vehiculoId, {
        patente: data.patente,
        marca: data.marca,
        modelo: data.modelo,
        tipo_vehiculo: data.tipo_vehiculo,
        capacidad_kg: data.capacidad_kg,
        fecha_vto_seguro: data.fecha_vto_seguro || undefined,
        seguro_vigente: data.seguro_vigente,
        activo: data.activo,
      })

      if (result.success) {
        showToast('success', result.message || 'Vehículo actualizado exitosamente')
        router.push('/reparto/vehiculos')
      } else {
        showToast('error', result.error || 'Error al actualizar vehículo')
      }
    } catch (error: any) {
      console.error('Error actualizando vehículo:', error)
      showToast('error', error.message || 'Error al actualizar vehículo')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoadingData) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2">Cargando vehículo...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!vehiculo) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <p className="text-muted-foreground">Vehículo no encontrado</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información del Vehículo</CardTitle>
          <CardDescription>
            Modifica los datos del vehículo
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

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center space-x-2">
              <Switch
                id="seguro_vigente"
                checked={watch('seguro_vigente')}
                onCheckedChange={(checked) => setValue('seguro_vigente', checked)}
              />
              <Label htmlFor="seguro_vigente" className="cursor-pointer">
                Seguro vigente
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="activo"
                checked={watch('activo')}
                onCheckedChange={(checked) => setValue('activo', checked)}
              />
              <Label htmlFor="activo" className="cursor-pointer">
                Vehículo activo
              </Label>
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
              Actualizando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Actualizar Vehículo
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

