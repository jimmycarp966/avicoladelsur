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
  productos: Array<{ id: string; codigo: string; nombre: string; precio_venta: number }>
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
}: ProductoItemRowProps) {
  const debouncedSearch = useDebounce(productoSearch, 300)

  // Filtrar productos con debounce
  const filteredProductos = useMemo(() => {
    const term = debouncedSearch.toLowerCase()
    if (!term) return productos
    return productos.filter(p => 
      p.codigo.toLowerCase().includes(term) ||
      p.nombre.toLowerCase().includes(term)
    )
  }, [productos, debouncedSearch])

  return (
    <div className="grid gap-4 md:grid-cols-12 p-4 border rounded-lg" data-product-index={index}>
      <div className="md:col-span-5">
        <Label htmlFor={`producto_${index}`}>Producto *</Label>
        <div className="relative">
          <Select
            value={watchedItem?.producto_id || ''}
            onValueChange={(value) => {
              setValue(`items.${index}.producto_id`, value)
              onProductoChange(index, value)
              onProductoSearchChange('')
            }}
          >
            <SelectTrigger 
              id={`producto_${index}`}
              data-product-index={index}
              className={errors?.producto_id ? 'border-red-500' : ''}
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
                    onKeyDown={(e) => e.stopPropagation()}
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
                {filteredProductos.length > 0 ? (
                  filteredProductos.map((producto) => (
                    <SelectItem key={producto.id} value={producto.id}>
                      {producto.codigo} - {producto.nombre} ({formatCurrency(producto.precio_venta)})
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                    No se encontraron productos
                  </div>
                )}
              </div>
            </SelectContent>
          </Select>
        </div>
        {errors?.producto_id && (
          <p className="text-sm text-red-500 mt-1">{errors.producto_id.message}</p>
        )}
      </div>

      <div className="md:col-span-3">
        <Label>Cantidad *</Label>
        <Input
          type="number"
          step="0.01"
          min="0.01"
          {...register(`items.${index}.cantidad_solicitada`, { valueAsNumber: true })}
          className={errors?.cantidad_solicitada ? 'border-red-500' : ''}
        />
        {errors?.cantidad_solicitada && (
          <p className="text-sm text-red-500 mt-1">{errors.cantidad_solicitada.message}</p>
        )}
      </div>

      <div className="md:col-span-3">
        <Label>Precio Unit. *</Label>
        <Controller
          name={`items.${index}.precio_unit_est`}
          control={control}
          rules={{ required: true, min: 0.01 }}
          render={({ field }) => (
            <Input
              type="number"
              step="0.01"
              min="0.01"
              {...field}
              value={field.value || ''}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0
                field.onChange(value)
              }}
              className={errors?.precio_unit_est ? 'border-red-500' : ''}
            />
          )}
        />
        {errors?.precio_unit_est && (
          <p className="text-sm text-red-500 mt-1">{errors.precio_unit_est.message}</p>
        )}
      </div>

      <div className="md:col-span-1 flex items-end">
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
    JSON.stringify(prevProps.watchedItem) === JSON.stringify(nextProps.watchedItem)
  )
})

export { ProductoItemRow }

