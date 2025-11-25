'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Loader2, Save, Plus, Trash2, Search, X } from 'lucide-react'
import { crearPresupuestoAction } from '@/actions/presupuestos.actions'
import { useNotificationStore } from '@/store/notificationStore'
import { formatCurrency } from '@/lib/utils'

const crearPresupuestoSchema = z.object({
  cliente_id: z.string().uuid('Debes seleccionar un cliente'),
  zona_id: z.string().uuid().optional(),
  fecha_entrega_estimada: z.string().optional(),
  observaciones: z.string().optional(),
  items: z.array(z.object({
    producto_id: z.string().uuid('Debes seleccionar un producto'),
    cantidad_solicitada: z.number().positive('La cantidad debe ser mayor a 0'),
    precio_unit_est: z.number().positive('El precio debe ser mayor a 0'),
  })).min(1, 'Debes agregar al menos un producto'),
})

type CrearPresupuestoFormData = z.infer<typeof crearPresupuestoSchema>

interface PresupuestoFormProps {
  clientes: Array<{ id: string; nombre: string; telefono?: string; zona_entrega?: string }>
  productos: Array<{ id: string; codigo: string; nombre: string; precio_venta: number; unidad_medida: string; categoria?: string }>
  zonas: Array<{ id: string; nombre: string }>
}

