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
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Loader2, Save, X, Plus, Tag } from 'lucide-react'
import { GoogleMapSelector } from '@/components/ui/google-map-selector'
import Link from 'next/link'
import { clienteSchema, type ClienteFormData } from '@/lib/schemas/clientes.schema'
import { useNotificationStore } from '@/store/notificationStore'
import { 
  obtenerListasClienteAction, 
  obtenerListasPreciosAction,
  asignarListaClienteAction,
  desasignarListaClienteAction 
} from '@/actions/listas-precios.actions'

interface ClienteFormProps {
  cliente?: {
    id: string
    codigo: string
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
  const [listasAsignadas, setListasAsignadas] = useState<Array<{ 
    id: string
    lista_precio: { id: string; nombre: string; codigo: string; tipo: string }
    es_automatica: boolean
    prioridad: number
  }>>([])
  const [listasDisponibles, setListasDisponibles] = useState<Array<{ id: string; nombre: string; codigo: string }>>([])
  const [cargandoListas, setCargandoListas] = useState(false)
  const [listaSeleccionada, setListaSeleccionada] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ClienteFormData>({
    resolver: zodResolver(clienteSchema),
    defaultValues: cliente ? {
      codigo: cliente.codigo || '',
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
      codigo: '',
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

  // Cargar listas asignadas cuando se edita un cliente
  useEffect(() => {
    const cargarListas = async () => {
      if (!isEditing || !cliente?.id) return

      setCargandoListas(true)
      const [asignadasResult, disponiblesResult] = await Promise.all([
        obtenerListasClienteAction(cliente.id),
        obtenerListasPreciosAction({ activa: true })
      ])

      if (asignadasResult.success && asignadasResult.data) {
        setListasAsignadas(asignadasResult.data as any)
      }

      if (disponiblesResult.success && disponiblesResult.data) {
        setListasDisponibles(disponiblesResult.data as any)
      }

      setCargandoListas(false)
    }

    cargarListas()
  }, [isEditing, cliente?.id])

  const handleAsignarLista = async () => {
    if (!cliente?.id || !listaSeleccionada) return

    const result = await asignarListaClienteAction(cliente.id, listaSeleccionada)
    if (result.success) {
      showToast('success', 'Lista asignada exitosamente')
      setListaSeleccionada('')
      // Recargar listas
      const asignadasResult = await obtenerListasClienteAction(cliente.id)
      if (asignadasResult.success && asignadasResult.data) {
        setListasAsignadas(asignadasResult.data as any)
      }
    } else {
      showToast('error', result.message || 'Error al asignar lista')
    }
  }

  const handleDesasignarLista = async (listaPrecioId: string, esAutomatica: boolean) => {
    if (!cliente?.id) return

    if (esAutomatica) {
      showToast('error', 'No se puede desasignar una lista automática')
      return
    }

    if (!confirm('¿Estás seguro de desasignar esta lista?')) return

    const result = await desasignarListaClienteAction(cliente.id, listaPrecioId)
    if (result.success) {
      showToast('success', 'Lista desasignada exitosamente')
      // Recargar listas
      const asignadasResult = await obtenerListasClienteAction(cliente.id)
      if (asignadasResult.success && asignadasResult.data) {
        setListasAsignadas(asignadasResult.data as any)
      }
    } else {
      showToast('error', result.message || 'Error al desasignar lista')
    }
  }

  // Filtrar listas disponibles (excluir las ya asignadas)
  const listasParaAsignar = listasDisponibles.filter(
    lista => !listasAsignadas.some(asignada => asignada.lista_precio.id === lista.id)
  )

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
            <Label htmlFor="codigo">Código *</Label>
            <Input
              id="codigo"
              placeholder="Ej: 115, CLI-001"
              {...register('codigo')}
              disabled={isLoading}
              className="uppercase"
            />
            {errors.codigo && (
              <p className="text-sm text-destructive">{errors.codigo.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Código único del cliente (números o letras mayúsculas)
            </p>
          </div>

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            Ubicación del cliente para entregas y optimización de rutas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          {/* Mapa de Google Maps */}
          <GoogleMapSelector
            coordenadas={watch('coordenadas') || null}
            onCoordenadasChange={(coords) => setValue('coordenadas', coords || undefined)}
            direccion={watch('direccion') || ''}
            onDireccionChange={(direccion) => setValue('direccion', direccion)}
            placeholder="Buscar dirección del cliente..."
          />

          {/* Campo de dirección (solo lectura, actualizado por el mapa) */}
          <div className="space-y-2">
            <Label htmlFor="direccion">Dirección Completa</Label>
            <Textarea
              id="direccion"
              placeholder="La dirección se actualizará automáticamente al seleccionar una ubicación en el mapa"
              rows={2}
              {...register('direccion')}
              disabled={isLoading}
              className="resize-none"
            />
            {errors.direccion && (
              <p className="text-sm text-destructive">{errors.direccion.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Puedes editar manualmente la dirección si es necesario, o usar el mapa para autocompletar.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Listas de Precios (solo al editar) */}
      {isEditing && cliente && (
        <Card className="border-l-[3px] border-l-accent">
          <CardHeader>
            <CardTitle className="text-accent flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Listas de Precios Asignadas
            </CardTitle>
            <CardDescription>
              Gestiona las listas de precios asignadas a este cliente (máximo 2)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cargandoListas ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Listas asignadas */}
                <div className="space-y-2">
                  {listasAsignadas.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No hay listas asignadas. Se asignará automáticamente según el tipo de cliente.
                    </p>
                  ) : (
                    listasAsignadas.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 border rounded-lg bg-background"
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {item.lista_precio.codigo} - {item.lista_precio.nombre}
                              </span>
                              {item.es_automatica && (
                                <Badge variant="secondary" className="text-xs">
                                  Automática
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs">
                                Prioridad {item.prioridad}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Tipo: {item.lista_precio.tipo}
                            </p>
                          </div>
                        </div>
                        {!item.es_automatica && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDesasignarLista(item.lista_precio.id, item.es_automatica)}
                            className="text-destructive hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Asignar nueva lista */}
                {listasAsignadas.length < 2 && listasParaAsignar.length > 0 && (
                  <div className="flex gap-2 pt-2 border-t">
                    <Select value={listaSeleccionada} onValueChange={setListaSeleccionada}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Seleccionar lista para asignar" />
                      </SelectTrigger>
                      <SelectContent>
                        {listasParaAsignar.map((lista) => (
                          <SelectItem key={lista.id} value={lista.id}>
                            {lista.codigo} - {lista.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAsignarLista}
                      disabled={!listaSeleccionada}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Asignar
                    </Button>
                  </div>
                )}

                {listasAsignadas.length >= 2 && (
                  <p className="text-sm text-muted-foreground py-2">
                    El cliente ya tiene 2 listas asignadas (máximo permitido)
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky bottom-4 bg-background/95 backdrop-blur-sm p-4 rounded-lg border border-primary/10 shadow-lg">
        <Button type="button" variant="outline" asChild disabled={isLoading} className="hover:bg-primary/5 hover:text-primary hover:border-primary/30 w-full sm:w-auto order-2 sm:order-1">
          <Link href="/ventas/clientes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>

        <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/90 shadow-sm w-full sm:w-auto order-1 sm:order-2">
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
