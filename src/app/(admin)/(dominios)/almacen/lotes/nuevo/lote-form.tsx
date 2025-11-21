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
import { ingresarMercaderia } from '@/actions/almacen.actions'
import { useNotificationStore } from '@/store/notificationStore'

const crearLoteSchema = z.object({
  producto_id: z.string().uuid('Debes seleccionar un producto'),
  cantidad: z.number().positive('La cantidad debe ser mayor a 0'),
  fecha_vencimiento: z.string().optional(),
  proveedor: z.string().optional(),
  costo_unitario: z.number().optional(),
  ubicacion_almacen: z.string().optional(),
})

type CrearLoteFormData = z.infer<typeof crearLoteSchema>

interface LoteFormProps {
  productos: Array<{ id: string; codigo: string; nombre: string; unidad_medida: string }>
}

export function LoteForm({ productos }: LoteFormProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CrearLoteFormData>({
    resolver: zodResolver(crearLoteSchema),
    defaultValues: {
      cantidad: 0,
      fecha_vencimiento: '',
      proveedor: '',
      costo_unitario: 0,
      ubicacion_almacen: '',
    },
  })

  const productoSeleccionado = watch('producto_id')
  const producto = productos.find(p => p.id === productoSeleccionado)

  const onSubmit = async (data: CrearLoteFormData) => {
    try {
      setIsLoading(true)

      const result = await ingresarMercaderia({
        producto_id: data.producto_id,
        cantidad: data.cantidad,
        fecha_vencimiento: data.fecha_vencimiento || undefined,
        proveedor: data.proveedor || undefined,
        costo_unitario: data.costo_unitario || undefined,
        ubicacion_almacen: data.ubicacion_almacen || undefined,
      })

      if (result.success) {
        showToast('success', result.message || 'Lote creado exitosamente')
        router.push('/almacen/lotes')
      } else {
        showToast('error', result.error || 'Error al crear lote')
      }
    } catch (error: any) {
      console.error('Error creando lote:', error)
      showToast('error', error.message || 'Error al crear lote')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información del Lote</CardTitle>
          <CardDescription>
            Completa los datos del nuevo lote de mercadería
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="producto_id">Producto *</Label>
            <Select
              value={watch('producto_id') || ''}
              onValueChange={(value) => setValue('producto_id', value)}
            >
              <SelectTrigger id="producto_id" className={errors.producto_id ? 'border-red-500' : ''}>
                <SelectValue placeholder="Selecciona un producto" />
              </SelectTrigger>
              <SelectContent>
                {productos.map((producto) => (
                  <SelectItem key={producto.id} value={producto.id}>
                    {producto.codigo} - {producto.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.producto_id && (
              <p className="text-sm text-red-500 mt-1">{errors.producto_id.message}</p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="cantidad">
                Cantidad * ({producto?.unidad_medida || 'unidad'})
              </Label>
              <Input
                id="cantidad"
                type="number"
                step="0.01"
                min="0.01"
                {...register('cantidad', { valueAsNumber: true })}
                className={errors.cantidad ? 'border-red-500' : ''}
              />
              {errors.cantidad && (
                <p className="text-sm text-red-500 mt-1">{errors.cantidad.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="fecha_vencimiento">Fecha de Vencimiento</Label>
              <Input
                id="fecha_vencimiento"
                type="date"
                {...register('fecha_vencimiento')}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="proveedor">Proveedor</Label>
              <Input
                id="proveedor"
                {...register('proveedor')}
                placeholder="Nombre del proveedor"
              />
            </div>

            <div>
              <Label htmlFor="costo_unitario">Costo Unitario</Label>
              <Input
                id="costo_unitario"
                type="number"
                step="0.01"
                min="0"
                {...register('costo_unitario', { valueAsNumber: true })}
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="ubicacion_almacen">Ubicación en Almacén</Label>
            <Input
              id="ubicacion_almacen"
              {...register('ubicacion_almacen')}
              placeholder="Ej: Estante A-1, Sector 3"
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
              Creando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Crear Lote
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

