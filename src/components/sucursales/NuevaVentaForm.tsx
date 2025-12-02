'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
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
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Plus, Trash2, DollarSign, Package, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { registrarVentaSucursalAction } from '@/actions/sucursales.actions'

const ventaSchema = z.object({
  clienteId: z.string().min(1, 'Selecciona un cliente'),
  cajaId: z.string().min(1, 'Selecciona una caja'),
  metodoPago: z.enum(['efectivo', 'transferencia', 'tarjeta', 'cuenta_corriente']).refine(val => val, {
    message: 'Selecciona un método de pago'
  }),
  items: z.array(z.object({
    productoId: z.string().min(1, 'Selecciona un producto'),
    cantidad: z.number().min(0.001, 'Cantidad requerida'),
    precioUnitario: z.number().min(0, 'Precio requerido'),
  })).min(1, 'Agrega al menos un producto'),
})

type VentaFormData = {
  clienteId: string
  cajaId: string
  metodoPago: 'efectivo' | 'transferencia' | 'tarjeta' | 'cuenta_corriente'
  items: Array<{
    productoId: string
    cantidad: number
    precioUnitario: number
  }>
}

interface NuevaVentaFormProps {
  productos: Array<{
    id: string
    nombre: string
    codigo: string
    precioVenta: number
    unidadMedida: string
    stockDisponible: number
  }>
  clientes: Array<{
    id: string
    nombre: string
    apellido: string
    codigo: string
  }>
  cajas: Array<{
    id: string
    nombre: string
    saldo_actual: number
  }>
  sucursalId: string
}

export function NuevaVentaForm({ productos, clientes, cajas, sucursalId }: NuevaVentaFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [total, setTotal] = useState(0)

  const form = useForm<VentaFormData>({
    resolver: zodResolver(ventaSchema),
    defaultValues: {
      clienteId: '',
      cajaId: '',
      metodoPago: undefined,
      items: [{ productoId: '', cantidad: 1, precioUnitario: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  })

  // Calcular total cuando cambian los items
  const watchedItems = form.watch('items')
  React.useEffect(() => {
    const newTotal = watchedItems.reduce((sum, item) => {
      return sum + (item.cantidad * item.precioUnitario)
    }, 0)
    setTotal(newTotal)
  }, [watchedItems])

  const handleProductoChange = (index: number, productoId: string) => {
    const producto = productos.find(p => p.id === productoId)
    if (producto) {
      form.setValue(`items.${index}.precioUnitario`, producto.precioVenta)
      form.setValue(`items.${index}.cantidad`, 1) // Reset cantidad
    }
  }

  async function onSubmit(data: VentaFormData) {
    // Validar stock disponible
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i]
      const producto = productos.find(p => p.id === item.productoId)

      if (!producto) {
        toast.error(`Producto ${item.productoId} no encontrado`)
        return
      }

      if (item.cantidad > producto.stockDisponible) {
        toast.error(`Stock insuficiente para ${producto.nombre}. Disponible: ${producto.stockDisponible}`)
        return
      }
    }

    setIsSubmitting(true)

    try {
      // Preparar datos para la action
      const ventaData = {
        sucursalId,
        clienteId: data.clienteId,
        cajaId: data.cajaId,
        items: data.items.map(item => ({
          productoId: item.productoId,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
        })),
        pago: {
          metodoPago: data.metodoPago,
          montoTotal: total,
        }
      }

      const result = await registrarVentaSucursalAction(ventaData)

      if (result.success) {
        toast.success('Venta registrada exitosamente')
        form.reset()
        setTotal(0)
        // Recargar la página para actualizar las estadísticas
        window.location.reload()
      } else {
        toast.error(result.error || 'Error al registrar venta')
      }
    } catch (error) {
      toast.error('Error inesperado al registrar venta')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Información básica */}
        <div className="grid gap-4 md:grid-cols-3">
          <FormField
            control={form.control}
            name="clienteId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cliente</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cliente" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {clientes.map((cliente) => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.nombre} {cliente.apellido}
                        {cliente.codigo && ` (${cliente.codigo})`}
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
            name="cajaId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Caja</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar caja" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {cajas.map((caja) => (
                      <SelectItem key={caja.id} value={caja.id}>
                        {caja.nombre} - Saldo: ${caja.saldo_actual?.toFixed(2) || '0.00'}
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
            name="metodoPago"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Método de Pago</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar método" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                    <SelectItem value="cuenta_corriente">Cuenta Corriente</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Productos */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Productos</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ productoId: '', cantidad: 1, precioUnitario: 0 })}
            >
              <Plus className="w-4 h-4 mr-2" />
              Agregar Producto
            </Button>
          </div>

          {fields.map((field, index) => (
            <Card key={field.id}>
              <CardContent className="pt-4">
                <div className="grid gap-4 md:grid-cols-4 items-end">
                  <FormField
                    control={form.control}
                    name={`items.${index}.productoId`}
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Producto</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value)
                            handleProductoChange(index, value)
                          }}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar producto" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {productos.map((producto) => (
                              <SelectItem key={producto.id} value={producto.id}>
                                {producto.nombre}
                                {producto.codigo && ` (${producto.codigo})`}
                                <Badge variant="outline" className="ml-2">
                                  Stock: {producto.stockDisponible} {producto.unidadMedida}
                                </Badge>
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
                        <FormLabel>Cantidad</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-2">
                    <FormField
                      control={form.control}
                      name={`items.${index}.precioUnitario`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Precio Unit.</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        className="mb-2"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Subtotal del item */}
                <div className="mt-2 text-right text-sm text-muted-foreground">
                  Subtotal: ${(watchedItems[index]?.cantidad * watchedItems[index]?.precioUnitario || 0).toFixed(2)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator />

        {/* Total y botón de submit */}
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Total: ${total.toFixed(2)}
          </div>

          <Button type="submit" disabled={isSubmitting} size="lg">
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isSubmitting ? 'Procesando...' : 'Registrar Venta'}
          </Button>
        </div>
      </form>
    </Form>
  )
}

// Necesario para useEffect
import React from 'react'
