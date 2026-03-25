'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { LiquidacionJornada } from '@/types/domain.types'
import {
  TURNO_OPTIONS,
  TASK_TEMPLATES,
  getTurnoSelectValue,
  toNum,
  formatMoney,
  sanitizeTaskValue,
  getRowBreakdown,
  validateJornada,
  type NewRowDraft,
} from './liquidacion-utils'

type JornadaAddSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  isSucursalEmployee: boolean
  loading: boolean
  valorHora: number
  rows: LiquidacionJornada[]
  onAdd: (draft: NewRowDraft) => Promise<void>
  initialDraft?: Partial<NewRowDraft>
}

function buildDefaultDraft(valorHora: number): NewRowDraft {
  return {
    fecha: new Date().toISOString().slice(0, 10),
    turno: 'general',
    tarea: '',
    horas_mensuales: 0,
    horas_adicionales: 0,
    turno_especial_unidades: 0,
    tarifa_hora_base: valorHora,
    tarifa_hora_extra: valorHora,
    tarifa_turno_especial: 0,
    observaciones: '',
  }
}

export function JornadaAddSheet({
  open,
  onOpenChange,
  isSucursalEmployee,
  loading,
  valorHora,
  rows,
  onAdd,
  initialDraft,
}: JornadaAddSheetProps) {
  const [newRow, setNewRow] = useState<NewRowDraft>(() => {
    const baseDraft = buildDefaultDraft(valorHora)
    return {
      ...baseDraft,
      ...initialDraft,
      fecha: initialDraft?.fecha || baseDraft.fecha,
      turno: initialDraft?.turno || 'general',
      tarea: initialDraft?.tarea || '',
      observaciones: initialDraft?.observaciones || '',
    }
  })
  const [error, setError] = useState<string | null>(null)
  const [showAdvancedTarifas, setShowAdvancedTarifas] = useState(false)

  const breakdown = getRowBreakdown(newRow, isSucursalEmployee)
  const turnoSelectValue = getTurnoSelectValue(newRow.turno)

  const recentTaskOptions = useMemo(() => {
    const unique = new Set<string>()
    for (const row of rows) {
      const task = sanitizeTaskValue(row.tarea)
      if (!task) continue
      unique.add(task)
      if (unique.size >= 10) break
    }
    return Array.from(unique)
  }, [rows])

  const updateNewRow = (patch: Partial<NewRowDraft>) => {
    setNewRow((prev) => ({ ...prev, ...patch }))
    if (error) setError(null)
  }

  const handleAdd = async () => {
    const validationError = validateJornada(newRow, isSucursalEmployee)
    if (validationError) {
      setError(validationError)
      return
    }

    await onAdd(newRow)
    setNewRow((prev) => ({
      ...prev,
      tarea: '',
      horas_mensuales: 0,
      horas_adicionales: 0,
      turno_especial_unidades: 0,
      observaciones: '',
    }))
    setError(null)
    setShowAdvancedTarifas(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Agregar jornada manual</SheetTitle>
          <SheetDescription>
            Cargue los datos operativos del dia. Las tarifas quedan en opciones avanzadas.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {isSucursalEmployee && (
            <Badge variant="outline" className="text-[11px]">
              Sucursal: hs adicionales informativas
            </Badge>
          )}

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Fecha</Label>
              <Input
                type="date"
                value={newRow.fecha}
                onChange={(e) => updateNewRow({ fecha: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Turno</Label>
              <Select
                value={turnoSelectValue}
                onValueChange={(value) =>
                  updateNewRow({
                    turno:
                      value === 'otro'
                        ? (turnoSelectValue === 'otro' && newRow.turno.trim() ? newRow.turno : 'otro')
                        : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar turno" />
                </SelectTrigger>
                <SelectContent>
                  {TURNO_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="otro">Otro (personalizado)</SelectItem>
                </SelectContent>
              </Select>
              {turnoSelectValue === 'otro' && (
                <Input
                  placeholder="Escribir turno personalizado"
                  value={newRow.turno}
                  onChange={(e) => updateNewRow({ turno: e.target.value })}
                />
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Puesto del dia</Label>
              <Input
                list="tareas-recientes-add"
                placeholder="Ej: caja, reposicion, reparto"
                value={newRow.tarea}
                onChange={(e) => updateNewRow({ tarea: e.target.value })}
              />
              <datalist id="tareas-recientes-add">
                {recentTaskOptions.map((task) => (
                  <option key={task} value={task} />
                ))}
              </datalist>
              <div className="flex flex-wrap gap-1 pt-1">
                {TASK_TEMPLATES.map((task) => (
                  <Button
                    key={task}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => updateNewRow({ tarea: task })}
                    disabled={loading}
                  >
                    {task}
                  </Button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Referencia del puesto cumplido ese dia.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Horas diarias</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={newRow.horas_mensuales}
                onChange={(e) => updateNewRow({ horas_mensuales: toNum(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hs adicionales</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={newRow.horas_adicionales}
                onChange={(e) => updateNewRow({ horas_adicionales: toNum(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Turno especial</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={newRow.turno_especial_unidades}
                onChange={(e) => updateNewRow({ turno_especial_unidades: toNum(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Observaciones</Label>
            <Textarea
              placeholder="Opcional"
              value={newRow.observaciones}
              onChange={(e) => updateNewRow({ observaciones: e.target.value })}
              rows={2}
            />
          </div>

          {/* Resumen */}
          <div className="rounded-md border bg-white px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Resumen automatico
            </p>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Base</p>
                <p className="font-medium tabular-nums">{formatMoney(breakdown.base)}</p>
              </div>
              <div className={isSucursalEmployee ? 'text-muted-foreground' : ''}>
                <p className="text-xs">Extra {isSucursalEmployee ? '(informativo)' : ''}</p>
                <p className="font-medium tabular-nums">{formatMoney(breakdown.extra)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Especial</p>
                <p className="font-medium tabular-nums">{formatMoney(breakdown.especial)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total aplicado</p>
                <p className="font-semibold tabular-nums">{formatMoney(breakdown.total)}</p>
              </div>
            </div>
          </div>

          {/* Tarifas avanzadas */}
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvancedTarifas((prev) => !prev)}
              disabled={loading}
            >
              {showAdvancedTarifas ? 'Ocultar tarifas avanzadas' : 'Mostrar tarifas avanzadas'}
            </Button>

            {showAdvancedTarifas && (
              <div className="grid grid-cols-3 gap-3 rounded-md border bg-white p-3">
                <div className="space-y-1">
                  <Label className="text-xs">Tarifa base</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newRow.tarifa_hora_base}
                    onChange={(e) => updateNewRow({ tarifa_hora_base: toNum(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tarifa extra</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newRow.tarifa_hora_extra}
                    onChange={(e) => updateNewRow({ tarifa_hora_extra: toNum(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tarifa especial</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newRow.tarifa_turno_especial}
                    onChange={(e) => updateNewRow({ tarifa_turno_especial: toNum(e.target.value) })}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleAdd} disabled={loading} className="flex-1">
              Agregar jornada
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={loading}
              onClick={() =>
                updateNewRow({
                  tarifa_hora_base: valorHora,
                  tarifa_hora_extra: valorHora,
                  tarifa_turno_especial: 0,
                })
              }
            >
              Restaurar tarifas
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
