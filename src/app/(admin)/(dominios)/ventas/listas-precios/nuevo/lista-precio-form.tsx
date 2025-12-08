'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Save, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { listaPrecioSchema, type ListaPrecioInput } from '@/lib/schemas/listas-precios.schema'
import { useNotificationStore } from '@/store/notificationStore'
import { crearListaPrecioAction } from '@/actions/listas-precios.actions'

export function ListaPrecioForm() {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ListaPrecioInput>({
    resolver: zodResolver(listaPrecioSchema),
    defaultValues: {
      codigo: '',
      nombre: '',
      tipo: 'personalizada',
      activa: true,
      margen_ganancia: undefined,
      vigencia_activa: false,
      fecha_vigencia_desde: undefined,
      fecha_vigencia_hasta: undefined,
    },
  })

  const tipo = watch('tipo')
  const activa = watch('activa')
  const vigenciaActiva = watch('vigencia_activa')

  const onSubmit = async (data: ListaPrecioInput) => {
    try {
      setIsLoading(true)

      const formData = new FormData()
      formData.append('codigo', data.codigo)
      formData.append('nombre', data.nombre)
      formData.append('tipo', data.tipo)
      formData.append('activa', data.activa.toString())
      formData.append('vigencia_activa', (data.vigencia_activa ?? false).toString())
      if (data.margen_ganancia !== undefined && data.margen_ganancia !== null) {
        formData.append('margen_ganancia', data.margen_ganancia.toString())
      }
      if (data.fecha_vigencia_desde) {
        formData.append('fecha_vigencia_desde', data.fecha_vigencia_desde)
      }
      if (data.fecha_vigencia_hasta) {
        formData.append('fecha_vigencia_hasta', data.fecha_vigencia_hasta)
      }

      const result = await crearListaPrecioAction(formData)

      if (result.success) {
        showToast('success', result.message || 'Lista de precios creada exitosamente')
        router.push(`/ventas/listas-precios/${result.data?.id || ''}`)
      } else {
        showToast('error', result.error || 'Error al crear lista de precios')
      }
    } catch (error: any) {
      console.error('Error creando lista de precios:', error)
      showToast('error', error.message || 'Error al crear lista de precios')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información de la Lista</CardTitle>
          <CardDescription>
            Completa los datos básicos de la lista de precios
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="codigo">Código *</Label>
              <Input
                id="codigo"
                placeholder="Ej: MINORISTA, MAYORISTA, PROMO_2025"
                {...register('codigo')}
                disabled={isLoading}
                className="uppercase"
              />
              {errors.codigo && (
                <p className="text-sm text-destructive">{errors.codigo.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                placeholder="Ej: Lista Minorista, Lista Mayorista"
                {...register('nombre')}
                disabled={isLoading}
              />
              {errors.nombre && (
                <p className="text-sm text-destructive">{errors.nombre.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo *</Label>
            <Select
              value={tipo}
              onValueChange={(value) => setValue('tipo', value as any)}
              disabled={isLoading}
            >
              <SelectTrigger id="tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minorista">Minorista</SelectItem>
                <SelectItem value="mayorista">Mayorista</SelectItem>
                <SelectItem value="distribuidor">Distribuidor</SelectItem>
                <SelectItem value="personalizada">Personalizada</SelectItem>
              </SelectContent>
            </Select>
            {errors.tipo && (
              <p className="text-sm text-destructive">{errors.tipo.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="margen_ganancia">Margen de Ganancia (%)</Label>
            <Input
              id="margen_ganancia"
              type="number"
              step="0.01"
              min="0"
              max="1000"
              placeholder="Ej: 30 (para 30% de margen)"
              {...register('margen_ganancia', { valueAsNumber: true })}
              disabled={isLoading}
            />
            {errors.margen_ganancia && (
              <p className="text-sm text-destructive">{errors.margen_ganancia.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Si configuras un margen, los precios se calcularán automáticamente desde el precio_costo del producto.
              Deja vacío para usar precios manuales por producto.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="vigencia_activa"
              checked={vigenciaActiva ?? false}
              onChange={(e) => setValue('vigencia_activa', e.target.checked)}
              disabled={isLoading}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="vigencia_activa">Validar vigencia por fechas</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Si está activado, la lista solo será válida entre las fechas especificadas. Si está desactivado, la lista estará vigente desde que se modifica hasta que se actualice (sin validar fechas).
          </p>

          {vigenciaActiva && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fecha_vigencia_desde">Vigencia Desde</Label>
                <Input
                  id="fecha_vigencia_desde"
                  type="date"
                  {...register('fecha_vigencia_desde')}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fecha_vigencia_hasta">Vigencia Hasta</Label>
                <Input
                  id="fecha_vigencia_hasta"
                  type="date"
                  {...register('fecha_vigencia_hasta')}
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="activa"
              checked={activa}
              onChange={(e) => setValue('activa', e.target.checked)}
              disabled={isLoading}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="activa">Lista activa</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" asChild disabled={isLoading}>
          <Link href="/ventas/listas-precios">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cancelar
          </Link>
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Crear Lista
            </>
          )}
        </Button>
      </div>
    </form>
  )
}

