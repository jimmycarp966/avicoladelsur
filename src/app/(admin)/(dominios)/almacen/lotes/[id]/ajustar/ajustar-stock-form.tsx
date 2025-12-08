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
import { Loader2, Save, AlertTriangle } from 'lucide-react'
import { ajustarStockAction } from '@/actions/almacen.actions'
import { useNotificationStore } from '@/store/notificationStore'

const ajustarStockSchema = z.object({
  tipo_movimiento: z.enum(['ingreso', 'salida', 'ajuste'], {
    message: 'Debes seleccionar un tipo de movimiento',
  }),
  cantidad: z.number().positive('La cantidad debe ser mayor a 0'),
  motivo: z.string().min(1, 'El motivo es requerido'),
  observaciones: z.string().optional(),
})

type AjustarStockFormData = z.infer<typeof ajustarStockSchema>

interface AjustarStockFormProps {
  lote: any
}

export function AjustarStockForm({ lote }: AjustarStockFormProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(false)

  const producto = lote.producto as any

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AjustarStockFormData>({
    resolver: zodResolver(ajustarStockSchema),
    defaultValues: {
      tipo_movimiento: 'ajuste',
      cantidad: 0,
      motivo: '',
      observaciones: '',
    },
  })

  const tipoMovimiento = watch('tipo_movimiento')
  const cantidad = watch('cantidad')

  // Calcular nueva cantidad disponible
  const nuevaCantidadDisponible = (() => {
    if (!cantidad || cantidad <= 0) return lote.cantidad_disponible
    if (tipoMovimiento === 'ingreso') {
      return lote.cantidad_disponible + cantidad
    } else if (tipoMovimiento === 'salida' || tipoMovimiento === 'ajuste') {
      return Math.max(0, lote.cantidad_disponible - cantidad)
    }
    return lote.cantidad_disponible
  })()

  const onSubmit = async (data: AjustarStockFormData) => {
    try {
      setIsLoading(true)

      // Validar que no se ajuste a negativo
      if ((data.tipo_movimiento === 'salida' || data.tipo_movimiento === 'ajuste') && nuevaCantidadDisponible < 0) {
        showToast('error', 'No hay suficiente stock disponible para este ajuste')
        setIsLoading(false)
        return
      }

      const result = await ajustarStockAction({
        lote_id: lote.id,
        tipo_movimiento: data.tipo_movimiento,
        cantidad: data.cantidad,
        motivo: data.motivo + (data.observaciones ? ` - ${data.observaciones}` : ''),
      })

      if (result.success) {
        showToast('success', result.message || 'Stock ajustado exitosamente')
        router.push(`/almacen/lotes/${lote.id}`)
      } else {
        showToast('error', result.error || 'Error al ajustar stock')
      }
    } catch (error: any) {
      console.error('Error ajustando stock:', error)
      showToast('error', error.message || 'Error al ajustar stock')
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
            Lote {lote.numero_lote} - {producto?.nombre || 'Producto'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
              <Label>Cantidad Disponible Actual</Label>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ajuste de Stock</CardTitle>
          <CardDescription>
            Registra un movimiento de stock para este lote
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="tipo_movimiento">Tipo de Movimiento *</Label>
            <Select
              value={watch('tipo_movimiento')}
              onValueChange={(value) => {
                setValue('tipo_movimiento', value as 'ingreso' | 'salida' | 'ajuste')
              }}
            >
              <SelectTrigger id="tipo_movimiento" className={errors.tipo_movimiento ? 'border-red-500' : ''}>
                <SelectValue placeholder="Selecciona un tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ingreso">Ingreso (Aumentar stock)</SelectItem>
                <SelectItem value="salida">Salida (Disminuir stock)</SelectItem>
                <SelectItem value="ajuste">Ajuste (Corrección)</SelectItem>
              </SelectContent>
            </Select>
            {errors.tipo_movimiento && (
              <p className="text-sm text-red-500 mt-1">{errors.tipo_movimiento.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="cantidad">
              Cantidad * ({producto?.unidad_medida || 'unidades'})
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

          {cantidad > 0 && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Nueva Cantidad Disponible</Label>
              </div>
              <p className={`text-lg font-bold ${nuevaCantidadDisponible < 0 ? 'text-destructive' : ''}`}>
                {nuevaCantidadDisponible.toFixed(2)} {producto?.unidad_medida || 'unidades'}
              </p>
              {nuevaCantidadDisponible < 0 && (
                <p className="text-sm text-destructive mt-1">
                  No hay suficiente stock disponible para este ajuste
                </p>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="motivo">Motivo *</Label>
            <Input
              id="motivo"
              {...register('motivo')}
              placeholder="Ej: Pérdida por rotura, Corrección de inventario, etc."
              className={errors.motivo ? 'border-red-500' : ''}
            />
            {errors.motivo && (
              <p className="text-sm text-red-500 mt-1">{errors.motivo.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="observaciones">Observaciones</Label>
            <Textarea
              id="observaciones"
              {...register('observaciones')}
              placeholder="Detalles adicionales sobre el ajuste..."
              rows={3}
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
        <Button
          type="submit"
          disabled={isLoading || nuevaCantidadDisponible < 0}
          className="bg-primary hover:bg-primary/90"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Ajustando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Ajustar Stock
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

