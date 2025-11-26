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
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Loader2, Save, Megaphone, Users, Building } from 'lucide-react'
import Link from 'next/link'
import { novedadRRHHSchema, type NovedadRRHHFormData } from '@/lib/schemas/rrhh.schema'
import { crearNovedad } from '@/actions/rrhh.actions'
import { useNotificationStore } from '@/store/notificationStore'
import { createClient } from '@/lib/supabase/client'
import type { Sucursal, CategoriaEmpleado } from '@/types/domain.types'

export function NuevaNovedadForm() {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(false)
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [categorias, setCategorias] = useState<CategoriaEmpleado[]>([])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<NovedadRRHHFormData>({
    resolver: zodResolver(novedadRRHHSchema),
    defaultValues: {
      tipo: 'general',
      prioridad: 'normal',
      activo: true,
    },
  })

  const tipoSeleccionado = watch('tipo')

  // Cargar datos de referencia
  useEffect(() => {
    const loadReferenceData = async () => {
      const supabase = createClient()

      // Cargar sucursales activas
      const { data: sucursalesData } = await supabase
        .from('sucursales')
        .select('*')
        .eq('activo', true)
        .order('nombre')

      if (sucursalesData) {
        setSucursales(sucursalesData)
      }

      // Cargar categorías activas
      const { data: categoriasData } = await supabase
        .from('rrhh_categorias')
        .select('*')
        .eq('activo', true)
        .order('nombre')

      if (categoriasData) {
        setCategorias(categoriasData)
      }
    }

    loadReferenceData()
  }, [])

  // Resetear campos cuando cambia el tipo
  useEffect(() => {
    if (tipoSeleccionado === 'general') {
      setValue('sucursal_id', undefined)
      setValue('categoria_id', undefined)
    } else if (tipoSeleccionado === 'sucursal') {
      setValue('categoria_id', undefined)
    } else if (tipoSeleccionado === 'categoria') {
      setValue('sucursal_id', undefined)
    }
  }, [tipoSeleccionado, setValue])

  const onSubmit = async (data: NovedadRRHHFormData) => {
    try {
      setIsLoading(true)

      const result = await crearNovedad(data)

      if (result.success) {
        showToast(
          'success',
          result.message || 'La novedad ha sido creada exitosamente',
          'Novedad creada'
        )
        router.push('/admin/rrhh/novedades')
      } else {
        showToast(
          'error',
          result.error || 'Ha ocurrido un error inesperado',
          'Error al crear novedad'
        )
      }
    } catch (error) {
      console.error('Error en onSubmit:', error)
      showToast(
        'error',
        'Ha ocurrido un error inesperado al crear la novedad',
        'Error inesperado'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const getTipoDescription = (tipo: string) => {
    switch (tipo) {
      case 'general':
        return 'Visible para todo el personal activo de la empresa'
      case 'sucursal':
        return 'Visible solo para empleados de la sucursal seleccionada'
      case 'categoria':
        return 'Visible solo para empleados de la categoría seleccionada'
      default:
        return ''
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Botón volver */}
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/admin/rrhh/novedades">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Novedades
          </Link>
        </Button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Información básica */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-blue-600" />
              Información de la Novedad
            </CardTitle>
            <CardDescription>
              Detalles principales de la comunicación interna
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                placeholder="Ej: Cambio de horario de verano"
                {...register('titulo')}
              />
              {errors.titulo && (
                <p className="text-sm text-red-600">{errors.titulo.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                placeholder="Detalles de la novedad..."
                rows={4}
                {...register('descripcion')}
              />
              {errors.descripcion && (
                <p className="text-sm text-red-600">{errors.descripcion.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo de Novedad *</Label>
                <Select
                  value={watch('tipo') || 'general'}
                  onValueChange={(value) => setValue('tipo', value as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">
                      <div className="flex items-center gap-2">
                        <Megaphone className="w-4 h-4" />
                        General
                      </div>
                    </SelectItem>
                    <SelectItem value="sucursal">
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4" />
                        Por Sucursal
                      </div>
                    </SelectItem>
                    <SelectItem value="categoria">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Por Categoría
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {errors.tipo && (
                  <p className="text-sm text-red-600">{errors.tipo.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="prioridad">Prioridad *</Label>
                <Select
                  value={watch('prioridad') || 'normal'}
                  onValueChange={(value) => setValue('prioridad', value as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
                {errors.prioridad && (
                  <p className="text-sm text-red-600">{errors.prioridad.message}</p>
                )}
              </div>
            </div>

            {/* Campos condicionales según el tipo */}
            {tipoSeleccionado === 'sucursal' && (
              <div className="space-y-2">
                <Label htmlFor="sucursal_id">Sucursal *</Label>
                <Select
                  value={watch('sucursal_id') || ''}
                  onValueChange={(value) => setValue('sucursal_id', value === 'none' ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    {sucursales.map((sucursal) => (
                      <SelectItem key={sucursal.id} value={sucursal.id}>
                        {sucursal.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.sucursal_id && (
                  <p className="text-sm text-red-600">{errors.sucursal_id.message}</p>
                )}
              </div>
            )}

            {tipoSeleccionado === 'categoria' && (
              <div className="space-y-2">
                <Label htmlFor="categoria_id">Categoría *</Label>
                <Select
                  value={watch('categoria_id') || ''}
                  onValueChange={(value) => setValue('categoria_id', value === 'none' ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((categoria) => (
                      <SelectItem key={categoria.id} value={categoria.id}>
                        {categoria.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.categoria_id && (
                  <p className="text-sm text-red-600">{errors.categoria_id.message}</p>
                )}
              </div>
            )}

            {/* Información del alcance */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Megaphone className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-900">Alcance de la novedad</span>
              </div>
              <p className="text-blue-700 text-sm">
                {getTipoDescription(tipoSeleccionado)}
                {tipoSeleccionado === 'sucursal' && watch('sucursal_id') &&
                  ` (Sucursal: ${sucursales.find(s => s.id === watch('sucursal_id'))?.nombre})`
                }
                {tipoSeleccionado === 'categoria' && watch('categoria_id') &&
                  ` (Categoría: ${categorias.find(c => c.id === watch('categoria_id'))?.nombre})`
                }
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Configuración */}
        <Card>
          <CardHeader>
            <CardTitle>Configuración</CardTitle>
            <CardDescription>
              Fechas y estado de publicación
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fecha_publicacion">Fecha de Publicación *</Label>
                <Input
                  id="fecha_publicacion"
                  type="date"
                  {...register('fecha_publicacion')}
                />
                {errors.fecha_publicacion && (
                  <p className="text-sm text-red-600">{errors.fecha_publicacion.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fecha_expiracion">Fecha de Expiración (opcional)</Label>
                <Input
                  id="fecha_expiracion"
                  type="date"
                  {...register('fecha_expiracion')}
                />
                {errors.fecha_expiracion && (
                  <p className="text-sm text-red-600">{errors.fecha_expiracion.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="activo">Estado</Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="activo"
                  checked={watch('activo') ?? true}
                  onCheckedChange={(checked) => setValue('activo', checked)}
                />
                <Label htmlFor="activo" className="text-sm">
                  {watch('activo') ?? true ? 'Activa (visible)' : 'Inactiva (oculta)'}
                </Label>
              </div>
              {errors.activo && (
                <p className="text-sm text-red-600">{errors.activo.message}</p>
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
                Crear Novedad
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
