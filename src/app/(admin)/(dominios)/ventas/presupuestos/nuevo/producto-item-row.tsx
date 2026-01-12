'use client'

import { memo, useMemo } from 'react'
import { UseFormRegister, UseFormSetValue, UseFormWatch, Controller, Control } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, X, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useDebounce } from '@/lib/hooks/useDebounce'

interface ProductoItemRowProps {
  index: number
  fieldId: string
  productos: Array<{
    id: string;
    codigo: string;
    nombre: string;
    precio_venta: number;
    venta_mayor_habilitada?: boolean;
    unidad_mayor_nombre?: string;
    kg_por_unidad_mayor?: number;
    unidad_medida: string;
    stock_real?: number;
    stock_reservado?: number;
    stock_disponible?: number;
  }>
  productoSearch: string
  onProductoSearchChange: (value: string) => void
  onProductoChange: (index: number, productoId: string) => void
  onRemove: (index: number) => void
  errors?: any
  canRemove: boolean
  watch: UseFormWatch<any>
  setValue: UseFormSetValue<any>
  register: UseFormRegister<any>
  control: Control<any>
  watchedItem?: any
  todasListas?: Array<{ id: string; codigo: string; nombre: string; tipo: string; margen_ganancia: number | null }>
  listaId?: string
  usaListaGlobal?: boolean
  listaGlobalId?: string
  onListaChange?: (index: number, listaId: string) => void
  totalItems?: number
  onAddItem?: () => void
}

