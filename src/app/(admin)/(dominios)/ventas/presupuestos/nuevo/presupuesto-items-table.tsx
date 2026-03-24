'use client'

import { useState, useRef, useCallback, useMemo, KeyboardEvent, useEffect } from 'react'
import { UseFormRegister, UseFormSetValue, UseFormWatch, Control, Controller } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Trash2, Search, Package, Copy, Plus } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useDebounce } from '@/lib/hooks/useDebounce'
import { StockIndicatorBadge } from '@/components/presupuestos/stock-indicator-badge'

interface Producto {
  id: string
  codigo: string
  nombre: string
  precio_venta: number
  unidad_medida: string
  venta_mayor_habilitada?: boolean
  unidad_mayor_nombre?: string
  kg_por_unidad_mayor?: number
  stock_real?: number
  stock_reservado?: number
  stock_disponible?: number
}

interface ListaPrecio {
  id: string
  codigo: string
  nombre: string
  tipo: string
  margen_ganancia: number | null
}

// Item con id de useFieldArray
interface FieldItem {
  id: string  // react-hook-form field id
  producto_id: string
  cantidad_solicitada: number
  precio_unit_est: number
  lista_precio_id?: string
}

interface PresupuestoItemsTableProps {
  items: FieldItem[]
  productos: Producto[]
  listas: ListaPrecio[]
  listaGlobalId?: string
  control: Control<any>
  register: UseFormRegister<any>
  setValue: UseFormSetValue<any>
  watch: UseFormWatch<any>
  onProductoChange: (index: number, productoId: string) => void
  onListaChange: (index: number, listaId: string) => void
  onPrecioModificadoManualmente?: (index: number) => void
  onAddItem: () => void
  onRemoveItem: (index: number) => void
  onDuplicateItem?: (index: number) => void
  canRemoveItem: (index: number) => boolean
  itemsCount?: number  // Cantidad real de items (de fields.length)
  errors?: any
}

