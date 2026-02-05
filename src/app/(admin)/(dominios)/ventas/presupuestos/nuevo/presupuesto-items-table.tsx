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

// Componente de búsqueda omnibox con portal
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
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debouncedSearch = useDebounce(search, 100)

  // Calcular posición del dropdown
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 })

  const updateDropdownPosition = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setDropdownPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      })
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition()
      // Recalcular en scroll/resize
      window.addEventListener('scroll', updateDropdownPosition, true)
      window.addEventListener('resize', updateDropdownPosition)
      return () => {
        window.removeEventListener('scroll', updateDropdownPosition, true)
        window.removeEventListener('resize', updateDropdownPosition)
      }
    }
  }, [isOpen, updateDropdownPosition])

  // Cerrar al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current && 
        !containerRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const filteredProductos = useMemo(() => {
    if (!debouncedSearch.trim()) {
      return []
    }

    const term = debouncedSearch.toLowerCase().trim()
    const results: Producto[] = []
    
    for (const producto of productos) {
      if (results.length >= 10) break

      const nombreLower = producto.nombre.toLowerCase()
      const codigoLower = producto.codigo.toLowerCase()

      // Coincidencia exacta en código (prioridad alta)
      if (codigoLower === term) {
        results.unshift(producto)
        continue
      }

      // Código empieza con el término
      if (codigoLower.startsWith(term)) {
        results.push(producto)
        continue
      }

      // Nombre empieza con el término
      if (nombreLower.startsWith(term)) {
        results.push(producto)
        continue
      }

      // Contiene el término
      if (nombreLower.includes(term) || codigoLower.includes(term)) {
        results.push(producto)
      }
    }

    return results
  }, [productos, debouncedSearch])

  // Reset selected index cuando cambian los resultados
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
      inputRef.current?.blur()
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
    <>
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
              setIsOpen(true)
              updateDropdownPosition()
            }}
            onFocus={() => {
              if (search.trim()) {
                setIsOpen(true)
                updateDropdownPosition()
              }
            }}
            onKeyDown={handleKeyDown}
            className="pl-8"
            autoFocus={autoFocus}
            autoComplete="off"
            data-omnibox-input={rowIndex}
          />
        </div>
      </div>
      
      {/* Dropdown con portal a document.body */}
      {isOpen && filteredProductos.length > 0 && (
        <div 
          ref={dropdownRef}
          className="fixed bg-white border rounded-md shadow-2xl max-h-[300px] overflow-auto"
          style={{
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            zIndex: 99999,
          }}
        >
          <div className="py-1">
            {filteredProductos.map((producto, index) => (
              <button
                key={producto.id}
                type="button"
                onClick={() => {
                  onSelect(producto)
                  setSearch('')
                  setIsOpen(false)
                }}
                className={`w-full px-3 py-2.5 text-left text-sm hover:bg-accent flex items-center justify-between transition-colors ${
                  index === selectedIndex ? 'bg-accent' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium">
                    {producto.codigo} - {producto.nombre}
                  </div>
                  {producto.stock_disponible !== undefined && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Stock: {producto.stock_disponible.toFixed(1)} {producto.unidad_medida}
                    </div>
                  )}
                </div>
                <div className="text-right text-muted-foreground ml-2 shrink-0">
                  {formatCurrency(producto.precio_venta)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
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

  const getListaDisplay = useCallback((listaId?: string) => {
    if (!listaId) return '-'
    const lista = listas.find(l => l.id === listaId)
    return lista?.codigo || '-'
  }, [listas])

  const handleProductoSelect = useCallback((index: number, producto: Producto) => {
    if (producto.id) {
      setValue(`items.${index}.producto_id`, producto.id)
      onProductoChange(index, producto.id)
      // Enfocar cantidad
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
        // Mover a precio
        const precioInput = document.getElementById(`precio-${rowIndex}`) as HTMLInputElement
        if (precioInput) {
          precioInput.focus()
          precioInput.select()
        }
      } else if (field === 'precio') {
        // Si es la última fila, agregar nueva
        if (rowIndex === items.length - 1) {
          onAddItem()
          setTimeout(() => {
            const nextInput = document.querySelector(`[data-omnibox-input="${rowIndex + 1}"]`) as HTMLInputElement
            if (nextInput) {
              nextInput.focus()
            }
          }, 150)
        } else {
          // Mover a siguiente cantidad
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
    console.log('>>> handleRemove llamado con index:', index)
    console.log('>>> items.length:', items.length)
    if (items.length > 1) {
      console.log('>>> Llamando a onRemoveItem:', index)
      onRemoveItem(index)
    } else {
      console.log('>>> No se puede eliminar: solo queda 1 item')
    }
  }, [onRemoveItem, items.length])

  return (
    <div className="space-y-3">
      {/* Tabla compacta */}
      <div className="border rounded-lg overflow-visible">
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
            {items.map((item, index) => {
              const producto = productos.find(p => p.id === item.producto_id)
              const subtotal = calcularSubtotal(item.cantidad_solicitada, item.precio_unit_est)
              const hasError = errors?.items?.[index]

              return (
                <tr 
                  key={`row-${index}`}
                  className={`${hasError ? 'bg-red-50/50' : ''} ${focusedRow === index ? 'bg-accent/50' : ''}`}
                  onFocus={() => setFocusedRow(index)}
                >
                  {/* Producto - Omnibox */}
                  <td className="px-2 py-2">
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
                        disabled={!item.producto_id}
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
                    {item.producto_id ? (
                      formatCurrency(subtotal)
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>

                  {/* Eliminar */}
                  <td className="px-2 py-2 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        console.log('>>> Botón eliminar clickeado, index:', index)
                        handleRemove(index)
                      }}
                      disabled={items.length <= 1}
                      title={items.length <= 1 ? "Debe haber al menos un producto" : "Eliminar producto"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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

      {/* Tips de navegación */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>💡 Escribí código/nombre y presioná <kbd className="px-1 py-0.5 bg-muted rounded">Enter</kbd> para seleccionar</span>
        <span>💡 <kbd className="px-1 py-0.5 bg-muted rounded">Tab</kbd> para navegar entre campos</span>
      </div>
    </div>
  )
}
