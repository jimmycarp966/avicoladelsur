'use client'

import { useState, useMemo, useCallback, memo } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DateInput } from '@/components/ui/date-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Loader2, Save, Plus, Trash2, Search, X } from 'lucide-react'
import { crearPresupuestoAction } from '@/actions/presupuestos.actions'
import { obtenerTodasListasActivasAction, obtenerPrecioProductoAction } from '@/actions/listas-precios.actions'
import { useNotificationStore } from '@/store/notificationStore'
import { formatCurrency } from '@/lib/utils'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { useFocusField } from '@/lib/hooks/useFocusField'
import { useFormContextShortcuts } from '@/lib/hooks/useFormContextShortcuts'
import { KeyboardHintCompact } from '@/components/ui/keyboard-hint'
import { ProductoItemRow } from './producto-item-row'
import { useEffect, useRef } from 'react'

const crearPresupuestoSchema = z.object({
  cliente_id: z.string().uuid('Debes seleccionar un cliente'),
  zona_id: z.string().uuid().optional(),
  fecha_entrega_estimada: z.string().optional(),
  observaciones: z.string().optional(),
  lista_precio_id: z.string().uuid().optional(), // Lista global (por defecto para todos los productos)
  items: z.array(z.object({
    producto_id: z.string().uuid('Debes seleccionar un producto'),
    cantidad_solicitada: z.number().positive('La cantidad debe ser mayor a 0'),
    precio_unit_est: z.number().positive('El precio debe ser mayor a 0'),
    lista_precio_id: z.string().uuid().optional(), // Lista individual por producto
  })).min(1, 'Debes agregar al menos un producto'),
})

type CrearPresupuestoFormData = z.infer<typeof crearPresupuestoSchema>

interface PresupuestoFormProps {
  clientes: Array<{ id: string; nombre: string; codigo?: string; telefono?: string; zona_entrega?: string }>
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
  const [todasListas, setTodasListas] = useState<Array<{ id: string; codigo: string; nombre: string; tipo: string; margen_ganancia: number | null }>>([])
  const [cargandoListas, setCargandoListas] = useState(false)
  const agregarProductoButtonRef = useRef<HTMLButtonElement>(null)
  
