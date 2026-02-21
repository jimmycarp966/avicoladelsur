'use client'

import { useMemo, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { recalcularLiquidacionesPeriodoAction } from '@/actions/rrhh.actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useNotificationStore } from '@/store/notificationStore'

type EmpleadoOption = {
  id: string
  nombre: string
}

type Props = {
  empleados: EmpleadoOption[]
  defaultMes: number
  defaultAnio: number
}

const MESES = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
] as const

export function RecalcularLiquidacionesButton({ empleados, defaultMes, defaultAnio }: Props) {
  const { showToast } = useNotificationStore()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mes, setMes] = useState(defaultMes)
  const [anio, setAnio] = useState(defaultAnio)
  const [alcance, setAlcance] = useState<'todos' | 'empleado'>('todos')
  const [empleadoId, setEmpleadoId] = useState<string>('')

  const anios = useMemo(() => {
    const current = new Date().getFullYear()
    return [current - 2, current - 1, current, current + 1]
  }, [])

  const handleRecalcular = async () => {
    if (alcance === 'empleado' && !empleadoId) {
      showToast('error', 'Selecciona un empleado', 'Validacion')
      return
    }

    try {
      setLoading(true)
      const result = await recalcularLiquidacionesPeriodoAction({
        mes,
        anio,
        alcance,
        empleadoId: alcance === 'empleado' ? empleadoId : undefined,
      })

      if (!result.success || !result.data) {
        showToast('error', result.error || 'No se pudo recalcular', 'Error')
        return
      }

      const resumen = result.data
      showToast(
        'success',
        `Actualizadas: ${resumen.actualizados} | Omitidas sin horas: ${resumen.omitidos_sin_horas} | Errores: ${resumen.errores}`,
        'Recálculo completado',
      )
      setOpen(false)
    } catch {
      showToast('error', 'Error inesperado al recalcular', 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <RefreshCw className="w-4 h-4 mr-2" />
        Recalcular
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Recalcular liquidaciones</DialogTitle>
            <DialogDescription>
              Recalcula por período y solo actualiza empleados con horas detectadas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Mes</Label>
                <Select value={String(mes)} onValueChange={(value) => setMes(Number(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES.map((item) => (
                      <SelectItem key={item.value} value={String(item.value)}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Año</Label>
                <Select value={String(anio)} onValueChange={(value) => setAnio(Number(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {anios.map((item) => (
                      <SelectItem key={item} value={String(item)}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Alcance</Label>
              <Select
                value={alcance}
                onValueChange={(value) => {
                  const next = value as 'todos' | 'empleado'
                  setAlcance(next)
                  if (next === 'todos') setEmpleadoId('')
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los empleados</SelectItem>
                  <SelectItem value="empleado">Un empleado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {alcance === 'empleado' && (
              <div className="space-y-1.5">
                <Label>Empleado</Label>
                <Select value={empleadoId} onValueChange={setEmpleadoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar empleado" />
                  </SelectTrigger>
                  <SelectContent>
                    {empleados.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleRecalcular} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Recalculando...
                </>
              ) : (
                'Recalcular'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