export function PresupuestoForm({ clientes, productos, zonas }: PresupuestoFormProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(false)
  const [productoSearch, setProductoSearch] = useState<{ [key: number]: string }>({})
  const [productoDropdownOpen, setProductoDropdownOpen] = useState<{ [key: number]: boolean }>({})
  const [clienteSearch, setClienteSearch] = useState('')
  const [clienteDropdownOpen, setClienteDropdownOpen] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CrearPresupuestoFormData>({
    resolver: zodResolver(crearPresupuestoSchema),
    defaultValues: {
      fecha_entrega_estimada: new Date().toISOString().split('T')[0], // Fecha de hoy por defecto
      observaciones: '',
      items: [{ producto_id: '', cantidad_solicitada: 1, precio_unit_est: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  })

  const watchedItems = watch('items')
  const watchedCliente = watch('cliente_id')

  // Calcular total estimado
  const totalEstimado = watchedItems?.reduce((sum, item) => {
    return sum + (item.cantidad_solicitada * (item.precio_unit_est || 0))
  }, 0) || 0

  // Obtener cliente seleccionado
  const clienteSeleccionado = clientes.find(c => c.id === watchedCliente)

  // Actualizar precio cuando cambia el producto
  const handleProductoChange = (index: number, productoId: string) => {
    const producto = productos.find(p => p.id === productoId)
    if (producto) {
      setValue(`items.${index}.precio_unit_est`, producto.precio_venta)
    }
  }

  // Función para filtrar productos por búsqueda
  const getFilteredProductos = (index: number) => {
    const searchTerm = (productoSearch[index] || '').toLowerCase()
    if (!searchTerm) return productos
    return productos.filter(p => 
      p.codigo.toLowerCase().includes(searchTerm) ||
      p.nombre.toLowerCase().includes(searchTerm)
    )
  }

  // Función para filtrar clientes por búsqueda
  const getFilteredClientes = () => {
    const searchTerm = clienteSearch.toLowerCase()
    if (!searchTerm) return clientes
    return clientes.filter(c => 
      c.nombre.toLowerCase().includes(searchTerm) ||
      (c.telefono && c.telefono.includes(searchTerm)) ||
      (c.zona_entrega && c.zona_entrega.toLowerCase().includes(searchTerm))
    )
  }

  const addItem = () => {
    append({ producto_id: '', cantidad_solicitada: 1, precio_unit_est: 0 })
  }

  const removeItem = (index: number) => {
    if (fields.length > 1) {
      remove(index)
    }
  }

  const onSubmit = async (data: CrearPresupuestoFormData) => {
    try {
      setIsLoading(true)

      const formData = new FormData()
      formData.append('cliente_id', data.cliente_id)
      if (data.zona_id) {
        formData.append('zona_id', data.zona_id)
      }
      if (data.fecha_entrega_estimada) {
        formData.append('fecha_entrega_estimada', data.fecha_entrega_estimada)
      }
      if (data.observaciones) {
        formData.append('observaciones', data.observaciones)
      }
      formData.append('items', JSON.stringify(data.items))

      const result = await crearPresupuestoAction(formData)

      if (result.success) {
        showToast('success', result.message || 'Presupuesto creado exitosamente')
        const presupuestoId = result.data?.presupuesto_id
        if (presupuestoId) {
          // Redirigir directamente, el router.refresh() se encargará de cargar los datos
          router.push(`/ventas/presupuestos/${presupuestoId}`)
        } else {
          // Si no hay ID, redirigir a la lista de presupuestos
          router.push('/ventas/presupuestos')
        }
      } else {
        showToast('error', result.message || 'Error al crear presupuesto')
      }
    } catch (error: any) {
      console.error('Error creando presupuesto:', error)
      showToast('error', error.message || 'Error al crear presupuesto')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Información del Cliente */}
      <Card>
        <CardHeader>
          <CardTitle>Información del Cliente</CardTitle>
          <CardDescription>
            Selecciona el cliente para el presupuesto
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="cliente_id">Cliente *</Label>
            <Select
              value={watchedCliente || ''}
              onValueChange={(value) => {
                setValue('cliente_id', value)
                setClienteSearch('')
                setClienteDropdownOpen(false)
              }}
              onOpenChange={(open) => {
                setClienteDropdownOpen(open)
                if (!open) {
                  setClienteSearch('')
                }
              }}
            >
              <SelectTrigger id="cliente_id" className={errors.cliente_id ? 'border-red-500' : ''}>
                <SelectValue placeholder="Buscar por nombre, teléfono o zona..." />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <div className="sticky top-0 bg-background p-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar cliente..."
                      value={clienteSearch}
                      onChange={(e) => {
                        setClienteSearch(e.target.value)
                      }}
                      className="pl-8"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    {clienteSearch && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1 h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          setClienteSearch('')
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  {(() => {
                    const filtered = getFilteredClientes()
                    return filtered.length > 0 ? (
                      filtered.map((cliente) => (
                        <SelectItem key={cliente.id} value={cliente.id}>
                          {cliente.nombre} {cliente.telefono && `- ${cliente.telefono}`}
                          {cliente.zona_entrega && ` (${cliente.zona_entrega})`}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                        No se encontraron clientes
                      </div>
                    )
                  })()}
                </div>
              </SelectContent>
            </Select>
            {errors.cliente_id && (
              <p className="text-sm text-red-500 mt-1">{errors.cliente_id.message}</p>
            )}
          </div>

          {clienteSeleccionado && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Zona de Entrega</Label>
                <Select
                  value={watch('zona_id') || ''}
                  onValueChange={(value) => setValue('zona_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una zona" />
                  </SelectTrigger>
                  <SelectContent>
                    {zonas.map((zona) => (
                      <SelectItem key={zona.id} value={zona.id}>
                        {zona.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="fecha_entrega_estimada">Fecha de Entrega Estimada</Label>
                <Input
                  id="fecha_entrega_estimada"
                  type="date"
                  {...register('fecha_entrega_estimada')}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items del Presupuesto */}
      <Card>
        <CardHeader>
          <CardTitle>Productos</CardTitle>
          <CardDescription>
            Agrega los productos al presupuesto
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="grid gap-4 md:grid-cols-12 p-4 border rounded-lg">
              <div className="md:col-span-5">
                <Label>Producto *</Label>
                <div className="relative">
                  <Select
                    value={watchedItems?.[index]?.producto_id || ''}
                    onValueChange={(value) => {
                      setValue(`items.${index}.producto_id`, value)
                      handleProductoChange(index, value)
                      setProductoSearch(prev => ({ ...prev, [index]: '' }))
                      setProductoDropdownOpen(prev => ({ ...prev, [index]: false }))
                    }}
                    onOpenChange={(open) => {
                      setProductoDropdownOpen(prev => ({ ...prev, [index]: open }))
                      if (!open) {
                        setProductoSearch(prev => ({ ...prev, [index]: '' }))
                      }
                    }}
                  >
                    <SelectTrigger className={errors.items?.[index]?.producto_id ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Buscar por código o nombre..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <div className="sticky top-0 bg-background p-2 border-b">
                        <div className="relative">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Buscar producto..."
                            value={productoSearch[index] || ''}
                            onChange={(e) => {
                              setProductoSearch(prev => ({ ...prev, [index]: e.target.value }))
                            }}
                            className="pl-8"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          />
                          {productoSearch[index] && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-1 top-1 h-6 w-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                setProductoSearch(prev => ({ ...prev, [index]: '' }))
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="max-h-[200px] overflow-y-auto">
                        {(() => {
                          const filtered = getFilteredProductos(index)
                          return filtered.length > 0 ? (
                            filtered.map((producto) => (
                              <SelectItem key={producto.id} value={producto.id}>
                                {producto.codigo} - {producto.nombre} ({formatCurrency(producto.precio_venta)})
                              </SelectItem>
                            ))
                          ) : (
                            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                              No se encontraron productos
                            </div>
                          )
                        })()}
                      </div>
                    </SelectContent>
                  </Select>
                </div>
                {errors.items?.[index]?.producto_id && (
                  <p className="text-sm text-red-500 mt-1">{errors.items[index]?.producto_id?.message}</p>
                )}
              </div>

              <div className="md:col-span-3">
                <Label>Cantidad *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  {...register(`items.${index}.cantidad_solicitada`, { valueAsNumber: true })}
                  className={errors.items?.[index]?.cantidad_solicitada ? 'border-red-500' : ''}
                />
                {errors.items?.[index]?.cantidad_solicitada && (
                  <p className="text-sm text-red-500 mt-1">{errors.items[index]?.cantidad_solicitada?.message}</p>
                )}
              </div>

              <div className="md:col-span-3">
                <Label>Precio Unit. *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  {...register(`items.${index}.precio_unit_est`, { valueAsNumber: true })}
                  className={errors.items?.[index]?.precio_unit_est ? 'border-red-500' : ''}
                />
                {errors.items?.[index]?.precio_unit_est && (
                  <p className="text-sm text-red-500 mt-1">{errors.items[index]?.precio_unit_est?.message}</p>
                )}
              </div>

              <div className="md:col-span-1 flex items-end">
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          {errors.items && errors.items.root && (
            <p className="text-sm text-red-500">{errors.items.root.message}</p>
          )}

          <Button type="button" variant="outline" onClick={addItem} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Agregar Producto
          </Button>
        </CardContent>
      </Card>

      {/* Observaciones */}
      <Card>
        <CardHeader>
          <CardTitle>Observaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            {...register('observaciones')}
            rows={4}
            placeholder="Agregar notas o instrucciones especiales..."
          />
        </CardContent>
      </Card>

      {/* Resumen */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium">Total Estimado:</span>
            <span className="text-2xl font-bold text-primary">
              {formatCurrency(totalEstimado)}
            </span>
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
              Crear Presupuesto
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

