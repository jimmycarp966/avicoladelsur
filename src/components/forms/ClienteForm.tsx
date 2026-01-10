'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Loader2, Save, X, Plus, Tag, Clock, Users, Trash2 } from 'lucide-react'
import { GoogleMapSelector } from '@/components/ui/google-map-selector'
import Link from 'next/link'
import { clienteSchema, type ClienteFormData } from '@/lib/schemas/clientes.schema'
import { useNotificationStore } from '@/store/notificationStore'
import { useFormShortcuts } from '@/lib/hooks/useFormShortcuts'
import { useFormContextShortcuts } from '@/lib/hooks/useFormContextShortcuts'
import { KeyboardHintCompact } from '@/components/ui/keyboard-hint'
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
    cuit?: string
    nombre: string
    telefono?: string
    whatsapp?: string
    email?: string
    direccion?: string
    zona_entrega?: string
    zona_id?: string
    coordenadas?: { lat: number; lng: number }
    tipo_cliente: string
    limite_credito: number
    activo: boolean
    // Horarios de apertura
    horario_lunes?: string
    horario_martes?: string
    horario_miercoles?: string
    horario_jueves?: string
    horario_viernes?: string
    horario_sabado?: string
    horario_sabado?: string
    horario_domingo?: string
    identificadores?: Array<{ dni_cuit: string; nombre_titular: string; relacion?: string }>
  }
  zonas?: Array<{ id: string; nombre: string }>
  onSuccess?: () => void
}

