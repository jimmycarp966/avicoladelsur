'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import Link from 'next/link'
import { empleadoSchema, type EmpleadoFormData } from '@/lib/schemas/rrhh.schema'
import { crearEmpleado } from '@/actions/rrhh.actions'
import { useNotificationStore } from '@/store/notificationStore'
import { createClient } from '@/lib/supabase/client'
import type { Usuario, Sucursal, CategoriaEmpleado } from '@/types/domain.types'

export function NuevoEmpleadoForm() {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(false)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [sucursales, setSucursales] = useState<Sucursal[]>([])
  const [categorias, setCategorias] = useState<CategoriaEmpleado[]>([])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EmpleadoFormData>({
    resolver: zodResolver(empleadoSchema),
    defaultValues: {
      activo: true,
    },
  })

  // Cargar datos de referencia
  useEffect(() => {
    const loadReferenceData = async () => {
      const supabase = createClient()

      // Cargar usuarios disponibles (sin empleado asignado)
      const { data: usuariosData } = await supabase
        .from('usuarios')
        .select('*')
        .eq('activo', true)
        .order('nombre')

      if (usuariosData) {
        setUsuarios(usuariosData)
      }

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

  const onSubmit = async (data: EmpleadoFormData) => {
    try {
      setIsLoading(true)

      const result = await crearEmpleado(data)

      if (result.success) {
        showToast(
          'success',
          result.message || 'El empleado ha sido creado exitosamente',
          'Empleado creado'
        )
        router.push('/rrhh/empleados')
      } else {
        showToast(
          'error',
          result.error || 'Ha ocurrido un error inesperado',
          'Error al crear empleado'
        )
      }
    } catch (error) {
      console.error('Error en onSubmit:', error)
      showToast(
        'error',
        'Ha ocurrido un error inesperado al crear el empleado',
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
          <Link href="/rrhh/empleados">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Empleados
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
              Datos personales y de contacto del empleado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Usuario */}
              <div className="space-y-2">
                <Label htmlFor="usuario_id">Usuario del Sistema</Label>
                <Select
                  value={watch('usuario_id') || ''}
                  onValueChange={(value) => setValue('usuario_id', value === 'none' ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar usuario" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin usuario asignado</SelectItem>
                    {usuarios.map((usuario) => (
                      <SelectItem key={usuario.id} value={usuario.id}>
                        {usuario.nombre} {usuario.apellido} ({usuario.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.usuario_id && (
                  <p className="text-sm text-red-600">{errors.usuario_id.message}</p>
                )}
              </div>

              {/* Legajo */}
              <div className="space-y-2">
                <Label htmlFor="legajo">Legajo</Label>
                <Input
                  id="legajo"
                  placeholder="Ej: EMP001"
                  {...register('legajo')}
                />
                {errors.legajo && (
                  <p className="text-sm text-red-600">{errors.legajo.message}</p>
                )}
              </div>

              {/* Fecha de ingreso */}
              <div className="space-y-2">
                <Label htmlFor="fecha_ingreso">Fecha de Ingreso *</Label>
                <Input
                  id="fecha_ingreso"
                  type="date"
                  {...register('fecha_ingreso')}
                />
                {errors.fecha_ingreso && (
                  <p className="text-sm text-red-600">{errors.fecha_ingreso.message}</p>
                )}
              </div>

              {/* Fecha de nacimiento */}
              <div className="space-y-2">
                <Label htmlFor="fecha_nacimiento">Fecha de Nacimiento</Label>
                <Input
                  id="fecha_nacimiento"
                  type="date"
                  {...register('fecha_nacimiento')}
                />
                {errors.fecha_nacimiento && (
                  <p className="text-sm text-red-600">{errors.fecha_nacimiento.message}</p>
                )}
              </div>

              {/* DNI */}
              <div className="space-y-2">
                <Label htmlFor="dni">DNI</Label>
                <Input
                  id="dni"
                  placeholder="Ej: 12345678"
                  {...register('dni')}
                />
                {errors.dni && (
                  <p className="text-sm text-red-600">{errors.dni.message}</p>
                )}
              </div>

              {/* CUIL */}
              <div className="space-y-2">
                <Label htmlFor="cuil">CUIL</Label>
                <Input
                  id="cuil"
                  placeholder="Ej: 20-12345678-9"
                  {...register('cuil')}
                />
                {errors.cuil && (
                  <p className="text-sm text-red-600">{errors.cuil.message}</p>
                )}
              </div>

              {/* Domicilio */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="domicilio">Domicilio</Label>
                <Textarea
                  id="domicilio"
                  placeholder="Dirección completa del empleado"
                  {...register('domicilio')}
                />
                {errors.domicilio && (
                  <p className="text-sm text-red-600">{errors.domicilio.message}</p>
                )}
              </div>

              {/* Teléfono personal */}
              <div className="space-y-2">
                <Label htmlFor="telefono_personal">Teléfono Personal</Label>
                <Input
                  id="telefono_personal"
                  placeholder="Ej: +54 11 1234-5678"
                  {...register('telefono_personal')}
                />
                {errors.telefono_personal && (
                  <p className="text-sm text-red-600">{errors.telefono_personal.message}</p>
                )}
              </div>

              {/* Contacto de emergencia */}
              <div className="space-y-2">
                <Label htmlFor="contacto_emergencia">Contacto de Emergencia</Label>
                <Input
                  id="contacto_emergencia"
                  placeholder="Nombre del contacto"
                  {...register('contacto_emergencia')}
                />
                {errors.contacto_emergencia && (
                  <p className="text-sm text-red-600">{errors.contacto_emergencia.message}</p>
                )}
              </div>

              {/* Teléfono de emergencia */}
              <div className="space-y-2">
                <Label htmlFor="telefono_emergencia">Teléfono de Emergencia</Label>
                <Input
                  id="telefono_emergencia"
                  placeholder="Ej: +54 11 8765-4321"
                  {...register('telefono_emergencia')}
                />
                {errors.telefono_emergencia && (
                  <p className="text-sm text-red-600">{errors.telefono_emergencia.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Información laboral */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              Información Laboral
            </CardTitle>
            <CardDescription>
              Sucursal, categoría y datos salariales
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sucursal */}
              <div className="space-y-2">
                <Label htmlFor="sucursal_id">Sucursal</Label>
                <Select
                  value={watch('sucursal_id') || ''}
                  onValueChange={(value) => setValue('sucursal_id', value === 'none' ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin sucursal asignada</SelectItem>
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

              {/* Categoría */}
              <div className="space-y-2">
                <Label htmlFor="categoria_id">Categoría</Label>
                <Select
                  value={watch('categoria_id') || ''}
                  onValueChange={(value) => setValue('categoria_id', value === 'none' ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin categoría asignada</SelectItem>
                    {categorias.map((categoria) => (
                      <SelectItem key={categoria.id} value={categoria.id}>
                        {categoria.nombre} - ${categoria.sueldo_basico.toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.categoria_id && (
                  <p className="text-sm text-red-600">{errors.categoria_id.message}</p>
                )}
              </div>

              {/* Sueldo actual */}
              <div className="space-y-2">
                <Label htmlFor="sueldo_actual">Sueldo Actual</Label>
                <Input
                  id="sueldo_actual"
                  type="number"
                  placeholder="Ej: 150000"
                  {...register('sueldo_actual', { valueAsNumber: true })}
                />
                {errors.sueldo_actual && (
                  <p className="text-sm text-red-600">{errors.sueldo_actual.message}</p>
                )}
              </div>

              {/* Estado activo */}
              <div className="space-y-2">
                <Label htmlFor="activo">Estado</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="activo"
                    checked={watch('activo') ?? true}
                    onCheckedChange={(checked) => setValue('activo', checked)}
                  />
                  <Label htmlFor="activo" className="text-sm">
                    {watch('activo') ?? true ? 'Activo' : 'Inactivo'}
                  </Label>
                </div>
                {errors.activo && (
                  <p className="text-sm text-red-600">{errors.activo.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Información adicional */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              Información Adicional
            </CardTitle>
            <CardDescription>
              Datos bancarios y de obra social
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Obra social */}
              <div className="space-y-2">
                <Label htmlFor="obra_social">Obra Social</Label>
                <Input
                  id="obra_social"
                  placeholder="Ej: OSDE, Swiss Medical"
                  {...register('obra_social')}
                />
                {errors.obra_social && (
                  <p className="text-sm text-red-600">{errors.obra_social.message}</p>
                )}
              </div>

              {/* Número de afiliado */}
              <div className="space-y-2">
                <Label htmlFor="numero_afiliado">Número de Afiliado</Label>
                <Input
                  id="numero_afiliado"
                  placeholder="Ej: 123456789"
                  {...register('numero_afiliado')}
                />
                {errors.numero_afiliado && (
                  <p className="text-sm text-red-600">{errors.numero_afiliado.message}</p>
                )}
              </div>

              {/* Banco */}
              <div className="space-y-2">
                <Label htmlFor="banco">Banco</Label>
                <Input
                  id="banco"
                  placeholder="Ej: Banco Nación, Santander"
                  {...register('banco')}
                />
                {errors.banco && (
                  <p className="text-sm text-red-600">{errors.banco.message}</p>
                )}
              </div>

              {/* CBU */}
              <div className="space-y-2">
                <Label htmlFor="cbu">CBU</Label>
                <Input
                  id="cbu"
                  placeholder="Ej: 1234567890123456789012"
                  {...register('cbu')}
                />
                {errors.cbu && (
                  <p className="text-sm text-red-600">{errors.cbu.message}</p>
                )}
              </div>

              {/* Número de cuenta */}
              <div className="space-y-2">
                <Label htmlFor="numero_cuenta">Número de Cuenta</Label>
                <Input
                  id="numero_cuenta"
                  placeholder="Ej: 123-456789/0"
                  {...register('numero_cuenta')}
                />
                {errors.numero_cuenta && (
                  <p className="text-sm text-red-600">{errors.numero_cuenta.message}</p>
                )}
              </div>
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
                Crear Empleado
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
