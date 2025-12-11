'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import Link from 'next/link'
import { productoSchema, type ProductoFormData, type ProductoFormInput } from '@/lib/schemas/productos.schema'
import { useNotificationStore } from '@/store/notificationStore'
import { useFormShortcuts } from '@/lib/hooks/useFormShortcuts'
import { useFormContextShortcuts } from '@/lib/hooks/useFormContextShortcuts'
import { KeyboardHintCompact } from '@/components/ui/keyboard-hint'
// import { crearProducto } from '@/actions/almacen.actions' // TODO: Implementar cuando esté disponible

interface ProductoFormProps {
  producto?: {
    id: string
    codigo: string
    nombre: string
    descripcion?: string
    categoria?: string
    precio_venta: number
    precio_costo?: number
    unidad_medida: string
    stock_minimo: number
    activo: boolean
    // Configuración de venta por mayor
    venta_mayor_habilitada?: boolean
    unidad_mayor_nombre?: string
    kg_por_unidad_mayor?: number
  }
  onSuccess?: () => void
}

export function ProductoForm({ producto, onSuccess }: ProductoFormProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(false)
  const isEditing = !!producto
  const submitButtonRef = useRef<HTMLButtonElement>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProductoFormInput>({
    resolver: zodResolver(productoSchema),
    defaultValues: producto ? {
      codigo: producto.codigo,
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      categoria: producto.categoria || '',
      precio_venta: producto.precio_venta,
      precio_costo: producto.precio_costo || 0,
      unidad_medida: producto.unidad_medida,
      stock_minimo: producto.stock_minimo,
      activo: producto.activo,
      venta_mayor_habilitada: producto.venta_mayor_habilitada || false,
      unidad_mayor_nombre: producto.unidad_mayor_nombre || 'caja',
      kg_por_unidad_mayor: producto.kg_por_unidad_mayor || 20,
    } : {
      codigo: '',
      nombre: '',
      descripcion: '',
      categoria: '',
      precio_venta: 0,
      precio_costo: 0,
      unidad_medida: 'kg',
      stock_minimo: 0,
      activo: true,
      venta_mayor_habilitada: false,
      unidad_mayor_nombre: 'caja',
      kg_por_unidad_mayor: 20,
    },
  })

  const activo = watch('activo')
  const ventaMayorHabilitada = watch('venta_mayor_habilitada')
  const unidadMedida = watch('unidad_medida')

  // Atajos contextuales para campos del formulario
  // Nota: Los shortcuts sin modificadores están protegidos por useKeyboardShortcuts
  // que ignora shortcuts cuando se está escribiendo en inputs
  useFormContextShortcuts({
    shortcuts: [
      { key: 'c', fieldId: 'codigo', description: 'Código' },
      { key: 'n', fieldId: 'nombre', description: 'Nombre' },
      { key: 'd', fieldId: 'descripcion', description: 'Descripción' },
      { key: 'g', fieldId: 'categoria', description: 'Categoría' },
      { key: 'v', fieldId: 'precio_venta', description: 'Precio Venta' },
      { key: 'o', fieldId: 'precio_costo', description: 'Precio Costo' },
      { key: 'u', fieldId: 'unidad_medida', description: 'Unidad de Medida' },
      { key: 's', fieldId: 'stock_minimo', description: 'Stock Mínimo' },
    ],
  })

  const onSubmit = async (data: ProductoFormInput) => {
    try {
      setIsLoading(true)

      const { crearProductoAction, actualizarProductoAction } = await import('@/actions/almacen.actions')

      const result = isEditing
        ? await actualizarProductoAction(producto.id, data)
        : await crearProductoAction(data)

      if (!result.success) {
        throw new Error(result.error || 'Error al guardar producto')
      }

      showToast('success', result.message || (isEditing ? 'Producto actualizado exitosamente' : 'Producto creado exitosamente'))

      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/almacen/productos')
      }
    } catch (error: any) {
      console.error('Error saving producto:', error)
      showToast('error', error.message || 'Error al guardar producto')
    } finally {
      setIsLoading(false)
    }
  }

  // Atajos de teclado para formulario (después de declarar onSubmit)
  useFormShortcuts({
    onSubmit: handleSubmit(onSubmit),
    submitButtonRef,
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Información básica */}
      <Card className="border-l-[3px] border-l-primary">
        <CardHeader>
          <CardTitle className="text-primary">Información Básica</CardTitle>
          <CardDescription>
            Datos principales del producto
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="codigo" className="flex items-center gap-2">
                Código *
                <KeyboardHintCompact shortcut="C" />
              </Label>
              <Input
                id="codigo"
                placeholder="Ej: POLLO001"
                {...register('codigo')}
                disabled={isLoading}
              />
              {errors.codigo && (
                <p className="text-sm text-destructive">{errors.codigo.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoria" className="flex items-center gap-2">
                Categoría
                <KeyboardHintCompact shortcut="G" />
              </Label>
              <Input
                id="categoria"
                placeholder="Ej: Aves, Huevos, etc."
                {...register('categoria')}
                disabled={isLoading}
              />
              {errors.categoria && (
                <p className="text-sm text-destructive">{errors.categoria.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nombre" className="flex items-center gap-2">
              Nombre *
              <KeyboardHintCompact shortcut="N" />
            </Label>
            <Input
              id="nombre"
              placeholder="Nombre del producto"
              {...register('nombre')}
              disabled={isLoading}
            />
            {errors.nombre && (
              <p className="text-sm text-destructive">{errors.nombre.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion" className="flex items-center gap-2">
              Descripción
              <KeyboardHintCompact shortcut="D" />
            </Label>
            <Textarea
              id="descripcion"
              placeholder="Descripción detallada del producto"
              rows={3}
              {...register('descripcion')}
              disabled={isLoading}
            />
            {errors.descripcion && (
              <p className="text-sm text-destructive">{errors.descripcion.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Información económica */}
      <Card className="border-l-[3px] border-l-success">
        <CardHeader>
          <CardTitle className="text-success">Información Económica</CardTitle>
          <CardDescription>
            Precios y costos del producto
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="precio_venta" className="flex items-center gap-2">
                Precio de Venta *
                <KeyboardHintCompact shortcut="V" />
              </Label>
              <Input
                id="precio_venta"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...register('precio_venta', { valueAsNumber: true })}
                disabled={isLoading}
              />
              {errors.precio_venta && (
                <p className="text-sm text-destructive">{errors.precio_venta.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="precio_costo" className="flex items-center gap-2">
                Precio de Costo
                <KeyboardHintCompact shortcut="O" />
              </Label>
              <Input
                id="precio_costo"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...register('precio_costo', { valueAsNumber: true })}
                disabled={isLoading}
              />
              {errors.precio_costo && (
                <p className="text-sm text-destructive">{errors.precio_costo.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="unidad_medida" className="flex items-center gap-2">
                Unidad de Medida *
                <KeyboardHintCompact shortcut="U" />
              </Label>
              <select
                id="unidad_medida"
                {...register('unidad_medida')}
                disabled={isLoading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="kg">Kilogramos (kg)</option>
                <option value="g">Gramos (g)</option>
                <option value="docena">Docena</option>
                <option value="unidad">Unidad</option>
                <option value="litro">Litro (L)</option>
                <option value="ml">Mililitro (ml)</option>
              </select>
              {errors.unidad_medida && (
                <p className="text-sm text-destructive">{errors.unidad_medida.message}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuración de inventario */}
      <Card className="border-l-[3px] border-l-info">
        <CardHeader>
          <CardTitle className="text-info">Configuración de Inventario</CardTitle>
          <CardDescription>
            Configuración de stock y estado del producto
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stock_minimo" className="flex items-center gap-2">
                Stock Mínimo *
                <KeyboardHintCompact shortcut="S" />
              </Label>
              <Input
                id="stock_minimo"
                type="number"
                min="0"
                placeholder="0"
                {...register('stock_minimo', { valueAsNumber: true })}
                disabled={isLoading}
              />
              {errors.stock_minimo && (
                <p className="text-sm text-destructive">{errors.stock_minimo.message}</p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="activo"
                checked={activo}
                onCheckedChange={(checked) => setValue('activo', checked)}
                disabled={isLoading}
              />
              <Label htmlFor="activo">Producto activo</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuración de venta por mayor */}
      <Card className="border-l-[3px] border-l-amber-500">
        <CardHeader>
          <CardTitle className="text-amber-600">Venta por Mayor</CardTitle>
          <CardDescription>
            Configura si este producto puede venderse por unidad mayor (caja, bolsa, etc.) en listas mayoristas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="venta_mayor_habilitada"
              checked={ventaMayorHabilitada}
              onCheckedChange={(checked) => setValue('venta_mayor_habilitada', checked)}
              disabled={isLoading || unidadMedida !== 'kg'}
            />
            <Label htmlFor="venta_mayor_habilitada">
              Habilitar venta por mayor
              {unidadMedida !== 'kg' && (
                <span className="text-muted-foreground text-xs ml-2">(Solo disponible para productos en kg)</span>
              )}
            </Label>
          </div>

          {ventaMayorHabilitada && unidadMedida === 'kg' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="unidad_mayor_nombre">Nombre de unidad mayor</Label>
                <select
                  id="unidad_mayor_nombre"
                  {...register('unidad_mayor_nombre')}
                  disabled={isLoading}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="caja">Caja</option>
                  <option value="bolsa">Bolsa</option>
                  <option value="pack">Pack</option>
                  <option value="bandeja">Bandeja</option>
                  <option value="bulto">Bulto</option>
                </select>
                {errors.unidad_mayor_nombre && (
                  <p className="text-sm text-destructive">{errors.unidad_mayor_nombre.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="kg_por_unidad_mayor">Kg por unidad mayor</Label>
                <Input
                  id="kg_por_unidad_mayor"
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="20"
                  {...register('kg_por_unidad_mayor', { valueAsNumber: true })}
                  disabled={isLoading}
                />
                {errors.kg_por_unidad_mayor && (
                  <p className="text-sm text-destructive">{errors.kg_por_unidad_mayor.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Ej: Si una caja tiene 20 kg, ingresa 20
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Acciones */}
      <div className="flex items-center justify-between sticky bottom-4 bg-background/95 backdrop-blur-sm p-4 rounded-lg border border-primary/10 shadow-lg">
        <Button type="button" variant="outline" asChild disabled={isLoading} className="hover:bg-primary/5 hover:text-primary hover:border-primary/30">
          <Link href="/almacen/productos">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>

        <Button
          ref={submitButtonRef}
          type="submit"
          disabled={isLoading}
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
              {isEditing ? 'Actualizar Producto' : 'Crear Producto'}
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
