'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Loader2, Save, DollarSign, Package } from 'lucide-react'
import Link from 'next/link'
import { adelantoSchema, type AdelantoFormData } from '@/lib/schemas/rrhh.schema'
import { crearAdelantoAction } from '@/actions/rrhh.actions'
import { useNotificationStore } from '@/store/notificationStore'
import { createClient } from '@/lib/supabase/client'
import type { Empleado, Producto } from '@/types/domain.types'

export function NuevoAdelantoForm() {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(false)
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [productos, setProductos] = useState<Producto[]>([])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AdelantoFormData>({
    resolver: zodResolver(adelantoSchema),
    defaultValues: {
      tipo: 'dinero',
      fecha_solicitud: new Date().toISOString().split('T')[0],
    },
  })

  const tipoSeleccionado = watch('tipo')

  // Cargar datos de referencia
  useEffect(() => {
    const loadReferenceData = async () => {
      const supabase = createClient()

      // Cargar empleados activos
      const { data: empleadosData } = await supabase
        .from('rrhh_empleados')
        .select(`
          *,
          usuario:usuarios(id, nombre, apellido, email)
        `)
        .eq('activo', true)
        .order('legajo')

      if (empleadosData) {
        setEmpleados(empleadosData as Empleado[])
      }

      // Cargar productos activos (solo si el tipo es producto)
      if (tipoSeleccionado === 'producto') {
        const { data: productosData } = await supabase
          .from('productos')
          .select('*')
          .eq('activo', true)
          .order('nombre')

        if (productosData) {
          setProductos(productosData as Producto[])
        }
      }
    }

    loadReferenceData()
  }, [tipoSeleccionado])

  // Resetear campos cuando cambia el tipo
  useEffect(() => {
    if (tipoSeleccionado === 'dinero') {
      setValue('producto_id', undefined)
      setValue('cantidad', undefined)
      setValue('precio_unitario', undefined)
    } else {
      setValue('monto', undefined)
    }
  }, [tipoSeleccionado, setValue])

  const onSubmit = async (data: AdelantoFormData) => {
    try {
      setIsLoading(true)

      // Validar que los campos requeridos estén presentes según el tipo
      if (data.tipo === 'dinero' && !data.monto) {
        showToast('error', 'El monto es requerido para adelantos en dinero', 'Error de validación')
        setIsLoading(false)
        return
      }

      if (data.tipo === 'producto') {
        if (!data.producto_id || !data.cantidad || !data.precio_unitario) {
          showToast('error', 'Producto, cantidad y precio unitario son requeridos para adelantos en productos', 'Error de validación')
          setIsLoading(false)
          return
        }
      }

      const result = await crearAdelantoAction(data)

      if (result.success) {
        showToast(
          'success',
          result.message || 'El adelanto ha sido creado exitosamente',
          'Adelanto creado'
        )
        router.push('/rrhh/adelantos')
      } else {
        showToast(
          'error',
          result.error || 'Ha ocurrido un error inesperado',
          'Error al crear adelanto'
        )
      }
    } catch (error) {
      console.error('Error en onSubmit:', error)
      showToast(
        'error',
        'Ha ocurrido un error inesperado al crear el adelanto',
        'Error inesperado'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Botón volver */}
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/rrhh/adelantos">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Adelantos
          </Link>
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Información básica */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              Información Básica
            </CardTitle>
            <CardDescription>
              Seleccione el empleado y el tipo de adelanto
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Empleado */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="empleado_id">Empleado *</Label>
                <Select
                  value={watch('empleado_id') || ''}
                  onValueChange={(value) => setValue('empleado_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar empleado" />
                  </SelectTrigger>
                  <SelectContent>
                    {empleados.map((empleado) => {
                      const nombre = empleado.usuario?.nombre || ''
                      const apellido = empleado.usuario?.apellido || ''
                      const nombreCompleto = `${nombre} ${apellido}`.trim()
                      return (
                        <SelectItem key={empleado.id} value={empleado.id}>
                          {nombreCompleto || 'Sin nombre'} {empleado.legajo && `- ${empleado.legajo}`}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                {errors.empleado_id && (
                  <p className="text-sm text-red-600">{errors.empleado_id.message}</p>
                )}
              </div>

              {/* Tipo */}
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo de Adelanto *</Label>
                <Select
                  value={watch('tipo') || 'dinero'}
                  onValueChange={(value) => setValue('tipo', value as 'dinero' | 'producto')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dinero">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Dinero
                      </div>
                    </SelectItem>
                    <SelectItem value="producto">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        Producto
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {errors.tipo && (
                  <p className="text-sm text-red-600">{errors.tipo.message}</p>
                )}
              </div>

              {/* Fecha de solicitud */}
              <div className="space-y-2">
                <Label htmlFor="fecha_solicitud">Fecha de Solicitud *</Label>
                <Input
                  id="fecha_solicitud"
                  type="date"
                  {...register('fecha_solicitud')}
                />
                {errors.fecha_solicitud && (
                  <p className="text-sm text-red-600">{errors.fecha_solicitud.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detalles según tipo */}
        {tipoSeleccionado === 'dinero' ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Detalles del Adelanto en Dinero
              </CardTitle>
              <CardDescription>
                Ingrese el monto del adelanto (máximo 30% del sueldo básico)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Monto */}
                <div className="space-y-2">
                  <Label htmlFor="monto">Monto *</Label>
                  <Input
                    id="monto"
                    type="number"
                    step="0.01"
                    placeholder="Ej: 50000"
                    {...register('monto', { valueAsNumber: true })}
                  />
                  {errors.monto && (
                    <p className="text-sm text-red-600">{errors.monto.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    El sistema validará automáticamente que no supere el 30% del sueldo básico
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                Detalles del Adelanto en Producto
              </CardTitle>
              <CardDescription>
                Seleccione el producto y la cantidad
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Producto */}
                <div className="space-y-2">
                  <Label htmlFor="producto_id">Producto *</Label>
                  <Select
                    value={watch('producto_id') || ''}
                    onValueChange={(value) => setValue('producto_id', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar producto" />
                    </SelectTrigger>
                    <SelectContent>
                      {productos.map((producto) => (
                        <SelectItem key={producto.id} value={producto.id}>
                          {producto.nombre} {producto.codigo && `(${producto.codigo})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.producto_id && (
                    <p className="text-sm text-red-600">{errors.producto_id.message}</p>
                  )}
                </div>

                {/* Cantidad */}
                <div className="space-y-2">
                  <Label htmlFor="cantidad">Cantidad *</Label>
                  <Input
                    id="cantidad"
                    type="number"
                    step="0.01"
                    placeholder="Ej: 10"
                    {...register('cantidad', { valueAsNumber: true })}
                  />
                  {errors.cantidad && (
                    <p className="text-sm text-red-600">{errors.cantidad.message}</p>
                  )}
                </div>

                {/* Precio unitario */}
                <div className="space-y-2">
                  <Label htmlFor="precio_unitario">Precio Unitario *</Label>
                  <Input
                    id="precio_unitario"
                    type="number"
                    step="0.01"
                    placeholder="Ej: 1500"
                    {...register('precio_unitario', { valueAsNumber: true })}
                  />
                  {errors.precio_unitario && (
                    <p className="text-sm text-red-600">{errors.precio_unitario.message}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Observaciones */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              Observaciones
            </CardTitle>
            <CardDescription>
              Información adicional sobre el adelanto (opcional)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                placeholder="Ingrese observaciones adicionales..."
                rows={4}
                {...register('observaciones')}
              />
              {errors.observaciones && (
                <p className="text-sm text-red-600">{errors.observaciones.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Botones de acción */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Crear Adelanto
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

