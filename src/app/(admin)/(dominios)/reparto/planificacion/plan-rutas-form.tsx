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

type ZonaOption = { id: string; nombre: string }
type RepartidorOption = { id: string; nombre: string; apellido?: string | null }

interface PlanRutasFormProps {
  zonas: ZonaOption[]
  repartidores: RepartidorOption[]
  diasSemana: string[]
}

export default function PlanRutasForm({
  zonas,
  repartidores,
  diasSemana,
}: PlanRutasFormProps) {
  const [isPending, startTransition] = useTransition()
  const [zonaId, setZonaId] = useState<string>('')
  const [diaSemana, setDiaSemana] = useState<string>('')
  const [turno, setTurno] = useState<'mañana' | 'tarde' | ''>('')
  const [repartidorId, setRepartidorId] = useState<string>('')
  const SIN_ASIGNAR_VALUE = 'sin-asignar'

  // Función helper para calcular inicio de semana (lunes)
  const calcularInicioSemana = (fecha: Date): Date => {
    const dia = fecha.getDay()
    const diff = dia === 0 ? -6 : 1 - dia
    const lunes = new Date(fecha)
    lunes.setDate(fecha.getDate() + diff)
    lunes.setHours(0, 0, 0, 0)
    return lunes
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!zonaId || !diaSemana || !turno) {
      toast.error('Completa zona, día y turno')
      return
    }

    const formData = new FormData(event.currentTarget)
    // Calcular semana_inicio automáticamente (lunes de la semana actual)
    const semanaInicio = calcularInicioSemana(new Date())
    formData.set('semanaInicio', semanaInicio.toISOString().split('T')[0])

    startTransition(async () => {
      const result = await crearPlanRutaAction(formData)
      if (result?.success) {
        toast.success('Plan de ruta creado')
        // Reset form
        setZonaId('')
        setDiaSemana('')
        setTurno('')
        setRepartidorId('')
      } else {
        toast.error(result?.error || 'No se pudo crear el plan')
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
      <input type="hidden" name="repartidorId" value={repartidorId} />

      <div className="md:col-span-2 flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando...' : 'Guardar planificación'}
        </Button>
      </div>
    </form>
  )
}

