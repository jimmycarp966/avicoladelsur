'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Save, Package } from 'lucide-react'
import { actualizarPresupuestoAction } from '@/actions/presupuestos.actions'
import { useNotificationStore } from '@/store/notificationStore'

const editarPresupuestoSchema = z.object({
  observaciones: z.string().optional(),
  fecha_entrega_estimada: z.string().optional(),
})

type EditarPresupuestoFormData = z.infer<typeof editarPresupuestoSchema>

interface EditarPresupuestoFormProps {
  presupuesto: any
}

export function EditarPresupuestoForm({ presupuesto }: EditarPresupuestoFormProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditarPresupuestoFormData>({
    resolver: zodResolver(editarPresupuestoSchema),
    defaultValues: {
      observaciones: presupuesto.observaciones || '',
      fecha_entrega_estimada: presupuesto.fecha_entrega_estimada 
        ? presupuesto.fecha_entrega_estimada.split('T')[0] 
        : '',
    },
  })

  const onSubmit = async (data: EditarPresupuestoFormData) => {
    try {
      setIsLoading(true)

      const formData = new FormData()
      formData.append('presupuesto_id', presupuesto.id)
      if (data.observaciones !== undefined) {
        formData.append('observaciones', data.observaciones)
      }
      if (data.fecha_entrega_estimada) {
        formData.append('fecha_entrega_estimada', data.fecha_entrega_estimada)
      }

      const result = await actualizarPresupuestoAction(formData)

      if (result.success) {
        showToast('success', result.message || 'Presupuesto actualizado exitosamente')
        router.push(`/ventas/presupuestos/${presupuesto.id}`)
      } else {
        showToast('error', result.error || 'Error al actualizar presupuesto')
      }
    } catch (error: any) {
      console.error('Error actualizando presupuesto:', error)
      showToast('error', error.message || 'Error al actualizar presupuesto')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Información del Presupuesto */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Presupuesto</CardTitle>
            <CardDescription>
              Datos básicos del presupuesto {presupuesto.numero_presupuesto}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Número de Presupuesto</Label>
              <Input value={presupuesto.numero_presupuesto} disabled />
            </div>

            <div>
              <Label>Cliente</Label>
              <Input value={presupuesto.cliente?.nombre || 'N/A'} disabled />
            </div>

            <div>
              <Label>Estado</Label>
              <div className="mt-2">
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                  {presupuesto.estado}
                </Badge>
              </div>
            </div>

            <div>
              <Label>Total Estimado</Label>
              <Input 
                value={`$${Number(presupuesto.total_estimado || 0).toLocaleString('es-AR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}`} 
                disabled 
              />
            </div>
          </CardContent>
        </Card>

        {/* Campos Editables */}
        <Card>
          <CardHeader>
            <CardTitle>Editar Información</CardTitle>
            <CardDescription>
              Modifica los campos que necesites actualizar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="fecha_entrega_estimada">Fecha de Entrega Estimada</Label>
              <Input
                id="fecha_entrega_estimada"
                type="date"
                {...register('fecha_entrega_estimada')}
                className={errors.fecha_entrega_estimada ? 'border-red-500' : ''}
              />
              {errors.fecha_entrega_estimada && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.fecha_entrega_estimada.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                {...register('observaciones')}
                rows={6}
                placeholder="Agregar notas o instrucciones especiales..."
                className={errors.observaciones ? 'border-red-500' : ''}
              />
              {errors.observaciones && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.observaciones.message}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items del Presupuesto (Solo lectura) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Productos Incluidos
          </CardTitle>
          <CardDescription>
            Los items del presupuesto no se pueden modificar. Usa "Recalcular" para actualizar precios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {presupuesto.items?.map((item: any, index: number) => (
              <div
                key={item.id || index}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium">{item.producto?.nombre || 'Producto'}</p>
                  <p className="text-sm text-muted-foreground">
                    Cantidad: {Number(item.cantidad_solicitada).toFixed(2)} | 
                    Precio unit: ${Number(item.precio_unit_est || 0).toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    ${Number(item.subtotal_est || 0).toLocaleString('es-AR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </p>
                </div>
              </div>
            ))}
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
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Guardar Cambios
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
