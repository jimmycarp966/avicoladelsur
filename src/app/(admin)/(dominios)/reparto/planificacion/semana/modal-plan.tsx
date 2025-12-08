'use client'

import { FormEvent, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type ZonaOption = { id: string; nombre: string }
type RepartidorOption = { id: string; nombre: string; apellido?: string | null }

interface ModalPlanProps {
  open: boolean
  onClose: () => void
  zonas: ZonaOption[]
  repartidores: RepartidorOption[]
  semanaInicio: string // YYYY-MM-DD
  diaSemana: number
  turno: 'mañana' | 'tarde'
  planExistente?: {
    id: string
    zona_id: string
    repartidor_id: string | null
  } | null
  onSuccess: () => void
}

export default function ModalPlan({
  open,
  onClose,
  zonas,
  repartidores,
  semanaInicio,
  diaSemana,
  turno,
  planExistente,
  onSuccess,
}: ModalPlanProps) {
  const [isPending, startTransition] = useTransition()
  const [zonaId, setZonaId] = useState<string>(planExistente?.zona_id || '')
  const [repartidorId, setRepartidorId] = useState<string>(
    planExistente?.repartidor_id || ''
  )
  const SIN_ASIGNAR_VALUE = 'sin-asignar'

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!zonaId) {
      toast.error('Debes seleccionar una zona')
      return
    }

    const formData = new FormData(event.currentTarget)
    formData.set('semanaInicio', semanaInicio)

    startTransition(async () => {
      const result = await crearPlanRutaAction(formData)
      if (result?.success) {
        toast.success('Plan de ruta creado')
        onSuccess()
        onClose()
        // Reset form
        setZonaId('')
        setRepartidorId('')
      } else {
        toast.error(result?.error || 'No se pudo crear el plan')
      }
    })
  }

  const handleDelete = () => {
    // TODO: Implementar eliminación si es necesario
    toast.info('Funcionalidad de edición próximamente')
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {planExistente ? 'Editar Plan' : 'Crear Plan'} - {turno.charAt(0).toUpperCase() + turno.slice(1)}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Zona *</Label>
            <Select value={zonaId} onValueChange={setZonaId} required>
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
            <Label>Repartidor (opcional)</Label>
            <Select
              value={repartidorId || SIN_ASIGNAR_VALUE}
              onValueChange={(value) =>
                setRepartidorId(value === SIN_ASIGNAR_VALUE ? '' : value)
              }
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

          <div className="flex justify-end gap-2">
            {planExistente && (
              <Button type="button" variant="destructive" onClick={handleDelete}>
                Eliminar
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !zonaId}>
              {isPending ? 'Guardando...' : planExistente ? 'Actualizar' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

