'use client'

import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { registrarDevolucionVentaAction } from '@/actions/pos-sucursal.actions'

const devolucionSchema = z.object({
  items: z.array(z.object({
    productoId: z.string().min(1, 'Selecciona un producto'),
    cantidad: z.number().min(0.001, 'Cantidad debe ser mayor a 0'),
    motivo: z.string().min(3, 'Motivo requerido'),
  })).min(1, 'Agrega al menos un producto a devolver'),
  observaciones: z.string().optional(),
})

type DevolucionFormData = z.infer<typeof devolucionSchema>

interface DevolucionVentaDialogProps {
  pedidoId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onDevolucionCompletada?: () => void
  productosPedido: Array<{
    productoId: string
    productoNombre: string
    productoCodigo: string
    cantidad: number
    precioUnitario: number
    subtotal: number
  }>
}

export function DevolucionVentaDialog({
  pedidoId,
  open,
  onOpenChange,
  onDevolucionCompletada,
  productosPedido,
}: DevolucionVentaDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<DevolucionFormData>({
    resolver: zodResolver(devolucionSchema),
    defaultValues: {
      items: [],
      observaciones: '',
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  })

  const watchedItems = form.watch('items')

  // Agregar producto a devolver
  const agregarProducto = () => {
    append({
      productoId: '',
      cantidad: 0,
      motivo: '',
    })
  }

  // Obtener cantidad máxima disponible para un producto
  const getCantidadMaxima = (productoId: string): number => {
    const producto = productosPedido.find(p => p.productoId === productoId)
    if (!producto) return 0

    // Restar cantidades ya agregadas a la devolución
    const cantidadYaDevuelta = watchedItems
      .filter(item => item.productoId === productoId)
      .reduce((sum, item) => sum + item.cantidad, 0)

    return Math.max(0, producto.cantidad - cantidadYaDevuelta)
  }

  async function onSubmit(data: DevolucionFormData) {
    // Validar cantidades
    for (const item of data.items) {
      const cantidadMax = getCantidadMaxima(item.productoId)
      if (item.cantidad > cantidadMax) {
        const producto = productosPedido.find(p => p.productoId === item.productoId)
        toast.error(`Cantidad excede lo vendido para ${producto?.productoNombre}. Máximo: ${cantidadMax}`)
        return
      }
    }

    setIsSubmitting(true)

    try {
      const result = await registrarDevolucionVentaAction({
        pedidoId,
        items: data.items.map(item => ({
          productoId: item.productoId,
          cantidad: item.cantidad,
          motivo: item.motivo,
        })),
        observaciones: data.observaciones,
      })

      if (result.success) {
        toast.success('Devolución registrada exitosamente. Stock y caja reintegrados.')
        form.reset()
        onDevolucionCompletada?.()
        onOpenChange(false)
      } else {
        toast.error(result.error || 'Error al registrar devolución')
      }
    } catch (error) {
      toast.error('Error inesperado al registrar devolución')
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Devolver Venta</DialogTitle>
          <DialogDescription>
            Selecciona los productos a devolver. El stock y el dinero se reintegrarán automáticamente.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Productos a devolver */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Productos a Devolver</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={agregarProducto}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Producto
                </Button>
              </div>

              {fields.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay productos agregados. Presiona "Agregar Producto" para comenzar.
                </p>
              ) : (
                fields.map((field, index) => {
                  const productoSeleccionado = productosPedido.find(
                    p => p.productoId === watchedItems[index]?.productoId
                  )
                  const cantidadMax = productoSeleccionado
                    ? getCantidadMaxima(watchedItems[index]?.productoId || '')
                    : 0

                  return (
                    <div key={field.id} className="p-3 border rounded-lg space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name={`items.${index}.productoId`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Producto</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar producto" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {productosPedido.map((prod) => (
                                    <SelectItem key={prod.productoId} value={prod.productoId}>
                                      {prod.productoNombre} ({prod.productoCodigo})
                                      <span className="text-muted-foreground ml-2">
                                        - Disponible: {prod.cantidad}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`items.${index}.cantidad`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                Cantidad (Máx: {cantidadMax})
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.001"
                                  min="0.001"
                                  max={cantidadMax}
                                  {...field}
                                  value={field.value || ''}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0
                                    field.onChange(Math.min(val, cantidadMax))
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name={`items.${index}.motivo`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Motivo de Devolución</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar motivo" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="defectuoso">Producto Defectuoso</SelectItem>
                                <SelectItem value="vencido">Producto Vencido</SelectItem>
                                <SelectItem value="mal_entregado">Mal Entregado</SelectItem>
                                <SelectItem value="no_solicitado">No Solicitado</SelectItem>
                                <SelectItem value="otro">Otro</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                          className="w-full"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Eliminar
                        </Button>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* Observaciones */}
            <FormField
              control={form.control}
              name="observaciones"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observaciones (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Notas adicionales sobre la devolución..."
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Botones */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || fields.length === 0}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  'Confirmar Devolución'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