  // Estado para listas por producto (index -> lista_id)
  const [listasPorProducto, setListasPorProducto] = useState<Record<number, string>>({})

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
      items: [{ producto_id: '', cantidad_solicitada: 1, precio_unit_est: 0, lista_precio_id: undefined }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  })

  // Optimizar watch usando useWatch para mejor rendimiento
  const watchedItems = useWatch({ control, name: 'items' })
  const watchedCliente = useWatch({ control, name: 'cliente_id' })

  // Debouncing para búsquedas (solo para cliente, productos se manejan individualmente)
  const debouncedClienteSearch = useDebounce(clienteSearch, 300)

  // Memoizar total estimado
  const totalEstimado = useMemo(() => {
    return watchedItems?.reduce((sum, item) => {
      return sum + (item.cantidad_solicitada * (item.precio_unit_est || 0))
    }, 0) || 0
  }, [watchedItems])

  // Memoizar cliente seleccionado
  const clienteSeleccionado = useMemo(() => {
    return clientes.find(c => c.id === watchedCliente)
  }, [clientes, watchedCliente])

  // Atajos contextuales para el formulario
  useFormContextShortcuts({
    shortcuts: [
      {
        key: 'c',
        fieldId: 'cliente_id',
        description: 'Enfocar Cliente',
        action: () => {
          const element = document.getElementById('cliente_id')
          if (element) {
            element.click()
            setTimeout(() => {
              const searchInput = document.querySelector('[role="listbox"] input[type="text"]')
              if (searchInput instanceof HTMLInputElement) {
                searchInput.focus()
                searchInput.select()
              }
            }, 150)
          }
        },
      },
      {
        key: 'p',
        fieldId: 'producto_0',
        description: 'Enfocar primer Producto',
        action: () => {
          // Buscar el primer campo de producto disponible
          const firstProductSelect = document.querySelector('[data-product-index="0"]') as HTMLElement
          if (firstProductSelect) {
            firstProductSelect.click()
            setTimeout(() => {
              const searchInput = document.querySelector('[role="listbox"] input[type="text"]')
              if (searchInput instanceof HTMLInputElement) {
                searchInput.focus()
                searchInput.select()
              }
            }, 150)
          }
        },
      },
      {
        key: 'a',
        description: 'Agregar Producto',
        action: () => {
          agregarProductoButtonRef.current?.click()
        },
      },
      {
        key: 'l',
        fieldId: 'lista_precio_id',
        description: 'Enfocar Lista de Precios',
      },
      {
        key: 'f',
        fieldId: 'fecha_entrega_estimada',
        description: 'Enfocar Fecha de Entrega',
      },
      {
        key: 'z',
        fieldId: 'zona_id',
        description: 'Enfocar Zona de Entrega',
      },
      {
        key: 'o',
        fieldId: 'observaciones',
        description: 'Enfocar Observaciones',
      },
    ],
  })

  // Cargar todas las listas activas disponibles
  useEffect(() => {
    const cargarListas = async () => {
      setCargandoListas(true)
      const result = await obtenerTodasListasActivasAction()
      if (result.success && result.data) {
        setTodasListas(result.data as any)
      } else {
        console.warn('[PRESUPUESTO FORM] Error al cargar listas:', result.error)
        setTodasListas([])
      }
      setCargandoListas(false)
    }

    cargarListas()
  }, [])

  // Actualizar precios cuando cambia la lista global o lista por producto
  const watchedListaPrecioGlobal = useWatch({ control, name: 'lista_precio_id' })
  
  useEffect(() => {
    const actualizarPrecios = async () => {
      if (!watchedItems) return

      for (let i = 0; i < watchedItems.length; i++) {
        const item = watchedItems[i]
        if (!item.producto_id) continue

        // Usar lista individual si existe, sino usar lista global
        const listaId = listasPorProducto[i] || watchedListaPrecioGlobal
        if (!listaId) continue

        const precioResult = await obtenerPrecioProductoAction(listaId, item.producto_id)
        if (precioResult.success && precioResult.data) {
          setValue(`items.${i}.precio_unit_est`, precioResult.data.precio, { 
            shouldValidate: true,
            shouldDirty: true 
          })
          // Actualizar también la lista_precio_id del item si se calculó desde lista global
          if (!listasPorProducto[i] && watchedListaPrecioGlobal) {
            setValue(`items.${i}.lista_precio_id`, watchedListaPrecioGlobal, { shouldDirty: false })
          }
        }
      }
    }

    actualizarPrecios()
  }, [watchedListaPrecioGlobal, listasPorProducto, setValue, watchedItems])

  // Memoizar handleProductoChange
  const handleProductoChange = useCallback(async (index: number, productoId: string) => {
    const producto = productos.find(p => p.id === productoId)
    if (!producto) return

    // Usar lista individual si existe, sino usar lista global
    const listaId = listasPorProducto[index] || watchedListaPrecioGlobal
    
    if (listaId) {
      const precioResult = await obtenerPrecioProductoAction(listaId, productoId)
      if (precioResult.success && precioResult.data) {
        setValue(`items.${index}.precio_unit_est`, precioResult.data.precio, { 
          shouldValidate: true,
          shouldDirty: true 
        })
        // Actualizar lista_precio_id del item si no tiene lista individual
        if (!listasPorProducto[index] && watchedListaPrecioGlobal) {
          setValue(`items.${index}.lista_precio_id`, watchedListaPrecioGlobal, { shouldDirty: false })
        }
        return
      }
    }

    // Fallback a precio_venta del producto
    setValue(`items.${index}.precio_unit_est`, producto.precio_venta, { 
      shouldValidate: true,
      shouldDirty: true 
    })
  }, [productos, setValue, watchedListaPrecioGlobal, listasPorProducto])

  // Memoizar función para filtrar productos
  const getFilteredProductos = useCallback((index: number, searchTerm: string) => {
    const term = searchTerm.toLowerCase()
    if (!term) return productos
    return productos.filter(p => 
      p.codigo.toLowerCase().includes(term) ||
      p.nombre.toLowerCase().includes(term)
    )
  }, [productos])

  // Memoizar función para filtrar clientes
  const getFilteredClientes = useCallback((searchTerm: string) => {
    const term = searchTerm.toLowerCase()
    if (!term) return clientes
    return clientes.filter(c =>
      c.nombre.toLowerCase().includes(term) ||
      (c.telefono && c.telefono.includes(term)) ||
      (c.zona_entrega && c.zona_entrega.toLowerCase().includes(term)) ||
      (c.codigo && c.codigo.toLowerCase().includes(term))
    )
  }, [clientes])

  // Función para cambiar lista de un producto específico
  const handleListaProductoChange = useCallback(async (index: number, listaId: string) => {
    const nuevaListasPorProducto = { ...listasPorProducto }
    if (listaId) {
      nuevaListasPorProducto[index] = listaId
      setValue(`items.${index}.lista_precio_id`, listaId, { shouldDirty: false })
    } else {
      // Si se elimina la lista individual, usar lista global
      delete nuevaListasPorProducto[index]
      if (watchedListaPrecioGlobal) {
        setValue(`items.${index}.lista_precio_id`, watchedListaPrecioGlobal, { shouldDirty: false })
      } else {
        setValue(`items.${index}.lista_precio_id`, undefined, { shouldDirty: false })
      }
    }
    setListasPorProducto(nuevaListasPorProducto)
    
    // Actualizar precio del producto con la nueva lista
    const item = watchedItems?.[index]
    if (item?.producto_id && listaId) {
      const precioResult = await obtenerPrecioProductoAction(listaId, item.producto_id)
      if (precioResult.success && precioResult.data) {
        setValue(`items.${index}.precio_unit_est`, precioResult.data.precio, { 
          shouldValidate: true,
          shouldDirty: true 
        })
      }
    }
  }, [listasPorProducto, watchedListaPrecioGlobal, watchedItems, setValue])

  // Memoizar addItem
  const addItem = useCallback(() => {
    const newIndex = fields.length
    append({ producto_id: '', cantidad_solicitada: 1, precio_unit_est: 0, lista_precio_id: undefined })
    
    // Si hay lista global, asignarla al nuevo item
    if (watchedListaPrecioGlobal) {
      setValue(`items.${newIndex}.lista_precio_id`, watchedListaPrecioGlobal, { shouldDirty: false })
    }
    
    // Enfocar el select del producto recién agregado después de que React lo renderice
    // Usar múltiples intentos para asegurar que funcione
    const focusProductSelect = (attempts = 0) => {
      if (attempts > 10) return // Máximo 10 intentos
      
      const nuevoProductoSelect = document.getElementById(`producto_${newIndex}`) as HTMLElement
      if (nuevoProductoSelect) {
        // Si hay un input con foco que no es el que queremos, quitarlo
        const activeElement = document.activeElement as HTMLElement
        if (activeElement && 'name' in activeElement && (activeElement as HTMLInputElement).name === `items.${newIndex}.cantidad_solicitada`) {
          activeElement.blur()
        }
        
        // Enfocar el select
        nuevoProductoSelect.focus()
        nuevoProductoSelect.click()
        
        // Esperar a que se abra el dropdown y luego enfocar el input de búsqueda
        setTimeout(() => {
          const searchInput = document.querySelector('[role="listbox"] input[type="text"]') as HTMLInputElement
          if (searchInput) {
            searchInput.focus()
            searchInput.select()
          }
        }, 250)
      } else {
        // Si no se encuentra, intentar de nuevo después de un breve delay
        setTimeout(() => focusProductSelect(attempts + 1), 50)
      }
    }
    
    // Iniciar el proceso después de que React renderice
    requestAnimationFrame(() => {
      setTimeout(() => focusProductSelect(), 100)
    })
  }, [append, fields.length])

  // Memoizar removeItem
  const removeItem = useCallback((index: number) => {
    if (fields.length > 1) {
      remove(index)
      // Limpiar lista individual si existe
      const nuevaListasPorProducto = { ...listasPorProducto }
      delete nuevaListasPorProducto[index]
      // Reindexar las listas (después de eliminar, los índices cambian)
      const reindexed: Record<number, string> = {}
      Object.keys(nuevaListasPorProducto).forEach(key => {
        const oldIndex = parseInt(key)
        if (oldIndex > index) {
          reindexed[oldIndex - 1] = nuevaListasPorProducto[oldIndex]
        } else if (oldIndex < index) {
          reindexed[oldIndex] = nuevaListasPorProducto[oldIndex]
        }
      })
      setListasPorProducto(reindexed)
    }
  }, [fields.length, remove, listasPorProducto])

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
      if (data.lista_precio_id) {
        formData.append('lista_precio_id', data.lista_precio_id)
      }
      formData.append('items', JSON.stringify(data.items))

      const result = await crearPresupuestoAction(formData)

      // Debug completo
      console.log('[CLIENT] ===== RESULTADO CREAR PRESUPUESTO =====')
      console.log('[CLIENT] Success:', result.success)
      console.log('[CLIENT] Message:', result.message)
      console.log('[CLIENT] Data completo:', result.data)
      console.log('[CLIENT] Data keys:', result.data ? Object.keys(result.data) : 'no data')
      
      if (result.success) {
        showToast('success', result.message || 'Presupuesto creado exitosamente')
        const presupuestoId = result.data?.presupuesto_id
        
        console.log('[CLIENT] Presupuesto ID extraído:', presupuestoId)
        console.log('[CLIENT] Tipo de presupuestoId:', typeof presupuestoId)
        
        if (presupuestoId) {
          const url = `/ventas/presupuestos/${presupuestoId}`
          console.log('[CLIENT] ✅ Presupuesto ID válido:', presupuestoId)
          console.log('[CLIENT] 🔗 Redirigiendo a URL:', url)
          
          // Redirigir a la lista primero, luego el usuario puede hacer click en el presupuesto
          // Esto evita problemas de timing donde el presupuesto aún no está disponible
          showToast('success', `Presupuesto creado! Puedes verlo en la lista.`)
          router.push('/ventas/presupuestos')
          router.refresh()
          
          // Alternativa: intentar acceder directamente después de un delay
          // setTimeout(() => {
          //   window.location.href = url
          // }, 2000)
        } else {
          console.warn('[CLIENT] ⚠️ No se encontró presupuesto_id en result.data')
          console.warn('[CLIENT] Result.data completo:', JSON.stringify(result.data, null, 2))
          alert('Presupuesto creado pero no se pudo obtener el ID. Redirigiendo a lista.')
          router.push('/ventas/presupuestos')
        }
      } else {
        console.error('[CLIENT] Error al crear presupuesto:', result)
        showToast('error', result.error || 'Error al crear presupuesto')
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
            <Label htmlFor="cliente_id" className="flex items-center gap-2">
              Cliente *
              <KeyboardHintCompact shortcut="C" />
            </Label>
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
                <SelectValue placeholder="Buscar por código, nombre, teléfono o zona..." />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <div className="sticky top-0 bg-background p-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por código, nombre..."
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
                    const filtered = getFilteredClientes(debouncedClienteSearch)
                    return filtered.length > 0 ? (
                      filtered.map((cliente) => (
                        <SelectItem key={cliente.id} value={cliente.id}>
                          {cliente.codigo && `[${cliente.codigo}] `}
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
                <Label htmlFor="zona_id" className="flex items-center gap-2">
                  Zona de Entrega
                  <KeyboardHintCompact shortcut="Z" />
                </Label>
                <Select
                  value={watch('zona_id') || ''}
                  onValueChange={(value) => setValue('zona_id', value)}
                >
                  <SelectTrigger id="zona_id">
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
                <Label htmlFor="fecha_entrega_estimada" className="flex items-center gap-2">
                  Fecha de Entrega Estimada
                  <KeyboardHintCompact shortcut="F" />
                </Label>
                <DateInput
                  id="fecha_entrega_estimada"
                  value={watch('fecha_entrega_estimada')}
                  onChange={(value) => setValue('fecha_entrega_estimada', value)}
                  placeholder="DD/MM/YYYY"
                />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="lista_precio_id" className="flex items-center gap-2">
              Lista de Precios (Global)
              <KeyboardHintCompact shortcut="L" />
            </Label>
            <Select
              value={watch('lista_precio_id') || ''}
              onValueChange={(value) => {
                setValue('lista_precio_id', value)
                // Actualizar lista_precio_id de items que usan lista global
                watchedItems?.forEach((_, index) => {
                  if (!listasPorProducto[index]) {
                    setValue(`items.${index}.lista_precio_id`, value, { shouldDirty: false })
                  }
                })
              }}
              disabled={cargandoListas}
            >
              <SelectTrigger id="lista_precio_id">
                <SelectValue placeholder={
                  cargandoListas 
                    ? 'Cargando listas...' 
                    : 'Selecciona una lista de precios (por defecto para todos los productos)'
                } />
              </SelectTrigger>
              <SelectContent>
                {todasListas.map((lista) => (
                  <SelectItem key={lista.id} value={lista.id}>
                    {lista.codigo} - {lista.nombre} {lista.margen_ganancia && `(${lista.margen_ganancia}% margen)`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {watch('lista_precio_id') && (
              <p className="text-sm text-muted-foreground mt-1">
                Lista por defecto para todos los productos. Puedes cambiar la lista individualmente en cada producto.
              </p>
            )}
          </div>
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
          {fields.map((field, index) => {
            const itemListaId = listasPorProducto[index] || watchedListaPrecioGlobal
            const usaListaGlobal = !listasPorProducto[index] && !!watchedListaPrecioGlobal
            
            return (
            <ProductoItemRow
              key={field.id}
              index={index}
              fieldId={field.id}
              productos={productos}
              productoSearch={productoSearch[index] || ''}
              onProductoSearchChange={(value) => {
                setProductoSearch(prev => ({ ...prev, [index]: value }))
              }}
              onProductoChange={handleProductoChange}
              onRemove={removeItem}
              errors={errors.items?.[index]}
              canRemove={fields.length > 1}
              watch={watch}
              setValue={setValue}
              register={register}
              control={control}
              watchedItem={watchedItems?.[index]}
              todasListas={todasListas}
              listaId={itemListaId}
              usaListaGlobal={usaListaGlobal}
              listaGlobalId={watchedListaPrecioGlobal}
              onListaChange={handleListaProductoChange}
            />
          )})}

          {errors.items && errors.items.root && (
            <p className="text-sm text-red-500">{errors.items.root.message}</p>
          )}

          <Button 
            ref={agregarProductoButtonRef}
            type="button" 
            variant="outline" 
            onClick={addItem} 
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Agregar Producto
            <KeyboardHintCompact shortcut="A" className="ml-auto" />
          </Button>
        </CardContent>
      </Card>

      {/* Observaciones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Observaciones
            <KeyboardHintCompact shortcut="O" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            id="observaciones"
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

