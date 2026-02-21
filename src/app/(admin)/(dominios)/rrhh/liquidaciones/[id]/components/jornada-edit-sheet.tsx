'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { LiquidacionJornada } from '@/types/domain.types'
import { TURNO_OPTIONS, getTurnoSelectValue, toNum, formatMoney, sanitizeTaskValue } from './liquidacion-utils'

type JornadaEditSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingRow: LiquidacionJornada | null
  isSucursalEmployee: boolean
  loading: boolean
  onSave: (row: LiquidacionJornada) => void
  onUpdateRow: (patch: Partial<LiquidacionJornada>) => void
  breakdown: { base: number; extra: number; extraAplicado: number; especial: number; total: number } | null
}

export function JornadaEditSheet({
  open,
  onOpenChange,
  editingRow,
  isSucursalEmployee,
  loading,
  onSave,
  onUpdateRow,
  breakdown,
}: JornadaEditSheetProps) {
  const [showAdvancedTarifas, setShowAdvancedTarifas] = useState(false)
  const editingTurnoSelectValue = getTurnoSelectValue(editingRow?.turno)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar Jornada</SheetTitle>
          <SheetDescription>
            Turno general significa jornada normal del dia, sin clasificacion especial.
          </SheetDescription>
        </SheetHeader>

        {editingRow && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 col-span-2">
                <Label>Fecha</Label>
                <Input
                  type="date"
                  value={editingRow.fecha?.slice(0, 10) ?? ''}
                  onChange={(e) => onUpdateRow({ fecha: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Turno</Label>
                <Select
                  value={editingTurnoSelectValue}
                  onValueChange={(value) =>
                    onUpdateRow({ turno: value === 'otro' ? '' : value })
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
                <p className="text-[11px] text-muted-foreground">General = jornada normal del dia.</p>
                {editingTurnoSelectValue === 'otro' && (
                  <Input
                    value={editingRow.turno || ''}
                    onChange={(e) => onUpdateRow({ turno: e.target.value })}
                    placeholder="Escribir turno personalizado"
                  />
                )}
              </div>
              <div className="space-y-1">
                <Label>Tarea</Label>
                <Input
                  value={sanitizeTaskValue(editingRow.tarea)}
                  onChange={(e) => onUpdateRow({ tarea: e.target.value })}
                  placeholder="Que tarea realizo"
                />
              </div>
            </div>

            <Separator />
            <p className="text-sm font-medium">Horas y unidades</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Hs mensuales</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingRow.horas_mensuales ?? 0}
                  onChange={(e) => onUpdateRow({ horas_mensuales: toNum(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label>Hs adicionales</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingRow.horas_adicionales ?? 0}
                  onChange={(e) => onUpdateRow({ horas_adicionales: toNum(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label>Turno especial (unidades)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingRow.turno_especial_unidades ?? 0}
                  onChange={(e) => onUpdateRow({ turno_especial_unidades: toNum(e.target.value) })}
                />
              </div>
            </div>

            <Separator />
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-md border bg-white p-3">
                  <div className="space-y-1">
                    <Label>Tarifa hora base</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingRow.tarifa_hora_base ?? 0}
                      onChange={(e) => onUpdateRow({ tarifa_hora_base: toNum(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Tarifa hora extra</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingRow.tarifa_hora_extra ?? 0}
                      onChange={(e) => onUpdateRow({ tarifa_hora_extra: toNum(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Tarifa turno especial</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingRow.tarifa_turno_especial ?? 0}
                      onChange={(e) => onUpdateRow({ tarifa_turno_especial: toNum(e.target.value) })}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label>Observaciones</Label>
              <Textarea
                value={editingRow.observaciones || ''}
                onChange={(e) => onUpdateRow({ observaciones: e.target.value })}
                rows={3}
              />
            </div>

            <div className="pt-2 border-t text-sm space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Base</span>
                <span>{formatMoney(breakdown?.base)}</span>
              </div>
              <div className={`flex justify-between ${isSucursalEmployee ? 'text-muted-foreground' : ''}`}>
                <span>Extra {isSucursalEmployee ? '(informativo)' : ''}</span>
                <span>{formatMoney(breakdown?.extra)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Especial</span>
                <span>{formatMoney(breakdown?.especial)}</span>
              </div>
              <div className="flex justify-between font-semibold pt-1">
                <span>Total jornada aplicada:</span>
                <span>{formatMoney(breakdown?.total)}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => onSave(editingRow)}
                disabled={loading}
                className="flex-1"
              >
                Guardar y recalcular
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
