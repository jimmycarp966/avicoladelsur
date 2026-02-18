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
import { crearVehiculoAction } from '@/actions/reparto.actions'
import { useNotificationStore } from '@/store/notificationStore'

const crearVehiculoSchema = z.object({
  patente: z.string().min(1, 'La patente es requerida'),
  marca: z.string().min(1, 'La marca es requerida'),
  modelo: z.string().min(1, 'El modelo es requerido'),
  tipo_vehiculo: z.enum(['Camion', 'Furgon', 'Camioneta', 'Moto', 'Pickup']),
  capacidad_kg: z.number().positive('La capacidad debe ser mayor a 0'),
  fecha_vto_seguro: z.string().optional(),
  fecha_vto_senasa: z.string().optional(),
  fecha_vto_vtv: z.string().optional(),
  km_inicial: z.number().min(0, 'El km inicial no puede ser negativo').optional(),
  capacidad_tanque_litros: z.number().min(0, 'La capacidad no puede ser negativa').optional(),
  combustible_actual_litros: z.number().min(0, 'El combustible no puede ser negativo').optional(),
}).refine((data) => {
  if (data.capacidad_tanque_litros === undefined || data.combustible_actual_litros === undefined) return true
  return data.combustible_actual_litros <= data.capacidad_tanque_litros
}, {
  message: 'El combustible actual no puede superar la capacidad del tanque',
  path: ['combustible_actual_litros'],
})

type CrearVehiculoFormData = z.infer<typeof crearVehiculoSchema>

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
      fecha_vto_senasa: '',
      fecha_vto_vtv: '',
      km_inicial: undefined,
      capacidad_tanque_litros: undefined,
      combustible_actual_litros: undefined,
    },
  })

  const onSubmit = async (data: CrearVehiculoFormData) => {
    try {
      setIsLoading(true)

      const result = await crearVehiculoAction({
        patente: data.patente,
        marca: data.marca,
        modelo: data.modelo,
        tipo_vehiculo: data.tipo_vehiculo,
        capacidad_kg: data.capacidad_kg,
        fecha_vto_seguro: data.fecha_vto_seguro || undefined,
        fecha_vto_senasa: data.fecha_vto_senasa || undefined,
        fecha_vto_vtv: data.fecha_vto_vtv || undefined,
        km_inicial: data.km_inicial,
        capacidad_tanque_litros: data.capacidad_tanque_litros,
        combustible_actual_litros: data.combustible_actual_litros,
      })

      if (result.success) {
        showToast('success', result.message || 'Vehiculo creado exitosamente')
        router.push('/reparto/vehiculos')
      } else {
        showToast('error', result.error || 'Error al crear vehiculo')
      }
    } catch (error: any) {
      console.error('Error creando vehiculo:', error)
      showToast('error', error.message || 'Error al crear vehiculo')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informacion del Vehiculo</CardTitle>
          <CardDescription>Completa los datos del nuevo vehiculo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="patente">Patente *</Label>
              <Input id="patente" {...register('patente')} placeholder="ABC123" className={errors.patente ? 'border-red-500' : ''} />
              {errors.patente && <p className="text-sm text-red-500 mt-1">{errors.patente.message}</p>}
            </div>

            <div>
              <Label htmlFor="tipo_vehiculo">Tipo de Vehiculo *</Label>
              <Select value={watch('tipo_vehiculo')} onValueChange={(value) => setValue('tipo_vehiculo', value as TipoVehiculo)}>
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
              {errors.tipo_vehiculo && <p className="text-sm text-red-500 mt-1">{errors.tipo_vehiculo.message}</p>}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="marca">Marca *</Label>
              <Input id="marca" {...register('marca')} placeholder="Toyota" className={errors.marca ? 'border-red-500' : ''} />
              {errors.marca && <p className="text-sm text-red-500 mt-1">{errors.marca.message}</p>}
            </div>

            <div>
              <Label htmlFor="modelo">Modelo *</Label>
              <Input id="modelo" {...register('modelo')} placeholder="Hilux" className={errors.modelo ? 'border-red-500' : ''} />
              {errors.modelo && <p className="text-sm text-red-500 mt-1">{errors.modelo.message}</p>}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="capacidad_kg">Capacidad (kg) *</Label>
              <Input id="capacidad_kg" type="number" step="0.01" min="0.01" {...register('capacidad_kg', { valueAsNumber: true })} placeholder="1000" className={errors.capacidad_kg ? 'border-red-500' : ''} />
              {errors.capacidad_kg && <p className="text-sm text-red-500 mt-1">{errors.capacidad_kg.message}</p>}
            </div>
            <div>
              <Label htmlFor="km_inicial">Km inicial</Label>
              <Input id="km_inicial" type="number" min="0" step="1" {...register('km_inicial', { setValueAs: (v) => v === '' ? undefined : Number(v) })} placeholder="0" />
              {errors.km_inicial && <p className="text-sm text-red-500 mt-1">{errors.km_inicial.message}</p>}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="fecha_vto_seguro">Vencimiento seguro</Label>
              <Input id="fecha_vto_seguro" type="date" {...register('fecha_vto_seguro')} />
            </div>
            <div>
              <Label htmlFor="fecha_vto_senasa">Vencimiento SENASA</Label>
              <Input id="fecha_vto_senasa" type="date" {...register('fecha_vto_senasa')} />
            </div>
            <div>
              <Label htmlFor="fecha_vto_vtv">Vencimiento VTV</Label>
              <Input id="fecha_vto_vtv" type="date" {...register('fecha_vto_vtv')} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="capacidad_tanque_litros">Capacidad tanque (L)</Label>
              <Input id="capacidad_tanque_litros" type="number" min="0" step="0.01" {...register('capacidad_tanque_litros', { setValueAs: (v) => v === '' ? undefined : Number(v) })} placeholder="80" />
              {errors.capacidad_tanque_litros && <p className="text-sm text-red-500 mt-1">{errors.capacidad_tanque_litros.message}</p>}
            </div>
            <div>
              <Label htmlFor="combustible_actual_litros">Combustible actual (L)</Label>
              <Input id="combustible_actual_litros" type="number" min="0" step="0.01" {...register('combustible_actual_litros', { setValueAs: (v) => v === '' ? undefined : Number(v) })} placeholder="20" />
              {errors.combustible_actual_litros && <p className="text-sm text-red-500 mt-1">{errors.combustible_actual_litros.message}</p>}
            </div>
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
              Creando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Crear Vehiculo
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
