'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Loader2, Save, MapPin } from 'lucide-react'
import Link from 'next/link'
import { clienteSchema, type ClienteFormData } from '@/lib/schemas/clientes.schema'
import { useNotificationStore } from '@/store/notificationStore'

interface ClienteFormProps {
  cliente?: {
    id: string
    nombre: string
    telefono?: string
    whatsapp?: string
    email?: string
    direccion?: string
    zona_entrega?: string
    coordenadas?: { lat: number; lng: number }
    tipo_cliente: string
    limite_credito: number
    activo: boolean
  }
  onSuccess?: () => void
}

export function ClienteForm({ cliente, onSuccess }: ClienteFormProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(false)
  const isEditing = !!cliente

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ClienteFormData>({
    resolver: zodResolver(clienteSchema),
    defaultValues: cliente ? {
      nombre: cliente.nombre,
      telefono: cliente.telefono || '',
      whatsapp: cliente.whatsapp || '',
      email: cliente.email || '',
      direccion: cliente.direccion || '',
      zona_entrega: cliente.zona_entrega || '',
      coordenadas: cliente.coordenadas,
      tipo_cliente: cliente.tipo_cliente as 'minorista' | 'mayorista' | 'distribuidor',
      limite_credito: cliente.limite_credito,
      activo: cliente.activo,
    } : {
      nombre: '',
      telefono: '',
      whatsapp: '',
      email: '',
      direccion: '',
      zona_entrega: '',
      tipo_cliente: 'minorista' as const,
      limite_credito: 0,
      activo: true,
    },
  })

  const activo = watch('activo')
  const tipoCliente = watch('tipo_cliente')

  const onSubmit = async (data: ClienteFormData) => {
    try {
      setIsLoading(true)

      const { crearCliente, actualizarCliente } = await import('@/actions/ventas.actions')
      
      const result = isEditing
        ? await actualizarCliente(cliente.id, data)
        : await crearCliente(data)

      if (!result.success) {
        throw new Error(result.error || 'Error al guardar cliente')
      }

      showToast('success', result.message || (isEditing ? 'Cliente actualizado exitosamente' : 'Cliente creado exitosamente'))

      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/ventas/clientes')
      }
    } catch (error: any) {
      console.error('Error saving cliente:', error)
      showToast('error', error.message || 'Error al guardar cliente')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Información básica */}
      <Card className="border-l-[3px] border-l-primary">
        <CardHeader>
          <CardTitle className="text-primary">Información Básica</CardTitle>
          <CardDescription>
            Datos principales del cliente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              placeholder="Nombre completo del cliente"
              {...register('nombre')}
              disabled={isLoading}
            />
            {errors.nombre && (
              <p className="text-sm text-destructive">{errors.nombre.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo_cliente">Tipo de Cliente *</Label>
              <select
                id="tipo_cliente"
                {...register('tipo_cliente')}
                disabled={isLoading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="minorista">Minorista</option>
                <option value="mayorista">Mayorista</option>
                <option value="distribuidor">Distribuidor</option>
              </select>
              {errors.tipo_cliente && (
                <p className="text-sm text-destructive">{errors.tipo_cliente.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="limite_credito">Límite de Crédito *</Label>
              <Input
                id="limite_credito"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...register('limite_credito', { valueAsNumber: true })}
                disabled={isLoading}
              />
              {errors.limite_credito && (
                <p className="text-sm text-destructive">{errors.limite_credito.message}</p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="activo"
              checked={activo}
              onCheckedChange={(checked) => setValue('activo', checked)}
              disabled={isLoading}
            />
            <Label htmlFor="activo">Cliente activo</Label>
          </div>
        </CardContent>
      </Card>

      {/* Información de contacto */}
      <Card className="border-l-[3px] border-l-success">
        <CardHeader>
          <CardTitle className="text-success">Información de Contacto</CardTitle>
          <CardDescription>
            Teléfonos, email y dirección del cliente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                placeholder="+5491123456789"
                {...register('telefono')}
                disabled={isLoading}
              />
              {errors.telefono && (
                <p className="text-sm text-destructive">{errors.telefono.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                placeholder="+5491123456789"
                {...register('whatsapp')}
                disabled={isLoading}
              />
              {errors.whatsapp && (
                <p className="text-sm text-destructive">{errors.whatsapp.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="cliente@email.com"
              {...register('email')}
              disabled={isLoading}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dirección y zona */}
      <Card className="border-l-[3px] border-l-info">
        <CardHeader>
          <CardTitle className="text-info">Dirección y Zona de Entrega</CardTitle>
          <CardDescription>
            Ubicación del cliente para entregas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="direccion">Dirección</Label>
            <Textarea
              id="direccion"
              placeholder="Dirección completa del cliente"
              rows={3}
              {...register('direccion')}
              disabled={isLoading}
            />
            {errors.direccion && (
              <p className="text-sm text-destructive">{errors.direccion.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="zona_entrega">Zona de Entrega</Label>
            <Input
              id="zona_entrega"
              placeholder="Ej: Centro, Norte, Sur, etc."
              {...register('zona_entrega')}
              disabled={isLoading}
            />
            {errors.zona_entrega && (
              <p className="text-sm text-destructive">{errors.zona_entrega.message}</p>
            )}
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <MapPin className="h-4 w-4" />
              <span>Coordenadas GPS (opcional)</span>
            </div>
            <p className="text-xs text-gray-500">
              Las coordenadas se pueden agregar automáticamente desde la dirección
              o se pueden ingresar manualmente para mayor precisión en las rutas.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Acciones */}
      <div className="flex items-center justify-between sticky bottom-4 bg-background/95 backdrop-blur-sm p-4 rounded-lg border border-primary/10 shadow-lg">
        <Button type="button" variant="outline" asChild disabled={isLoading} className="hover:bg-primary/5 hover:text-primary hover:border-primary/30">
          <Link href="/ventas/clientes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>

        <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/90 shadow-sm">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isEditing ? 'Actualizando...' : 'Creando...'}
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {isEditing ? 'Actualizar Cliente' : 'Crear Cliente'}
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
