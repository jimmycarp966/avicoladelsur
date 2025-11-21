'use client'

import { FormEvent, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { crearPlanRutaAction } from '@/actions/plan-rutas.actions'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

type Option = { id: string; nombre: string; apellido?: string | null; patente?: string }

interface PlanRutasFormProps {
  zonas: Option[]
  vehiculos: Array<Option & { marca?: string | null; modelo?: string | null; capacidad_kg?: number | null }>
  repartidores: Option[]
  diasSemana: string[]
}

export default function PlanRutasForm({
  zonas,
  vehiculos,
  repartidores,
  diasSemana,
}: PlanRutasFormProps) {
  const [isPending, startTransition] = useTransition()
  const [zonaId, setZonaId] = useState<string>('')
  const [diaSemana, setDiaSemana] = useState<string>('')
  const [turno, setTurno] = useState<'mañana' | 'tarde' | ''>('')
  const [vehiculoId, setVehiculoId] = useState<string>('')
  const [repartidorId, setRepartidorId] = useState<string>('')
  const SIN_ASIGNAR_VALUE = 'sin-asignar'

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!zonaId || !diaSemana || !turno || !vehiculoId) {
      toast.error('Completa zona, día, turno y vehículo')
      return
    }

    const formData = new FormData(event.currentTarget)
    startTransition(async () => {
      const result = await crearPlanRutaAction(formData)
      if (result?.success) {
        toast.success('Plan de ruta creado')
      } else {
        toast.error(result?.message || 'No se pudo crear el plan')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label>Zona *</Label>
        <Select value={zonaId} onValueChange={setZonaId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona una zona" />
          </SelectTrigger>
          <SelectContent>
            {zonas.map((zona) => (
              <SelectItem key={zona.id} value={zona.id}>
                {zona.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Día de la semana *</Label>
        <Select value={diaSemana} onValueChange={setDiaSemana}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona un día" />
          </SelectTrigger>
          <SelectContent>
            {diasSemana.map((dia, idx) => (
              <SelectItem key={idx} value={String(idx)}>
                {dia}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Turno *</Label>
        <Select value={turno} onValueChange={(value) => setTurno(value as 'mañana' | 'tarde')}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona un turno" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mañana">Mañana</SelectItem>
            <SelectItem value="tarde">Tarde</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Vehículo *</Label>
        <Select value={vehiculoId} onValueChange={setVehiculoId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona un vehículo" />
          </SelectTrigger>
          <SelectContent>
            {vehiculos.map((vehiculo) => (
              <SelectItem key={vehiculo.id} value={vehiculo.id}>
                {vehiculo.patente} · {vehiculo.marca} {vehiculo.modelo} ({vehiculo.capacidad_kg ?? 0} kg)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Repartidor (opcional)</Label>
        <Select
          value={repartidorId || SIN_ASIGNAR_VALUE}
          onValueChange={(value) => setRepartidorId(value === SIN_ASIGNAR_VALUE ? '' : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecciona un repartidor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SIN_ASIGNAR_VALUE}>Sin asignar</SelectItem>
            {repartidores.map((rep) => (
              <SelectItem key={rep.id} value={rep.id}>
                {rep.nombre} {rep.apellido}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <input type="hidden" name="zonaId" value={zonaId} />
      <input type="hidden" name="diaSemana" value={diaSemana} />
      <input type="hidden" name="turno" value={turno} />
      <input type="hidden" name="vehiculoId" value={vehiculoId} />
      <input type="hidden" name="repartidorId" value={repartidorId} />

      <div className="md:col-span-2 flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando...' : 'Guardar planificación'}
        </Button>
      </div>
    </form>
  )
}

