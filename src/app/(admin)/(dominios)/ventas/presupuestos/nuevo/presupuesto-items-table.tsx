'use client'

import { useState, useRef, useCallback, useMemo, KeyboardEvent, useEffect } from 'react'
import { UseFormRegister, UseFormSetValue, UseFormWatch, Control, Controller } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Trash2, Search, Package } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useDebounce } from '@/lib/hooks/useDebounce'

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
  stock_disponible?: number
}

interface ListaPrecio {
  id: string
  codigo: string
  nombre: string
  tipo: string
  margen_ganancia: number | null
}

interface Item {
  producto_id: string
  cantidad_solicitada: number
  precio_unit_est: number
  lista_precio_id?: string
}

interface PresupuestoItemsTableProps {
  items: Item[]
  productos: Producto[]
  listas: ListaPrecio[]
  listaGlobalId?: string
  control: Control<any>
  register: UseFormRegister<any>
  setValue: UseFormSetValue<any>
  watch: UseFormWatch<any>
  onProductoChange: (index: number, productoId: string) => void
  onListaChange: (index: number, listaId: string) => void
  onAddItem: () => void
  onRemoveItem: (index: number) => void
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
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debouncedSearch = useDebounce(search, 150)

  const filteredProductos = useMemo(() => {
    if (!debouncedSearch.trim()) return []

    const term = debouncedSearch.toLowerCase().trim()
    return productos
      .filter(p => 
        p.codigo.toLowerCase().includes(term) || 
        p.nombre.toLowerCase().includes(term)
      )
      .slice(0, 10)
  }, [productos, debouncedSearch])

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

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, filteredProductos.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredProductos[selectedIndex]) {
        onSelect(filteredProductos[selectedIndex])
        setSearch('')
        setIsOpen(false)
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }, [filteredProductos, selectedIndex, onSelect])

  const productoSeleccionado = productos.find(p => p.id === value)

  if (productoSeleccionado) {
    return (
      <div className="flex items-center gap-2 w-full">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-muted rounded-md text-sm min-w-0">
          <Package className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium shrink-0">{productoSeleccionado.codigo}</span>
          <span className="text-muted-foreground truncate">- {productoSeleccionado.nombre}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => {
            onSelect({ id: '', codigo: '', nombre: '', precio_venta: 0, unidad_medida: '' } as Producto)
            setTimeout(() => inputRef.current?.focus(), 0)
          }}
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
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setIsOpen(e.target.value.length > 0)
          }}
          onKeyDown={handleKeyDown}
          className="pl-8"
          autoFocus={autoFocus}
          autoComplete="off"
          data-omnibox-input={rowIndex}
        />
      </div>
      
      {/* Dropdown simple con absolute positioning */}
      {isOpen && filteredProductos.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-[250px] overflow-y-auto z-50">
          {filteredProductos.map((producto, index) => (
            <div
              key={producto.id}
              onClick={() => {
                onSelect(producto)
                setSearch('')
                setIsOpen(false)
              }}
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
  onAddItem,
  onRemoveItem,
  errors,
}: PresupuestoItemsTableProps) {
  const [focusedRow, setFocusedRow] = useState<number | null>(null)

  console.log('[TABLE] items.length:', items?.length)
  console.log('[TABLE] items:', items)

  const handleProductoSelect = useCallback((index: number, producto: Producto) => {
    if (producto.id) {
      setValue(`items.${index}.producto_id`, producto.id)
      onProductoChange(index, producto.id)
      setTimeout(() => {
        const cantidadInput = document.getElementById(`cantidad-${index}`) as HTMLInputElement
        if (cantidadInput) {
          cantidadInput.focus()
          cantidadInput.select()
        }
      }, 50)
    } else {
      setValue(`items.${index}.producto_id`, '')
      setValue(`items.${index}.precio_unit_est`, 0)
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
        if (rowIndex === items.length - 1) {
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
  }, [items.length, onAddItem])

  const calcularSubtotal = (cantidad: number, precio: number) => {
    return (cantidad || 0) * (precio || 0)
  }

  const handleRemove = useCallback((index: number) => {
    console.log('[TABLE] handleRemove llamado, index:', index, 'items.length:', items?.length)
    if (items && items.length > 1) {
      console.log('[TABLE] Llamando a onRemoveItem con index:', index)
      onRemoveItem(index)
      console.log('[TABLE] onRemoveItem llamado')
    } else {
      console.log('[TABLE] No se puede eliminar: solo queda 1 item')
    }
  }, [onRemoveItem, items])

  const canRemove = items && items.length > 1

  return (
    <div className="space-y-3">
      {/* Tabla */}
      <div className="border rounded-lg" style={{ overflow: 'visible' }}>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-3 py-2 font-medium w-[40%]">Producto</th>
              <th className="text-center px-2 py-2 font-medium w-[12%]">Cant.</th>
              <th className="text-left px-2 py-2 font-medium w-[15%]">Lista</th>
              <th className="text-right px-2 py-2 font-medium w-[15%]">Precio</th>
              <th className="text-right px-2 py-2 font-medium w-[13%]">Subtotal</th>
              <th className="text-center px-2 py-2 font-medium w-[5%]"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items?.map((item, index) => {
              const producto = productos.find(p => p.id === item.producto_id)
              const subtotal = calcularSubtotal(item.cantidad_solicitada, item.precio_unit_est)
              const hasError = errors?.items?.[index]

              return (
                <tr 
                  key={`row-${index}`}
                  className={`${hasError ? 'bg-red-50/50' : ''} ${focusedRow === index ? 'bg-accent/50' : ''}`}
                  onFocus={() => setFocusedRow(index)}
                >
                  {/* Producto */}
                  <td className="px-2 py-2 relative">
                    <ProductoOmnibox
                      value={item.producto_id}
                      onSelect={(p) => handleProductoSelect(index, p)}
                      productos={productos}
                      autoFocus={index === items.length - 1 && !item.producto_id}
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

                  {/* Eliminar - SIN disabled, solo oculto cuando hay 1 item */}
                  <td className="px-2 py-2 text-center">
                    {canRemove ? (
                      <button
                        type="button"
                        onClick={() => handleRemove(index)}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-md text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
                        title="Eliminar producto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <span className="h-8 w-8 inline-block" />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Botón agregar */}
      <Button
        type="button"
        variant="outline"
        className="w-full h-10 border-dashed"
        onClick={onAddItem}
      >
        <Package className="h-4 w-4 mr-2" />
        Agregar Producto
      </Button>
    </div>
  )
}
