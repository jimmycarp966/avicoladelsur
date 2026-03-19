'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Save, Package } from 'lucide-react'
import { actualizarPresupuestoAction } from '@/actions/presupuestos.actions'
import { useNotificationStore } from '@/store/notificationStore'

const editarPresupuestoSchema = z.object({
  fecha_entrega_estimada: z.string().optional(),
  turno: z.enum(['mañana', 'tarde']).optional(),
})

type EditarPresupuestoFormData = z.infer<typeof editarPresupuestoSchema>

interface EditarPresupuestoFormProps {
  presupuesto: any
}

function normalizarTurno(value?: string | null): 'mañana' | 'tarde' {
  if (!value) return 'mañana'
  const cleaned = value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return cleaned === 'tarde' ? 'tarde' : 'mañana'
}

export function EditarPresupuestoForm({ presupuesto }: EditarPresupuestoFormProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EditarPresupuestoFormData>({
    resolver: zodResolver(editarPresupuestoSchema),
    defaultValues: {
      fecha_entrega_estimada: presupuesto.fecha_entrega_estimada
        ? String(presupuesto.fecha_entrega_estimada).split('T')[0]
        : '',
      turno: normalizarTurno(presupuesto.turno),
    },
  })

  const onSubmit = async (data: EditarPresupuestoFormData) => {
    try {
      setIsLoading(true)

      const formData = new FormData()
      formData.append('presupuesto_id', presupuesto.id)
      if (data.fecha_entrega_estimada) {
        formData.append('fecha_entrega_estimada', data.fecha_entrega_estimada)
      }
      if (data.turno) {
        formData.append('turno', data.turno)
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
        <Card className="border-l-[3px] border-l-primary">
          <CardHeader>
            <CardTitle className="text-primary">Información del Presupuesto</CardTitle>
            <CardDescription>Datos básicos del presupuesto {presupuesto.numero_presupuesto}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Número de Presupuesto</Label>
              <Input value={presupuesto.numero_presupuesto} disabled />
            </div>

            <div className="space-y-2">
              <Label>Cliente</Label>
              <Input value={presupuesto.cliente?.nombre || 'N/A'} disabled />
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <div className="mt-2">
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                  {presupuesto.estado}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Total Estimado</Label>
              <Input
                value={`$${Number(presupuesto.total_estimado || 0).toLocaleString('es-AR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`}
                disabled
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-[3px] border-l-success">
          <CardHeader>
            <CardTitle className="text-success">Edicion de Entrega</CardTitle>
            <CardDescription>Solo se permite cambiar fecha y turno. La zona queda bloqueada.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fecha_entrega_estimada">Fecha de Entrega</Label>
              <Input id="fecha_entrega_estimada" type="date" {...register('fecha_entrega_estimada')} />
              {errors.fecha_entrega_estimada && (
                <p className="text-sm text-destructive">{errors.fecha_entrega_estimada.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="turno">Turno de Entrega</Label>
              <Select
                value={watch('turno') || ''}
                onValueChange={(value) => setValue('turno', value as 'mañana' | 'tarde')}
              >
                <SelectTrigger id="turno">
                  <SelectValue placeholder="Seleccionar turno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mañana">Mañana</SelectItem>
                  <SelectItem value="tarde">Tarde</SelectItem>
                </SelectContent>
              </Select>
              {errors.turno && <p className="text-sm text-destructive">{errors.turno.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Zona de Entrega (bloqueada)</Label>
              <Input value={presupuesto.zona?.nombre || 'Sin zona asignada'} disabled />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-l-[3px] border-l-info">
        <CardHeader>
          <CardTitle className="text-info flex items-center gap-2">
            <Package className="h-5 w-5" />
            Productos Incluidos
          </CardTitle>
          <CardDescription>Los items del presupuesto no se pueden modificar desde esta pantalla.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {presupuesto.items?.map((item: any, index: number) => (
              <div
                key={item.id || index}
                className="flex items-center justify-between p-4 border rounded-lg bg-muted/30"
              >
                <div className="flex-1">
                  <p className="font-medium">{item.producto?.nombre || 'Producto'}</p>
                  <p className="text-sm text-muted-foreground">
                    Cantidad: {Number(item.cantidad_solicitada).toFixed(2)} | Precio unit: $
                    {Number(item.precio_unit_est || 0).toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    ${Number(item.subtotal_est || 0).toLocaleString('es-AR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-4 sticky bottom-4 bg-background/95 backdrop-blur-md p-4 rounded-xl border border-border shadow-lg shadow-black/10 -mx-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isLoading}
          className="hover:bg-primary/5 hover:text-primary hover:border-primary/30 w-full sm:w-auto order-2 sm:order-1"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all w-full sm:w-auto order-1 sm:order-2"
        >
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
