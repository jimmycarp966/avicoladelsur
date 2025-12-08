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
import { actualizarLoteAction } from '@/actions/almacen.actions'
import { useNotificationStore } from '@/store/notificationStore'

const editarLoteSchema = z.object({
  fecha_vencimiento: z.string().optional(),
  proveedor: z.string().optional(),
  costo_unitario: z.number().optional(),
  ubicacion_almacen: z.string().optional(),
  numero_factura: z.string().optional(),
})

type EditarLoteFormData = z.infer<typeof editarLoteSchema>

interface EditarLoteFormProps {
  lote: any
  productos: Array<{ id: string; codigo: string; nombre: string; unidad_medida: string }>
}

export function EditarLoteForm({ lote, productos }: EditarLoteFormProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(false)

  const producto = lote.producto as any

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditarLoteFormData>({
    resolver: zodResolver(editarLoteSchema),
    defaultValues: {
      fecha_vencimiento: lote.fecha_vencimiento ? lote.fecha_vencimiento.split('T')[0] : '',
      proveedor: lote.proveedor || '',
      costo_unitario: lote.costo_unitario || 0,
      ubicacion_almacen: lote.ubicacion_almacen || '',
      numero_factura: lote.numero_factura || '',
    },
  })

  const onSubmit = async (data: EditarLoteFormData) => {
    try {
      setIsLoading(true)

      const updates: any = {}
      if (data.fecha_vencimiento) updates.fecha_vencimiento = data.fecha_vencimiento
      if (data.proveedor) updates.proveedor = data.proveedor
      if (data.costo_unitario !== undefined) updates.costo_unitario = data.costo_unitario
      if (data.ubicacion_almacen !== undefined) updates.ubicacion_almacen = data.ubicacion_almacen
      if (data.numero_factura !== undefined) updates.numero_factura = data.numero_factura

      const result = await actualizarLoteAction(lote.id, updates)

      if (result.success) {
        showToast('success', result.message || 'Lote actualizado exitosamente')
        router.push(`/almacen/lotes/${lote.id}`)
      } else {
        showToast('error', result.error || 'Error al actualizar lote')
      }
    } catch (error: any) {
      console.error('Error actualizando lote:', error)
      showToast('error', error.message || 'Error al actualizar lote')
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
            Modifica los datos del lote {lote.numero_lote}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Producto</Label>
            <Input
              value={producto?.nombre || 'N/A'}
              disabled
              className="bg-muted"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Código: {producto?.codigo || 'N/A'}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Cantidad Ingresada</Label>
              <Input
                value={lote.cantidad_ingresada}
                disabled
                className="bg-muted"
              />
              <p className="text-sm text-muted-foreground mt-1">
                {producto?.unidad_medida || 'unidades'}
              </p>
            </div>

            <div>
              <Label>Cantidad Disponible</Label>
              <Input
                value={lote.cantidad_disponible}
                disabled
                className="bg-muted"
              />
              <p className="text-sm text-muted-foreground mt-1">
                {producto?.unidad_medida || 'unidades'}
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="fecha_vencimiento">Fecha de Vencimiento</Label>
            <Input
              id="fecha_vencimiento"
              type="date"
              {...register('fecha_vencimiento')}
            />
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

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="ubicacion_almacen">Ubicación en Almacén</Label>
              <Input
                id="ubicacion_almacen"
                {...register('ubicacion_almacen')}
                placeholder="Ej: Estante A-1, Sector 3"
              />
            </div>

            <div>
              <Label htmlFor="numero_factura">Número de Factura</Label>
              <Input
                id="numero_factura"
                {...register('numero_factura')}
                placeholder="Número de factura"
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
              Actualizando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Actualizar Lote
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