const ProductoItemRow = memo(function ProductoItemRow({
  index,
  fieldId,
  productos,
  productoSearch,
  onProductoSearchChange,
  onProductoChange,
  onRemove,
  errors,
  canRemove,
  watch,
  setValue,
  register,
  control,
  watchedItem,
  todasListas = [],
  listaId,
  usaListaGlobal = false,
  listaGlobalId,
  onListaChange,
  totalItems = 1,
  onAddItem,
}: ProductoItemRowProps) {

  // Reducido a 150ms para mejor respuesta sin sacrificar rendimiento
  const debouncedSearch = useDebounce(productoSearch, 150)

  // Determinar si mostrar unidad mayorista
  const productoSeleccionado = productos.find(p => p.id === watchedItem?.producto_id)
  const listaSeleccionada = todasListas?.find(l => l.id === listaId)
  const mostrarUnidadMayorista = productoSeleccionado?.venta_mayor_habilitada &&
    productoSeleccionado.unidad_medida === 'kg' &&
    listaSeleccionada?.tipo === 'mayorista'

  // Determinar el placeholder/unidad a mostrar
  const unidadDisplay = mostrarUnidadMayorista && productoSeleccionado?.unidad_mayor_nombre
    ? `1 ${productoSeleccionado.unidad_mayor_nombre}`
    : '1.00'

  // Filtrar productos con debounce y límite de resultados
  const MAX_RESULTS = 50 // Limitar resultados para mejor rendimiento
  const filteredProductos = useMemo(() => {
    const term = debouncedSearch.toLowerCase().trim()
    if (!term) {
      // Si no hay búsqueda, devolver solo los primeros MAX_RESULTS
      return productos.slice(0, MAX_RESULTS)
    }

    // Separar en grupos de prioridad:
    // 1. Coincidencia EXACTA del nombre (máxima prioridad)
    // 2. Nombre empieza con el término y es la palabra completa (ej: "Suprema x kg" al buscar "suprema")
    // 3. Nombre empieza con el término pero continúa (ej: "Suprema rebozada")
    // 4. Código coincide exactamente o empieza con el término
    // 5. Contiene el término en cualquier parte
    const nombreExacto: typeof productos = []
    const nombrePalabraCompleta: typeof productos = []
    const nombreEmpiezaCon: typeof productos = []
    const codigoEmpiezaCon: typeof productos = []
    const contiene: typeof productos = []
    const termLower = term.toLowerCase()

    // Asegurar que el producto seleccionado siempre esté en la lista si existe
    const productoSeleccionadoEnLista = watchedItem?.producto_id
      ? productos.find(p => p.id === watchedItem.producto_id)
      : null

    for (const producto of productos) {
      // Si es el producto seleccionado, lo manejamos al final
      if (producto.id === watchedItem?.producto_id) {
        continue
      }

      const nombreLower = producto.nombre.toLowerCase()
      const codigoLower = producto.codigo.toLowerCase()

      // Prioridad 1: Nombre exacto (ej: buscar "suprema" y el producto se llama "Suprema")
      if (nombreLower === termLower) {
        nombreExacto.push(producto)
        continue
      }

      // Prioridad 2: Nombre empieza con término y después hay un espacio o fin
      // (ej: "Suprema x kg" al buscar "suprema" - la palabra "suprema" está completa)
      if (nombreLower.startsWith(termLower)) {
        const charDespues = nombreLower[termLower.length]
        // Si después del término hay espacio, es palabra completa
        if (charDespues === ' ' || charDespues === undefined) {
          nombrePalabraCompleta.push(producto)
        } else {
          // El término continúa (ej: "Suprema" en "Supremarebozada" - raro pero posible)
          nombreEmpiezaCon.push(producto)
        }
        continue
      }

      // Prioridad 3: Código coincide exactamente o empieza con el término
      if (codigoLower === termLower) {
        codigoEmpiezaCon.unshift(producto) // Coincidencia exacta primero
        continue
      }
      if (codigoLower.startsWith(termLower)) {
        codigoEmpiezaCon.push(producto)
        continue
      }

      // Prioridad 4: Contiene el término en nombre o código
      if (nombreLower.includes(termLower) || codigoLower.includes(termLower)) {
        contiene.push(producto)
      }
    }

    // Ordenar cada grupo por longitud de nombre (más corto primero)
    nombrePalabraCompleta.sort((a, b) => a.nombre.length - b.nombre.length)
    nombreEmpiezaCon.sort((a, b) => a.nombre.length - b.nombre.length)

    // Combinar resultados en orden de prioridad
    const results = [
      ...nombreExacto,
      ...nombrePalabraCompleta,
      ...nombreEmpiezaCon,
      ...codigoEmpiezaCon,
      ...contiene
    ].slice(0, MAX_RESULTS)

    // Si hay un producto seleccionado, agregarlo al inicio si no está ya incluido
    if (productoSeleccionadoEnLista && !results.find(p => p.id === productoSeleccionadoEnLista.id)) {
      results.unshift(productoSeleccionadoEnLista)
    }

    return results
  }, [productos, debouncedSearch, watchedItem?.producto_id])

  return (
    <div className="grid gap-4 md:grid-cols-12 p-4 border rounded-lg" data-product-index={index}>
      <div className="md:col-span-4 min-w-0">
        <Label htmlFor={`producto_${index}`}>Producto *</Label>
        <div className="relative min-w-0">
          <Select
            value={watchedItem?.producto_id || ''}
            onValueChange={(value) => {
              setValue(`items.${index}.producto_id`, value)
              onProductoChange(index, value)
              onProductoSearchChange('')
              // Avanzar al siguiente campo después de seleccionar producto
              setTimeout(() => {
                const listaInput = document.getElementById(`lista_precio_${index}`)
                if (listaInput) {
                  listaInput.focus()
                } else {
                  const cantidadInput = document.getElementById(`cantidad_${index}`)
                  if (cantidadInput instanceof HTMLInputElement) {
                    cantidadInput.focus()
                    cantidadInput.select()
                  }
                }
              }, 100)
            }}
            onOpenChange={(open) => {
              if (open) {
                // Cuando se abre, enfocar el input de búsqueda automáticamente
                setTimeout(() => {
                  const searchInput = document.querySelector(`input[data-product-search="${index}"]`) as HTMLInputElement
                  if (searchInput) {
                    searchInput.focus()
                  }
                }, 50)
              }
            }}
          >
            <SelectTrigger
              id={`producto_${index}`}
              data-product-index={index}
              className={`${errors?.producto_id ? 'border-red-500' : ''} w-full min-w-0`}
            >
              <SelectValue placeholder="Buscar por código o nombre..." />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <div className="sticky top-0 bg-background p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar producto..."
                    value={productoSearch}
                    onChange={(e) => onProductoSearchChange(e.target.value)}
                    className="pl-8"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation()
                      if (e.key === 'Enter' && filteredProductos.length > 0) {
                        e.preventDefault()
                        // Seleccionar el primer resultado
                        const primerProducto = filteredProductos[0]
                        setValue(`items.${index}.producto_id`, primerProducto.id)
                        onProductoChange(index, primerProducto.id)
                        onProductoSearchChange('')
                        // Cerrar el dropdown y avanzar al siguiente campo (lista precio o cantidad)
                        setTimeout(() => {
                          const listaInput = document.getElementById(`lista_precio_${index}`)
                          if (listaInput) {
                            listaInput.focus()
                          } else {
                            const cantidadInput = document.getElementById(`cantidad_${index}`)
                            if (cantidadInput instanceof HTMLInputElement) {
                              cantidadInput.focus()
                              cantidadInput.select()
                            }
                          }
                        }, 100)
                      } else if (e.key === 'Tab' && !e.shiftKey) {
                        // Si hay un producto seleccionado, permitir que TAB avance normalmente
                        // Si no, cerrar el dropdown
                        if (!watchedItem?.producto_id) {
                          const trigger = document.getElementById(`producto_${index}`)
                          if (trigger) {
                            (trigger as HTMLElement).click()
                          }
                        }
                      } else if (e.key === 'Escape') {
                        e.preventDefault()
                        const trigger = document.getElementById(`producto_${index}`)
                        if (trigger) {
                          (trigger as HTMLElement).focus()
                        }
                      }
                    }}
                    autoComplete="off"
                    data-product-search={index}
                  />
                  {productoSearch && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        onProductoSearchChange('')
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="max-h-[200px] overflow-y-auto">
                {(() => {
                  // Asegurar que el producto seleccionado siempre esté en la lista si existe
                  const productoSeleccionadoEnLista = watchedItem?.producto_id
                    ? productos.find(p => p.id === watchedItem.producto_id)
                    : null

                  // Si hay un producto seleccionado y no está en los resultados filtrados, agregarlo
                  const listaFinal = [...filteredProductos]
                  if (productoSeleccionadoEnLista && !listaFinal.find(p => p.id === productoSeleccionadoEnLista.id)) {
                    listaFinal.unshift(productoSeleccionadoEnLista)
                  }

                  return listaFinal.length > 0 ? (
                    <>
                      {listaFinal.map((producto) => (
                        <SelectItem key={producto.id} value={producto.id}>
                          {producto.codigo} - {producto.nombre} ({formatCurrency(producto.precio_venta)})
                          {(producto.stock_real !== undefined || producto.stock_reservado !== undefined) && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              [Stock: {producto.stock_real?.toFixed(1) || 0} | Prev: {producto.stock_reservado?.toFixed(1) || 0}]
                            </span>
                          )}
                        </SelectItem>
                      ))}
                      {filteredProductos.length >= MAX_RESULTS && productoSearch && (
                        <div className="px-2 py-2 text-xs text-muted-foreground text-center border-t bg-muted/50">
                          Mostrando {MAX_RESULTS} de {productos.length} productos. Refina tu búsqueda.
                        </div>
                      )}
                    </>
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
        {errors?.producto_id && (
          <p className="text-sm text-red-500 mt-1">{errors.producto_id.message}</p>
        )}
      </div>

      <div className="md:col-span-2 min-w-0">
        <Label htmlFor={`lista_precio_${index}`}>Lista Precio</Label>
        <div className="min-w-0">
          <Select
            value={listaId || listaGlobalId || undefined}
            onValueChange={(value) => {
              if (value === listaGlobalId) {
                // Si selecciona la lista global, pasar cadena vacía para indicar que se debe usar lista global
                onListaChange?.(index, '')
              } else if (value) {
                onListaChange?.(index, value)
              }
              // Avanzar a cantidad después de seleccionar lista
              setTimeout(() => {
                const cantidadInput = document.getElementById(`cantidad_${index}`)
                if (cantidadInput instanceof HTMLInputElement) {
                  cantidadInput.focus()
                  cantidadInput.select()
                }
              }, 100)
            }}
            disabled={!todasListas.length}
          >
            <SelectTrigger id={`lista_precio_${index}`} className="w-full min-w-0">
              <SelectValue placeholder="Seleccionar lista" />
            </SelectTrigger>
            <SelectContent>
              {listaGlobalId && (
                <SelectItem value={listaGlobalId}>
                  {todasListas.find(l => l.id === listaGlobalId)?.codigo || 'Global'}
                </SelectItem>
              )}
              {todasListas
                .filter((lista) => !listaGlobalId || lista.id !== listaGlobalId) // Filtrar la lista global para evitar duplicados
                .map((lista) => {
                  const margenText = lista.margen_ganancia ? `(${lista.margen_ganancia}%)` : ''
                  const titleText = `${lista.codigo} - ${lista.nombre} ${margenText}`

                  return (
                    <SelectItem key={lista.id} value={lista.id} title={titleText}>
                      {lista.codigo}
                    </SelectItem>
                  )
                })}
            </SelectContent>
          </Select>
        </div>
        {usaListaGlobal && listaGlobalId && (
          <p className="text-xs text-muted-foreground mt-1">
            Usando lista global: {todasListas.find(l => l.id === listaGlobalId)?.codigo || 'Global'}
          </p>
        )}
      </div>

      <div className="md:col-span-2 min-w-0">
        <Label htmlFor={`cantidad_${index}`}>Cantidad *</Label>
        <Controller
          name={`items.${index}.cantidad_solicitada`}
          control={control}
          rules={{ required: 'La cantidad es requerida', min: { value: 0.01, message: 'La cantidad debe ser mayor a 0' } }}
          render={({ field }) => (
            <Input
              id={`cantidad_${index}`}
              type="number"
              step="0.01"
              min="0.01"
              placeholder={unidadDisplay}
              {...field}
              value={field.value || ''}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0
                field.onChange(value)
                // Forzar actualización inmediata sin necesidad de blur
                field.onBlur()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  // Avanzar al campo de precio
                  const precioInput = document.getElementById(`precio_${index}`)
                  if (precioInput instanceof HTMLInputElement) {
                    precioInput.focus()
                    precioInput.select()
                  }
                }
              }}
              className={errors?.cantidad_solicitada ? 'border-red-500' : ''}
              autoComplete="off"
            />
          )}
        />
        {mostrarUnidadMayorista && productoSeleccionado && productoSeleccionado.kg_por_unidad_mayor && productoSeleccionado.unidad_mayor_nombre && (
          <p className="text-xs text-muted-foreground mt-1">
            Equivale a {productoSeleccionado.kg_por_unidad_mayor} kg por {productoSeleccionado.unidad_mayor_nombre}
          </p>
        )}
        {errors?.cantidad_solicitada && (
          <p className="text-sm text-red-500 mt-1">{errors.cantidad_solicitada.message}</p>
        )}
      </div>

      <div className="md:col-span-2 min-w-0">
        <Label>Precio Unit. *</Label>
        <Controller
          name={`items.${index}.precio_unit_est`}
          control={control}
          rules={{ required: true, min: 0.01 }}
          render={({ field }) => (
            <Input
              id={`precio_${index}`}
              type="number"
              step="0.01"
              min="0.01"
              {...field}
              value={field.value || ''}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0
                field.onChange(value)
                // Disparar evento input para forzar actualización inmediata
                e.target.dispatchEvent(new Event('input', { bubbles: true }))
              }}
              onBlur={(e) => {
                field.onBlur()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  // Si es el último producto, agregar uno nuevo
                  if (index === totalItems - 1 && onAddItem) {
                    onAddItem()
                    // Enfocar el nuevo producto después de un breve delay
                    setTimeout(() => {
                      const nextProductSelect = document.getElementById(`producto_${index + 1}`)
                      if (nextProductSelect) {
                        nextProductSelect.click()
                        setTimeout(() => {
                          const searchInput = document.querySelector(`input[data-product-search="${index + 1}"]`) as HTMLInputElement
                          if (searchInput) {
                            searchInput.focus()
                            searchInput.select()
                          }
                        }, 100)
                      }
                    }, 100)
                  } else {
                    // Avanzar al siguiente producto
                    const nextCantidadInput = document.getElementById(`cantidad_${index + 1}`)
                    if (nextCantidadInput instanceof HTMLInputElement) {
                      nextCantidadInput.focus()
                      nextCantidadInput.select()
                    } else {
                      // Si no hay siguiente producto, agregar uno nuevo
                      if (onAddItem) {
                        onAddItem()
                        setTimeout(() => {
                          const nextProductSelect = document.getElementById(`producto_${index + 1}`)
                          if (nextProductSelect) {
                            nextProductSelect.click()
                            setTimeout(() => {
                              const searchInput = document.querySelector(`input[data-product-search="${index + 1}"]`) as HTMLInputElement
                              if (searchInput) {
                                searchInput.focus()
                                searchInput.select()
                              }
                            }, 100)
                          }
                        }, 100)
                      }
                    }
                  }
                }
              }}
              className={errors?.precio_unit_est ? 'border-red-500' : ''}
            />
          )}
        />
        {errors?.precio_unit_est && (
          <p className="text-sm text-red-500 mt-1">{errors.precio_unit_est.message}</p>
        )}
      </div>

      <div className="md:col-span-2 flex items-end justify-end gap-2">
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(index)}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // Comparación personalizada para evitar re-renders innecesarios
  return (
    prevProps.index === nextProps.index &&
    prevProps.fieldId === nextProps.fieldId &&
    prevProps.productoSearch === nextProps.productoSearch &&
    prevProps.canRemove === nextProps.canRemove &&
    JSON.stringify(prevProps.errors) === JSON.stringify(nextProps.errors) &&
    JSON.stringify(prevProps.watchedItem) === JSON.stringify(nextProps.watchedItem) &&
    prevProps.todasListas === nextProps.todasListas &&
    prevProps.listaId === nextProps.listaId &&
    prevProps.usaListaGlobal === nextProps.usaListaGlobal &&
    prevProps.listaGlobalId === nextProps.listaGlobalId
  )
})

export { ProductoItemRow }

