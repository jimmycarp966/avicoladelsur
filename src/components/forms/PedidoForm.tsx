'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Loader2, Save, Plus, Trash2, Search } from 'lucide-react'
import Link from 'next/link'
import { crearPedidoSchema, type CrearPedidoFormData } from '@/lib/schemas/pedidos.schema'
import { useNotificationStore } from '@/store/notificationStore'
import { formatCurrency } from '@/lib/utils'


interface PedidoFormProps {
  pedido?: {
    id: string
    numero_pedido: string
    cliente_id: string
    fecha_entrega_estimada?: string
    observaciones?: string
    items?: Array<{
      producto_id: string
      cantidad: number
      precio_unitario: number
    }>
  }
  onSuccess?: () => void
}

export function PedidoForm({ pedido, onSuccess }: PedidoFormProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(false)
  const [clientes, setClientes] = useState<any[]>([])
  const [productos, setProductos] = useState<any[]>([])
  const [selectedCliente, setSelectedCliente] = useState<any>(null)
  const [clienteBloqueado, setClienteBloqueado] = useState(false)
  const [loadingCliente, setLoadingCliente] = useState(false)

  const isEditing = !!pedido

  // Cargar clientes y productos reales
  useEffect(() => {
    const fetchClientes = async () => {
      try {
        const { obtenerClientesAction } = await import('@/actions/ventas.actions')
        const result = await obtenerClientesAction()
        if (result.success && result.data) {
          setClientes(Array.isArray(result.data) ? result.data : [])
        }
      } catch (error) {
        console.error('Error al cargar clientes:', error)
      }
    }

    const fetchProductos = async () => {
      try {
        const { obtenerProductosAction } = await import('@/actions/almacen.actions')
        const result = await obtenerProductosAction()
        if (result.success && result.data) {
          setProductos(Array.isArray(result.data) ? result.data : [])
        }
      } catch (error) {
        console.error('Error al cargar productos:', error)
      }
    }

    fetchClientes()
    fetchProductos()
  }, [])

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CrearPedidoFormData>({
    resolver: zodResolver(crearPedidoSchema) as any,
    defaultValues: pedido ? {
      cliente_id: pedido.cliente_id,
      fecha_entrega_estimada: pedido.fecha_entrega_estimada ? pedido.fecha_entrega_estimada.split('T')[0] : undefined,
      descuento: 0,
      observaciones: pedido.observaciones || undefined,
      items: pedido.items?.map(item => ({
        producto_id: item.producto_id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
      })) || [{ producto_id: '', cantidad: 1 }],
    } : {
      fecha_entrega_estimada: undefined,
      descuento: 0,
      observaciones: undefined,
      items: [{ producto_id: '', cantidad: 1 }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  })

  const watchedItems = watch('items')
  const watchedCliente = watch('cliente_id')

  // Calcular total
  const total = watchedItems?.reduce((sum, item) => {
    return sum + (item.cantidad * (item.precio_unitario || 0))
  }, 0) || 0

  // Actualizar cliente seleccionado y verificar bloqueo
  useEffect(() => {
    if (!watchedCliente) {
      setSelectedCliente(null)
      setClienteBloqueado(false)
      return
    }

    const cliente = clientes.find(c => c.id === watchedCliente)
    setSelectedCliente(cliente)

    // Verificar si el cliente está bloqueado
    if (cliente) {
      setLoadingCliente(true)
      fetch(`/api/cuentas_corrientes?clienteId=${cliente.id}`)
        .then(res => res.json())
        .then(result => {
          if (result.success && result.data && result.data.length > 0) {
            const cuenta = result.data[0]
            const clienteInfo = cuenta.clientes
            if (clienteInfo?.bloqueado_por_deuda) {
              setClienteBloqueado(true)
              showToast('warning', 'Este cliente está bloqueado por deuda pendiente')
            } else {
              setClienteBloqueado(false)
            }
          } else {
            setClienteBloqueado(false)
          }
        })
        .catch(error => {
          console.error('Error al verificar estado del cliente:', error)
          setClienteBloqueado(false)
        })
        .finally(() => {
          setLoadingCliente(false)
        })
    }
  }, [watchedCliente, clientes, showToast])

  // Actualizar precio cuando cambia el producto
  const handleProductoChange = (index: number, productoId: string) => {
    const producto = productos.find(p => p.id === productoId)
    if (producto) {
      setValue(`items.${index}.precio_unitario`, producto.precio_venta)
    }
  }

  const addItem = () => {
    append({ producto_id: '', cantidad: 1, precio_unitario: 0 })
  }

  const removeItem = (index: number) => {
    if (fields.length > 1) {
      remove(index)
    }
  }

  const onSubmit = async (data: CrearPedidoFormData) => {
    try {
      setIsLoading(true)

      // Validar que el cliente no esté bloqueado
      if (clienteBloqueado) {
        showToast('error', 'No se puede crear un pedido para un cliente bloqueado por deuda')
        return
      }

      // Validar que todos los items tengan producto seleccionado
      const itemsInvalidos = data.items.filter(item => !item.producto_id)
      if (itemsInvalidos.length > 0) {
        showToast('error', 'Todos los items deben tener un producto seleccionado')
        return
      }

      const { crearPedidoAction } = await import('@/actions/ventas.actions')
      
      const result = await crearPedidoAction({
        cliente_id: data.cliente_id,
        items: data.items.map(item => ({
          producto_id: item.producto_id,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
        })),
        fecha_entrega_estimada: data.fecha_entrega_estimada,
        descuento: data.descuento,
        observaciones: data.observaciones,
        pago: (data as any).pago ? {
          modalidad: (data as any).pago.modalidad,
          monto: (data as any).pago.monto,
          caja_id: (data as any).pago.caja_id,
          tipo_pago: (data as any).pago.tipo_pago,
        } : undefined,
      })

      if (!result.success) {
        throw new Error(result.error || 'Error al guardar pedido')
      }

      showToast('success', result.message || 'Pedido creado exitosamente')

      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/almacen/pedidos')
      }
    } catch (error: any) {
      console.error('Error saving pedido:', error)
      showToast('error', error.message || 'Error al guardar pedido')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Información del pedido */}
      <Card className="border-l-[3px] border-l-primary">
        <CardHeader>
          <CardTitle className="text-primary">Información del Pedido</CardTitle>
          <CardDescription>
            Detalles básicos del pedido
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Cliente *</label>
              <Select
                value={watchedCliente}
                onValueChange={(value) => setValue('cliente_id', value)}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente.id} value={cliente.id}>
                      {cliente.codigo && `[${cliente.codigo}] `}
                      {cliente.nombre} - Zona: {cliente.zona_entrega}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.cliente_id && (
                <p className="text-sm text-destructive">{errors.cliente_id.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha de Entrega Estimada</label>
              <Input
                type="date"
                {...register('fecha_entrega_estimada')}
                disabled={isLoading}
                min={new Date().toISOString().split('T')[0]}
              />
              {errors.fecha_entrega_estimada && (
                <p className="text-sm text-destructive">{errors.fecha_entrega_estimada.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Observaciones</label>
            <Textarea
              placeholder="Observaciones especiales del pedido..."
              rows={3}
              {...register('observaciones')}
              disabled={isLoading}
            />
            {errors.observaciones && (
              <p className="text-sm text-destructive">{errors.observaciones.message}</p>
            )}
          </div>

          {selectedCliente && (
            <div className={`p-4 rounded-lg border ${
              clienteBloqueado 
                ? 'bg-destructive/10 border-destructive' 
                : 'bg-blue-50 border-blue-200'
            }`}>
              <h4 className={`font-medium mb-2 ${
                clienteBloqueado ? 'text-destructive' : 'text-blue-900'
              }`}>
                Cliente Seleccionado
                {loadingCliente && (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin inline" />
                )}
              </h4>
              {clienteBloqueado ? (
                <div className="space-y-2">
                  <p className="text-sm text-destructive font-medium">
                    ⚠️ Este cliente está bloqueado por deuda pendiente
                  </p>
                  <p className="text-xs text-muted-foreground">
                    No se pueden crear nuevos pedidos hasta que se regularice la cuenta corriente.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className={clienteBloqueado ? 'text-destructive' : 'text-blue-700'}>Nombre:</span> {selectedCliente.nombre}
                  </div>
                  <div>
                    <span className={clienteBloqueado ? 'text-destructive' : 'text-blue-700'}>Zona:</span> {selectedCliente.zona_entrega}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items del pedido */}
      <Card className="border-l-[3px] border-l-success">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-success">Productos del Pedido</CardTitle>
              <CardDescription>
                Agrega los productos que incluye este pedido
              </CardDescription>
            </div>
            <Button type="button" onClick={addItem} disabled={isLoading}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar Producto
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {fields.map((field, index) => {
              const selectedProducto = productos.find(p => p.id === watchedItems?.[index]?.producto_id)
              const subtotal = (watchedItems?.[index]?.cantidad || 0) * (watchedItems?.[index]?.precio_unitario || 0)

              return (
                <div key={field.id} className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Producto {index + 1}</h4>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeItem(index)}
                        disabled={isLoading}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Producto *</label>
                      <Select
                        value={watchedItems?.[index]?.producto_id || ''}
                        onValueChange={(value) => {
                          setValue(`items.${index}.producto_id`, value)
                          handleProductoChange(index, value)
                        }}
                        disabled={isLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar producto" />
                        </SelectTrigger>
                        <SelectContent>
                          {productos.map((producto) => (
                            <SelectItem key={producto.id} value={producto.id}>
                              {producto.nombre} ({producto.codigo})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Cantidad *</label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        {...register(`items.${index}.cantidad`, { valueAsNumber: true })}
                        disabled={isLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Precio Unitario</label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...register(`items.${index}.precio_unitario`, { valueAsNumber: true })}
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  {selectedProducto && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                      <div className="text-sm">
                        <span className="font-medium">{selectedProducto.nombre}</span>
                        <span className="text-muted-foreground ml-2">
                          ({selectedProducto.unidad_medida})
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          Subtotal: {formatCurrency(subtotal)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Resumen del pedido */}
      <Card className="border-l-[3px] border-l-info">
        <CardHeader>
          <CardTitle className="text-info">Resumen del Pedido</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center text-lg font-semibold">
              <span>Total del Pedido:</span>
              <span className="text-success">{formatCurrency(total)}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Productos:</span> {watchedItems?.length || 0}
              </div>
              <div>
                <span className="text-muted-foreground">Items totales:</span> {watchedItems?.reduce((sum, item) => sum + (item.cantidad || 0), 0) || 0}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Acciones */}
      <div className="flex items-center justify-between sticky bottom-4 bg-background/95 backdrop-blur-sm p-4 rounded-lg border border-primary/10 shadow-lg">
        <Button type="button" variant="outline" asChild disabled={isLoading} className="hover:bg-primary/5 hover:text-primary hover:border-primary/30">
          <Link href="/almacen/pedidos">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>

        <Button 
          type="submit" 
          disabled={isLoading || clienteBloqueado || loadingCliente} 
          className="bg-primary hover:bg-primary/90 shadow-sm"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isEditing ? 'Actualizando...' : 'Creando...'}
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {isEditing ? 'Actualizar Pedido' : 'Crear Pedido'}
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