// Componente de búsqueda omnibox simplificado
function ProductoOmnibox({
  value,
  onSelect,
  productos,
  placeholder = "Escribí código o nombre...",
  autoFocus = false,
  rowIndex,
}: {
  value: string
  onSelect: (producto: Producto) => void
  productos: Producto[]
  placeholder?: string
  autoFocus?: boolean
  rowIndex: number
}) {
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isEditingSelection, setIsEditingSelection] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const optionRefs = useRef<Array<HTMLDivElement | null>>([])
  const debouncedSearch = useDebounce(search, 150)

  const focusOption = useCallback((index: number) => {
    window.setTimeout(() => {
      optionRefs.current[index]?.focus()
    }, 0)
  }, [])

  // Resetear search cuando cambia el value (se selecciona un producto)
  useEffect(() => {
    if (value) {
      setSearch('')
      setIsOpen(false)
    }
  }, [value])

  const filteredProductos = useMemo(() => {
    if (!debouncedSearch.trim()) return productos.slice(0, 10)

    const term = debouncedSearch.toLowerCase().trim()

    // Separar en grupos de prioridad para mejor ordenamiento
    const nombreExacto: typeof productos = []
    const nombrePalabraCompleta: typeof productos = []
    const nombreEmpiezaCon: typeof productos = []
    const codigoEmpiezaCon: typeof productos = []
    const codigoExacto: typeof productos = []
    const contiene: typeof productos = []

    for (const p of productos) {
      const nombreLower = p.nombre.toLowerCase()
      const codigoLower = p.codigo.toLowerCase()

      // Prioridad 1: Código exacto
      if (codigoLower === term) {
        codigoExacto.push(p)
        continue
      }

      // Prioridad 2: Nombre exacto
      if (nombreLower === term) {
        nombreExacto.push(p)
        continue
      }

      // Prioridad 3: Nombre empieza con término y es palabra completa
      if (nombreLower.startsWith(term)) {
        const charDespues = nombreLower[term.length]
        if (charDespues === ' ' || charDespues === undefined) {
          nombrePalabraCompleta.push(p)
        } else {
          nombreEmpiezaCon.push(p)
        }
        continue
      }

      // Prioridad 4: Código empieza con el término
      if (codigoLower.startsWith(term)) {
        codigoEmpiezaCon.push(p)
        continue
      }

      // Prioridad 5: Contiene el término
      if (nombreLower.includes(term) || codigoLower.includes(term)) {
        contiene.push(p)
      }
    }

    // Ordenar por longitud de nombre (más corto primero)
    nombrePalabraCompleta.sort((a, b) => a.nombre.length - b.nombre.length)
    nombreEmpiezaCon.sort((a, b) => a.nombre.length - b.nombre.length)

    return [
      ...codigoExacto,
      ...nombreExacto,
      ...nombrePalabraCompleta,
      ...nombreEmpiezaCon,
      ...codigoEmpiezaCon,
      ...contiene
    ].slice(0, 10)
  }, [productos, debouncedSearch])

  const handleSelectProducto = useCallback((producto: Producto) => {
    onSelect(producto)
    setSearch('')
    setIsOpen(false)
    setIsEditingSelection(false)
    setSelectedIndex(0)
  }, [onSelect])

  // Cerrar al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Reset selected index
  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredProductos.length])

  useEffect(() => {
    if (!isOpen) return

    optionRefs.current[selectedIndex]?.scrollIntoView({
      block: 'nearest',
    })
  }, [isOpen, selectedIndex])

  const handleInputKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
      }
      setSelectedIndex(prev => Math.min(prev + 1, Math.max(filteredProductos.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
      }
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Tab' && !e.shiftKey && filteredProductos.length > 0) {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
      }
      const nextIndex = Math.min(selectedIndex, Math.max(filteredProductos.length - 1, 0))
      setSelectedIndex(nextIndex)
      focusOption(nextIndex)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredProductos[selectedIndex]) {
        handleSelectProducto(filteredProductos[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }, [filteredProductos, focusOption, handleSelectProducto, isOpen, selectedIndex])

  const handleOptionKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>, index: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const nextIndex = Math.min(index + 1, filteredProductos.length - 1)
      setSelectedIndex(nextIndex)
      focusOption(nextIndex)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const nextIndex = Math.max(index - 1, 0)
      setSelectedIndex(nextIndex)
      focusOption(nextIndex)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (filteredProductos[index]) {
        handleSelectProducto(filteredProductos[index])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      inputRef.current?.focus()
      setIsOpen(false)
    }
  }, [filteredProductos, focusOption, handleSelectProducto])

  const productoSeleccionado = productos.find(p => p.id === value)
  const mostrarBusqueda = !productoSeleccionado || isEditingSelection

  const beginProductChange = useCallback(() => {
    setIsEditingSelection(true)
    setSearch('')
    setIsOpen(true)
    setSelectedIndex(0)

    window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
  }, [])

  if (productoSeleccionado && !mostrarBusqueda) {
    return (
      <div className="flex items-center gap-2 w-full">
        <button
          type="button"
          className="flex-1 flex items-center gap-2 px-3 py-2 bg-muted rounded-md text-sm min-w-0 text-left hover:bg-muted/80 transition-colors"
          onClick={beginProductChange}
          title="Cambiar producto"
        >
          <Package className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium shrink-0">{productoSeleccionado.codigo}</span>
          <span className="text-muted-foreground truncate">- {productoSeleccionado.nombre}</span>
        </button>
        <Button
          id={`producto_${rowIndex}`}
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={beginProductChange}
        >
          Cambiar
        </Button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          id={`producto_${rowIndex}`}
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setIsOpen(true)
            setSelectedIndex(0)
          }}
          onKeyDown={handleInputKeyDown}
          onFocus={() => {
            setIsOpen(true)
          }}
          className="pl-8"
          autoFocus={autoFocus || isEditingSelection}
          autoComplete="off"
          data-omnibox-input={rowIndex}
        />
      </div>
      
      {/* Dropdown simple con absolute positioning */}
      {isOpen && filteredProductos.length > 0 && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-[250px] overflow-y-auto z-50"
        >
          {filteredProductos.map((producto, index) => (
            <div
              key={producto.id}
              ref={(element) => {
                optionRefs.current[index] = element
              }}
              role="option"
              aria-selected={index === selectedIndex}
              tabIndex={index === selectedIndex ? 0 : -1}
              onClick={() => {
                handleSelectProducto(producto)
              }}
              onFocus={() => {
                setSelectedIndex(index)
              }}
              onKeyDown={(e) => handleOptionKeyDown(e, index)}
              className={`px-3 py-2 cursor-pointer text-sm hover:bg-gray-100 flex items-center justify-between ${
                index === selectedIndex ? 'bg-gray-100' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900">
                  {producto.codigo} - {producto.nombre}
                </div>
                {producto.stock_disponible !== undefined && (
                  <div className="text-xs text-gray-500">
                    Stock: {producto.stock_disponible.toFixed(1)} {producto.unidad_medida}
                  </div>
                )}
              </div>
              <div className="text-right text-gray-600 ml-2 shrink-0 font-medium">
                {formatCurrency(producto.precio_venta)}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Mensaje cuando no hay resultados */}
      {isOpen && search.length > 0 && filteredProductos.length === 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-3 z-50">
          <div className="text-sm text-gray-500 text-center">
            No se encontraron productos
          </div>
        </div>
      )}
    </div>
  )
}

export function PresupuestoItemsTable({
  items,
  productos,
  listas,
  listaGlobalId,
  control,
  register,
  setValue,
  watch,
  onProductoChange,
  onListaChange,
  onPrecioModificadoManualmente,
  onAddItem,
  onRemoveItem,
  onDuplicateItem,
  canRemoveItem,
  itemsCount,
  errors,
}: PresupuestoItemsTableProps) {
  const [focusedRow, setFocusedRow] = useState<number | null>(null)

  // Usar itemsCount (de fields.length) como la fuente de verdad para la cantidad de items
  const displayItems = itemsCount !== undefined ? items.slice(0, itemsCount) : items


  const handleProductoSelect = useCallback((index: number, producto: Producto) => {
    if (producto.id) {
      setValue(`items.${index}.producto_id`, producto.id, { shouldValidate: true, shouldDirty: true })
      onProductoChange(index, producto.id)
      setTimeout(() => {
        const cantidadInput = document.getElementById(`cantidad-${index}`) as HTMLInputElement
        if (cantidadInput) {
          cantidadInput.focus()
          cantidadInput.select()
        }
      }, 50)
    } else {
      setValue(`items.${index}.producto_id`, '', { shouldValidate: true, shouldDirty: true })
      setValue(`items.${index}.precio_unit_est`, 0, { shouldValidate: true, shouldDirty: true })
    }
  }, [setValue, onProductoChange])

  const handleKeyNavigation = useCallback((e: KeyboardEvent<HTMLInputElement>, rowIndex: number, field: 'cantidad' | 'precio') => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()

      if (field === 'cantidad') {
        const precioInput = document.getElementById(`precio-${rowIndex}`) as HTMLInputElement
        if (precioInput) {
          precioInput.focus()
          precioInput.select()
        }
      } else if (field === 'precio') {
        // IMPORTANTE: Marcar el precio como modificado manualmente ANTES de agregar el nuevo item
        // Esto es necesario porque onAddItem() dispara efectos que pueden sobrescribir el precio
        onPrecioModificadoManualmente?.(rowIndex)

        const maxIndex = displayItems.length - 1
        if (rowIndex === maxIndex) {
          onAddItem()
          setTimeout(() => {
            const nextInput = document.querySelector(`[data-omnibox-input="${rowIndex + 1}"]`) as HTMLInputElement
            if (nextInput) nextInput.focus()
          }, 150)
        } else {
          const nextCantidadInput = document.getElementById(`cantidad-${rowIndex + 1}`) as HTMLInputElement
          if (nextCantidadInput) {
            nextCantidadInput.focus()
            nextCantidadInput.select()
          }
        }
      }
    }
  }, [displayItems.length, onAddItem, onPrecioModificadoManualmente])

  const calcularSubtotal = (cantidad: number, precio: number) => {
    return (cantidad || 0) * (precio || 0)
  }

  const handleRemove = useCallback((index: number) => {
    if (canRemoveItem(index)) {
      onRemoveItem(index)
    }
  }, [onRemoveItem, canRemoveItem])

  return (
    <div className="space-y-3">
      {/* Tabla */}
      <div className="border rounded-lg" style={{ overflow: 'visible' }}>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-3 py-2 font-medium w-[35%]">Producto</th>
              <th className="text-center px-2 py-2 font-medium w-[10%]">Cant.</th>
              <th className="text-left px-2 py-2 font-medium w-[13%]">Lista</th>
              <th className="text-right px-2 py-2 font-medium w-[13%]">Precio</th>
              <th className="text-right px-2 py-2 font-medium w-[12%]">Subtotal</th>
              <th className="text-center px-2 py-2 font-medium w-[12%]">Stock</th>
              <th className="text-center px-2 py-2 font-medium w-[5%]"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {displayItems?.map((item, index) => {
              const producto = productos.find(p => p.id === item.producto_id)
              const subtotal = calcularSubtotal(item.cantidad_solicitada, item.precio_unit_est)
              const hasError = errors?.items?.[index]

              return (
                <tr 
                  key={item.id}  // Usar el id del field array para key estable
                  className={`${hasError ? 'bg-red-50/50' : ''} ${focusedRow === index ? 'bg-accent/50' : ''}`}
                  onFocus={() => setFocusedRow(index)}
                >
                  {/* Producto */}
                  <td className="px-2 py-2 relative">
                    <ProductoOmnibox
                      value={item.producto_id}
                      onSelect={(p) => handleProductoSelect(index, p)}
                      productos={productos}
                      autoFocus={items.length > 1 && index === items.length - 1 && !item.producto_id}
                      rowIndex={index}
                    />
                    {hasError?.producto_id && (
                      <span className="text-xs text-red-500">{hasError.producto_id.message}</span>
                    )}
                  </td>

                  {/* Cantidad */}
                  <td className="px-2 py-2">
                    <Controller
                      name={`items.${index}.cantidad_solicitada`}
                      control={control}
                      render={({ field }) => (
                        <Input
                          id={`cantidad-${index}`}
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="0"
                          className={`text-center h-9 ${hasError?.cantidad_solicitada ? 'border-red-500' : ''}`}
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0
                            field.onChange(value)
                          }}
                          onKeyDown={(e) => handleKeyNavigation(e as any, index, 'cantidad')}
                          disabled={!item.producto_id}
                        />
                      )}
                    />
                  </td>

                  {/* Lista */}
                  <td className="px-2 py-2">
                    {producto ? (
                      <select
                        value={item.lista_precio_id || listaGlobalId || ''}
                        onChange={(e) => onListaChange(index, e.target.value)}
                        className="w-full h-9 px-2 text-sm border rounded-md bg-background"
                      >
                        {listas.map(lista => (
                          <option key={lista.id} value={lista.id}>
                            {lista.codigo}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </td>

                  {/* Precio */}
                  <td className="px-2 py-2">
                    <Controller
                      name={`items.${index}.precio_unit_est`}
                      control={control}
                      render={({ field }) => (
                        <Input
                          id={`precio-${index}`}
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="0"
                          className={`text-right h-9 ${hasError?.precio_unit_est ? 'border-red-500' : ''}`}
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0
                            field.onChange(value)
                            // Marcar que el precio fue modificado manualmente
                            onPrecioModificadoManualmente?.(index)
                          }}
                          onBlur={(e) => {
                            field.onBlur()
                          }}
                          onKeyDown={(e) => handleKeyNavigation(e as any, index, 'precio')}
                          disabled={!item.producto_id}
                        />
                      )}
                    />
                  </td>

                  {/* Subtotal */}
                  <td className="px-2 py-2 text-right font-medium">
                    {item.producto_id ? formatCurrency(subtotal) : '-'}
                  </td>

                  {/* Stock */}
                  <td className="px-2 py-2">
                    {producto && producto.stock_disponible !== undefined ? (
                      <StockIndicatorBadge
                        stockDisponible={producto.stock_disponible}
                        stockReal={producto.stock_real}
                        stockReservado={producto.stock_reservado}
                        unidadMedida={producto.unidad_medida}
                        size="sm"
                      />
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </td>

                  {/* Acciones */}
                  <td className="px-2 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {/* Botón de duplicar */}
                      {onDuplicateItem && item.producto_id && (
                        <button
                          type="button"
                          onClick={() => onDuplicateItem(index)}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Duplicar producto"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {/* Botón de eliminar */}
                      {canRemoveItem(index) ? (
                        <button
                          type="button"
                          onClick={() => handleRemove(index)}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
                          title="Eliminar producto"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <span className="h-7 w-7 inline-block" />
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Botón agregar */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1 h-9 border-dashed"
          onClick={onAddItem}
        >
          <Plus className="h-4 w-4 mr-2" />
          Agregar Producto
        </Button>
        {onDuplicateItem && displayItems.length > 0 && displayItems[displayItems.length - 1]?.producto_id && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onDuplicateItem(displayItems.length - 1)}
            className="h-9"
            title="Duplicar último producto"
          >
            <Copy className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
