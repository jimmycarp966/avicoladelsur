'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { asignarTurnoZonaPresupuestoAction } from '@/actions/presupuestos.actions'
import { toast } from 'sonner'
import { Clock, MapPin, CreditCard, DollarSign } from 'lucide-react'

interface AsignarTurnoZonaFormProps {
  presupuestoId: string
  presupuesto: {
    turno?: string
    zona_id?: string
    metodos_pago?: any
    recargo_total?: number
    total_estimado: number
  }
  zonas: Array<{ id: string; nombre: string }>
  zonasDias?: Array<{ zona_id: string; dia_semana: number; turno: string; activo: boolean }>
  fechaEntrega?: string
}

export function AsignarTurnoZonaForm({
  presupuestoId,
  presupuesto,
  zonas,
  zonasDias = [],
  fechaEntrega,
}: AsignarTurnoZonaFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [turno, setTurno] = useState<string>(presupuesto.turno || '')
  const [zonaId, setZonaId] = useState<string>(presupuesto.zona_id || '')
  const [metodosPago, setMetodosPago] = useState<Record<string, boolean>>({
    efectivo: false,
    transferencia: false,
    qr: false,
    tarjeta: false,
    cuenta_corriente: false,
  })
  const [recargos, setRecargos] = useState<Record<string, number>>({
    efectivo: 0,
    transferencia: 0,
    qr: 0,
    tarjeta: 0,
    cuenta_corriente: 0,
  })

  // Calcular día de la semana de la fecha de entrega
  const diaSemana = fechaEntrega
    ? new Date(fechaEntrega).getDay()
    : new Date().getDay()

  // Filtrar zonas disponibles para el día y turno seleccionado
  const zonasDisponibles = zonas.filter(zona => {
    if (!turno) return true
    const zonaDia = zonasDias.find(
      zd => zd.zona_id === zona.id && zd.dia_semana === diaSemana && zd.turno === turno && zd.activo
    )
    return zonaDia !== undefined
  })

  const calcularRecargoTotal = () => {
    return Object.entries(metodosPago).reduce((total, [metodo, activo]) => {
      if (activo) {
        return total + (recargos[metodo] || 0)
      }
      return total
    }, 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!turno || !zonaId) {
        toast.error('Debes seleccionar turno y zona')
        setLoading(false)
        return
      }

      // Preparar métodos de pago con recargos
      const metodosPagoArray = Object.entries(metodosPago)
        .filter(([_, activo]) => activo)
        .map(([metodo, _]) => ({
          metodo,
          recargo: recargos[metodo] || 0,
        }))

      const recargoTotal = calcularRecargoTotal()

      const formData = new FormData()
      formData.append('presupuesto_id', presupuestoId)
      formData.append('turno', turno)
      formData.append('zona_id', zonaId)
      formData.append('metodos_pago', JSON.stringify(metodosPagoArray))
      formData.append('recargo_total', recargoTotal.toString())

      const result = await asignarTurnoZonaPresupuestoAction(formData)

      if (result.success) {
        toast.success(result.message || 'Turno y zona asignados exitosamente')
        router.refresh()
      } else {
        toast.error(result.message || 'Error al asignar turno y zona')
      }
    } catch (error) {
      toast.error('Error inesperado al asignar turno y zona')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Asignar Turno y Zona
        </CardTitle>
        <CardDescription>
          Asigna el turno de entrega y la zona estipulada para este presupuesto
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Turno */}
          <div className="space-y-2">
            <Label htmlFor="turno">Turno de Entrega *</Label>
            <Select value={turno} onValueChange={setTurno} required>
              <SelectTrigger id="turno">
                <SelectValue placeholder="Selecciona un turno" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mañana">Mañana</SelectItem>
                <SelectItem value="tarde">Tarde</SelectItem>
              </SelectContent>
            </Select>
            {turno && zonasDisponibles.length === 0 && (
              <p className="text-sm text-yellow-600">
                No hay zonas disponibles para este turno en el día seleccionado
              </p>
            )}
          </div>

          {/* Zona */}
          <div className="space-y-2">
            <Label htmlFor="zona" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Zona de Entrega *
            </Label>
            <Select value={zonaId} onValueChange={setZonaId} required disabled={!turno}>
              <SelectTrigger id="zona">
                <SelectValue placeholder={turno ? "Selecciona una zona" : "Primero selecciona un turno"} />
              </SelectTrigger>
              <SelectContent>
                {zonasDisponibles.map(zona => (
                  <SelectItem key={zona.id} value={zona.id}>
                    {zona.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Métodos de Pago */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Métodos de Pago
            </Label>
            <div className="space-y-3">
              {Object.keys(metodosPago).map(metodo => (
                <div key={metodo} className="flex items-center gap-4 p-3 border rounded-lg">
                  <Checkbox
                    id={`metodo-${metodo}`}
                    checked={metodosPago[metodo]}
                    onCheckedChange={(checked) =>
                      setMetodosPago(prev => ({ ...prev, [metodo]: checked === true }))
                    }
                  />
                  <Label htmlFor={`metodo-${metodo}`} className="flex-1 capitalize cursor-pointer">
                    {metodo.replace('_', ' ')}
                  </Label>
                  {metodosPago[metodo] && (
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`recargo-${metodo}`} className="text-sm">Recargo:</Label>
                      <Input
                        id={`recargo-${metodo}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={recargos[metodo] || 0}
                        onChange={(e) =>
                          setRecargos(prev => ({ ...prev, [metodo]: parseFloat(e.target.value) || 0 }))
                        }
                        className="w-24"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Resumen de Recargos */}
          {calcularRecargoTotal() > 0 && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <span className="font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Recargo Total:
                </span>
                <span className="text-lg font-bold text-blue-600">
                  ${calcularRecargoTotal().toFixed(2)}
                </span>
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                Total con recargo: ${(presupuesto.total_estimado + calcularRecargoTotal()).toFixed(2)}
              </div>
            </div>
          )}

          {/* Botón de envío */}
          <Button type="submit" disabled={loading || !turno || !zonaId} className="w-full">
            {loading ? 'Guardando...' : 'Asignar Turno y Zona'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