export function ClienteForm({ cliente, zonas = [], onSuccess }: ClienteFormProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(false)
  const isEditing = !!cliente
  const submitButtonRef = useRef<HTMLButtonElement>(null)
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
    control,
    formState: { errors },
  } = useForm<ClienteFormData>({
    resolver: zodResolver(clienteSchema),
    defaultValues: cliente ? {
      codigo: cliente.codigo || '',
      cuit: cliente.cuit || '',
      nombre: cliente.nombre,
      telefono: cliente.telefono || '',
      whatsapp: cliente.whatsapp || '',
      email: cliente.email || '',
      direccion: cliente.direccion || '',
      zona_entrega: cliente.zona_entrega || '',
      zona_id: cliente.zona_id || null, // Priorizar el ID si existe
      coordenadas: cliente.coordenadas,
      tipo_cliente: cliente.tipo_cliente as 'minorista' | 'mayorista' | 'distribuidor',
      limite_credito: cliente.limite_credito,
      activo: cliente.activo,
      // Horarios
      horario_lunes: cliente.horario_lunes || '',
      horario_martes: cliente.horario_martes || '',
      horario_miercoles: cliente.horario_miercoles || '',
      horario_jueves: cliente.horario_jueves || '',
      horario_viernes: cliente.horario_viernes || '',
      horario_sabado: cliente.horario_sabado || '',
      horario_domingo: cliente.horario_domingo || '',
      identificadores: cliente.identificadores || [],
    } : {
      codigo: '',
      cuit: '',
      nombre: '',
      telefono: '',
      whatsapp: '',
      email: '',
      direccion: '',
      zona_entrega: '',
      zona_id: null,
      coordenadas: null,
      tipo_cliente: 'minorista' as const,
      limite_credito: 0,
      activo: true,
      horario_lunes: '',
      horario_martes: '',
      horario_miercoles: '',
      horario_jueves: '',
      horario_viernes: '',
      horario_sabado: '',
      horario_domingo: '',
    },
  })

  const activo = watch('activo')
  const tipoCliente = watch('tipo_cliente')

  const { fields: camposIdentificadores, append: appendIdentificador, remove: removeIdentificador } = useFieldArray({
    control,
    name: "identificadores"
  })

  // Atajos contextuales para campos del formulario
  // Nota: Los shortcuts sin modificadores están protegidos por useKeyboardShortcuts
  // que ignora shortcuts cuando se está escribiendo en inputs
  useFormContextShortcuts({
    shortcuts: [
      { key: 'c', fieldId: 'codigo', description: 'Código' },
      { key: 'n', fieldId: 'nombre', description: 'Nombre' },
      { key: 't', fieldId: 'telefono', description: 'Teléfono' },
      { key: 'w', fieldId: 'whatsapp', description: 'WhatsApp' },
      { key: 'e', fieldId: 'email', description: 'Email' },
      { key: 'd', fieldId: 'direccion', description: 'Dirección' },
      { key: 'z', fieldId: 'zona_id', description: 'Zona de Entrega' },
    ],
  })

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

      const { crearClienteAction, actualizarClienteAction } = await import('@/actions/ventas.actions')

      const result = isEditing
        ? await actualizarClienteAction(cliente.id, data)
        : await crearClienteAction(data)

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
            Datos principales del cliente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="codigo" className="flex items-center gap-2">
              Código *
              <KeyboardHintCompact shortcut="C" />
            </Label>
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
            <Label htmlFor="cuit" className="flex items-center gap-2">
              DNI / CUIT / CUIL
            </Label>
            <Input
              id="cuit"
              placeholder="Ej: 20-12345678-9"
              {...register('cuit')}
              disabled={isLoading}
            />
            {errors.cuit && (
              <p className="text-sm text-destructive">{errors.cuit.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Clave de identificación tributaria o DNI del cliente
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nombre" className="flex items-center gap-2">
              Nombre *
              <KeyboardHintCompact shortcut="N" />
            </Label>
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
              <Select
                value={watch('tipo_cliente')}
                onValueChange={(value) => setValue('tipo_cliente', value as 'minorista' | 'mayorista' | 'distribuidor')}
                disabled={isLoading}
              >
                <SelectTrigger id="tipo_cliente" className="w-full">
                  <SelectValue placeholder="Seleccionar tipo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minorista">Minorista</SelectItem>
                  <SelectItem value="mayorista">Mayorista</SelectItem>
                  <SelectItem value="distribuidor">Distribuidor</SelectItem>
                </SelectContent>
              </Select>
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
              <Label htmlFor="telefono" className="flex items-center gap-2">
                Teléfono
                <KeyboardHintCompact shortcut="T" />
              </Label>
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
              <Label htmlFor="whatsapp" className="flex items-center gap-2">
                WhatsApp
                <KeyboardHintCompact shortcut="W" />
              </Label>
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
            <Label htmlFor="email" className="flex items-center gap-2">
              Email
              <KeyboardHintCompact shortcut="E" />
            </Label>
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

      {/* Identificadores Adicionales / Terceros */}
      <Card className="border-l-[3px] border-l-purple-500">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-purple-600 flex items-center gap-2">
                <Users className="h-5 w-5" />
                Cuentas / Personas Asociadas
              </CardTitle>
              <CardDescription>
                Registra otros titulares (DNIs) que pueden realizar pagos a nombre de este cliente (ej: Cónyuge, Socio).
              </CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => appendIdentificador({ dni_cuit: '', nombre_titular: '', relacion: '' })}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {camposIdentificadores.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No hay personas asociadas registradas.</p>
          )}
          {camposIdentificadores.map((field, index) => (
            <div key={field.id} className="flex gap-4 items-start p-4 border rounded-lg bg-slate-50 relative">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                <div className="space-y-1">
                  <Label className="text-xs">DNI / CUIT Titular</Label>
                  <Input {...register(`identificadores.${index}.dni_cuit`)} placeholder="DNI del tercero" />
                  {errors.identificadores?.[index]?.dni_cuit && (
                    <p className="text-xs text-red-500">{errors.identificadores[index]?.dni_cuit?.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nombre Titular</Label>
                  <Input {...register(`identificadores.${index}.nombre_titular`)} placeholder="Nombre completo" />
                  {errors.identificadores?.[index]?.nombre_titular && (
                    <p className="text-xs text-red-500">{errors.identificadores[index]?.nombre_titular?.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Relación (Opcional)</Label>
                  <Input {...register(`identificadores.${index}.relacion`)} placeholder="Ej: Esposa" />
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeIdentificador(index)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
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
            <Label htmlFor="zona_entrega" className="flex items-center gap-2">
              Zona de Entrega
              <KeyboardHintCompact shortcut="Z" />
            </Label>
            <Select
              value={watch('zona_id') || 'none'}
              onValueChange={(value) => {
                const newValue = value === 'none' ? null : value
                setValue('zona_id', newValue)

                // Actualizar valor legacy de texto para compatibilidad
                if (newValue) {
                  const zonaNombre = zonas.find(z => z.id === newValue)?.nombre
                  if (zonaNombre) setValue('zona_entrega', zonaNombre)
                } else {
                  setValue('zona_entrega', '')
                }
              }}
            >
              <SelectTrigger disabled={isLoading}>
                <SelectValue placeholder="Seleccionar zona..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin zona asignada</SelectItem>
                {zonas.map((zona) => (
                  <SelectItem key={zona.id} value={zona.id}>
                    {zona.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.zona_id && (
              <p className="text-sm text-destructive">{errors.zona_id.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Selecciona la zona de entrega del cliente para optimización de rutas
            </p>
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
            <Label htmlFor="direccion" className="flex items-center gap-2">
              Dirección Completa
              <KeyboardHintCompact shortcut="D" />
            </Label>
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

      {/* Horarios de Apertura */}
      <Card className="border-l-[3px] border-l-warning">
        <CardHeader>
          <CardTitle className="text-warning flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Horarios de Apertura
          </CardTitle>
          <CardDescription>
            Horarios en que el cliente puede recibir entregas. Dejar vacío si está disponible todo el día.
            <br />
            <span className="text-xs text-muted-foreground">Formato: HH:mm-HH:mm (ej: 08:00-12:00,16:00-20:00)</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { id: 'horario_lunes', label: 'Lunes' },
              { id: 'horario_martes', label: 'Martes' },
              { id: 'horario_miercoles', label: 'Miércoles' },
              { id: 'horario_jueves', label: 'Jueves' },
              { id: 'horario_viernes', label: 'Viernes' },
              { id: 'horario_sabado', label: 'Sábado' },
              { id: 'horario_domingo', label: 'Domingo' },
            ].map(({ id, label }) => (
              <div key={id} className="space-y-2">
                <Label htmlFor={id}>{label}</Label>
                <Input
                  id={id}
                  placeholder="08:00-18:00"
                  {...register(id as any)}
                  disabled={isLoading}
                />
                {(errors as any)[id] && (
                  <p className="text-sm text-destructive">{(errors as any)[id]?.message}</p>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            💡 Deja el campo vacío si el cliente puede recibir entregas a cualquier hora ese día.
            Para horario partido usa coma: 08:00-12:00,16:00-20:00
          </p>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky bottom-4 bg-background/95 backdrop-blur-md p-4 rounded-xl border border-border shadow-lg shadow-black/10 -mx-2">
        <Button type="button" variant="outline" asChild disabled={isLoading} className="hover:bg-primary/5 hover:text-primary hover:border-primary/30 w-full sm:w-auto order-2 sm:order-1">
          <Link href="/ventas/clientes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>

        <Button
          ref={submitButtonRef}
          type="submit"
          disabled={isLoading}
          className="bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all w-full sm:w-auto order-1 sm:order-2"
        >
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
