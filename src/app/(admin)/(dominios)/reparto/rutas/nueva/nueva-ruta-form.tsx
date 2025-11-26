'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Truck, MapPin, Clock, Package, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { crearRuta } from '@/actions/reparto.actions'
import { toast } from 'sonner'
import { getTodayArgentina } from '@/lib/utils'

interface NuevaRutaFormProps {
  vehiculos: Array<{ id: string; patente: string; marca?: string; modelo?: string; capacidad_kg: number }>
  repartidores: Array<{ id: string; nombre: string; apellido?: string }>
  zonas: Array<{ id: string; nombre: string }>
  pedidos: Array<{
    id: string
    numero_pedido: string
    fecha_entrega_estimada: string
    turno?: string
    zona_id?: string
    estado: string
    cliente?: { nombre: string }
    zona?: { nombre: string }
  }>
}

export function NuevaRutaForm({ vehiculos, repartidores, zonas, pedidos }: NuevaRutaFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [vehiculoId, setVehiculoId] = useState('')
  const [repartidorId, setRepartidorId] = useState('')
  const [fechaRuta, setFechaRuta] = useState(getTodayArgentina())
  const [turno, setTurno] = useState<'mañana' | 'tarde' | ''>('')
  const [zonaId, setZonaId] = useState('')
  const [pedidosSeleccionados, setPedidosSeleccionados] = useState<Set<string>>(new Set())
  const [observaciones, setObservaciones] = useState('')

  // Filtrar pedidos disponibles según fecha, turno y zona
  const pedidosDisponibles = useMemo(() => {
    return pedidos.filter(p => {
      if (p.estado !== 'preparando') return false
      if (fechaRuta && p.fecha_entrega_estimada !== fechaRuta) return false
      if (turno && p.turno !== turno) return false
      if (zonaId && p.zona_id !== zonaId) return false
      return true
    })
  }, [pedidos, fechaRuta, turno, zonaId])

  // Agrupar pedidos por zona y turno para mostrar
  const pedidosAgrupados = useMemo(() => {
    const grupos: Record<string, typeof pedidosDisponibles> = {}
    pedidosDisponibles.forEach(p => {
      const key = `${p.zona?.nombre || 'Sin zona'}-${p.turno || 'Sin turno'}`
      if (!grupos[key]) grupos[key] = []
      grupos[key].push(p)
    })
    return grupos
  }, [pedidosDisponibles])

  const handleTogglePedido = (pedidoId: string) => {
    setPedidosSeleccionados(prev => {
      const nuevo = new Set(prev)
      if (nuevo.has(pedidoId)) {
        nuevo.delete(pedidoId)
      } else {
        nuevo.add(pedidoId)
      }
      return nuevo
    })
  }

  const handleSelectAll = (grupo: typeof pedidosDisponibles) => {
    setPedidosSeleccionados(prev => {
      const nuevo = new Set(prev)
      grupo.forEach(p => nuevo.add(p.id))
      return nuevo
    })
  }

  const handleDeselectAll = (grupo: typeof pedidosDisponibles) => {
    setPedidosSeleccionados(prev => {
      const nuevo = new Set(prev)
      grupo.forEach(p => nuevo.delete(p.id))
      return nuevo
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!vehiculoId || !repartidorId || !fechaRuta || !turno || !zonaId) {
        toast.error('Completa todos los campos requeridos')
        setLoading(false)
        return
      }

      if (pedidosSeleccionados.size === 0) {
        toast.error('Selecciona al menos un pedido para la ruta')
        setLoading(false)
        return
      }

      // Validar que todos los pedidos seleccionados cumplan las condiciones
      const pedidosInvalidos = Array.from(pedidosSeleccionados).filter(id => {
        const pedido = pedidosDisponibles.find(p => p.id === id)
        return !pedido || pedido.fecha_entrega_estimada !== fechaRuta || pedido.turno !== turno || pedido.zona_id !== zonaId
      })

      if (pedidosInvalidos.length > 0) {
        toast.error('Algunos pedidos seleccionados no cumplen las condiciones de la ruta')
        setLoading(false)
        return
      }

      const result = await crearRuta({
        vehiculo_id: vehiculoId,
        repartidor_id: repartidorId,
        fecha_ruta: fechaRuta,
        turno: turno as 'mañana' | 'tarde',
        zona_id: zonaId,
        pedidos_ids: Array.from(pedidosSeleccionados),
        observaciones: observaciones || undefined,
      })

      if (result.success) {
        toast.success('Ruta creada exitosamente')
        router.push('/reparto/rutas')
      } else {
        toast.error(result.error || 'Error al crear la ruta')
      }
    } catch (error) {
      toast.error('Error inesperado al crear la ruta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Información básica */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Información de la Ruta
          </CardTitle>
          <CardDescription>
            Define los parámetros básicos de la ruta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vehiculo">Vehículo *</Label>
              <Select value={vehiculoId} onValueChange={setVehiculoId} required>
                <SelectTrigger id="vehiculo">
                  <SelectValue placeholder="Selecciona un vehículo" />
                </SelectTrigger>
                <SelectContent>
                  {vehiculos.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.patente} - {v.marca} {v.modelo} ({v.capacidad_kg}kg)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="repartidor">Repartidor *</Label>
              <Select value={repartidorId} onValueChange={setRepartidorId} required>
                <SelectTrigger id="repartidor">
                  <SelectValue placeholder="Selecciona un repartidor" />
                </SelectTrigger>
                <SelectContent>
                  {repartidores.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nombre} {r.apellido || ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="fecha" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Fecha de Ruta *
              </Label>
              <Input
                id="fecha"
                type="date"
                value={fechaRuta}
                onChange={(e) => setFechaRuta(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="turno" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Turno *
              </Label>
              <Select value={turno} onValueChange={(value) => setTurno(value as 'mañana' | 'tarde')} required>
                <SelectTrigger id="turno">
                  <SelectValue placeholder="Selecciona un turno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mañana">Mañana</SelectItem>
                  <SelectItem value="tarde">Tarde</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="zona" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Zona *
              </Label>
              <Select value={zonaId} onValueChange={setZonaId} required>
                <SelectTrigger id="zona">
                  <SelectValue placeholder="Selecciona una zona" />
                </SelectTrigger>
                <SelectContent>
                  {zonas.map(z => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observaciones">Observaciones</Label>
            <Input
              id="observaciones"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas adicionales sobre la ruta..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Selección de pedidos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Pedidos Disponibles
          </CardTitle>
          <CardDescription>
            Selecciona los pedidos que irán en esta ruta (filtrados por fecha, turno y zona)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(pedidosAgrupados).length === 0 ? (
            <div className="text-center py-8">
              <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No hay pedidos disponibles</h3>
              <p className="text-muted-foreground">
                {!fechaRuta || !turno || !zonaId
                  ? 'Completa fecha, turno y zona para ver pedidos disponibles'
                  : 'No hay pedidos que cumplan los criterios seleccionados'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(pedidosAgrupados).map(([key, grupo]) => (
                <div key={key} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{key}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {grupo.length} pedido(s)
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSelectAll(grupo)}
                      >
                        Seleccionar Todos
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeselectAll(grupo)}
                      >
                        Deseleccionar
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {grupo.map(pedido => (
                      <div
                        key={pedido.id}
                        className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          pedidosSeleccionados.has(pedido.id)
                            ? 'bg-primary/5 border-primary'
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => handleTogglePedido(pedido.id)}
                      >
                        <Checkbox
                          checked={pedidosSeleccionados.has(pedido.id)}
                          onCheckedChange={() => handleTogglePedido(pedido.id)}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{pedido.numero_pedido}</div>
                          <div className="text-sm text-muted-foreground">
                            {pedido.cliente?.nombre || 'Cliente'} • {pedido.zona?.nombre || 'Sin zona'}
                          </div>
                        </div>
                        {pedidosSeleccionados.has(pedido.id) && (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {pedidosSeleccionados.size > 0 && (
            <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {pedidosSeleccionados.size} pedido(s) seleccionado(s)
                </span>
                <Badge variant="default">
                  {pedidosSeleccionados.size} pedidos
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botón de envío */}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/reparto/rutas')}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={loading || !vehiculoId || !repartidorId || !fechaRuta || !turno || !zonaId || pedidosSeleccionados.size === 0}
          className="bg-primary hover:bg-primary/90"
        >
          {loading ? 'Creando...' : 'Crear Ruta'}
        </Button>
      </div>
    </form>
  )
}

