'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Trash2 } from 'lucide-react'
import type { LiquidacionJornada } from '@/types/domain.types'
import {
  TURNO_OPTIONS,
  getAutoLicenciaLabel,
  getTurnoSelectValue,
  toNum,
  formatMoney,
  sanitizeTaskValue,
} from './liquidacion-utils'

type JornadaEditSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingRow: LiquidacionJornada | null
  isSucursalEmployee: boolean
  loading: boolean
  onSave: (row: LiquidacionJornada) => void
  onUpdateRow: (patch: Partial<LiquidacionJornada>) => void
  onDelete?: (row: LiquidacionJornada) => void | Promise<void>
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
  onDelete,
  breakdown,
}: JornadaEditSheetProps) {
  const [showAdvancedTarifas, setShowAdvancedTarifas] = useState(false)
  const editingTurnoSelectValue = getTurnoSelectValue(editingRow?.turno)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const licenciaLabel = getAutoLicenciaLabel(editingRow)
  const esDescansoProgramado = Boolean(licenciaLabel?.toLowerCase().includes('descanso'))
  const sheetTitle = licenciaLabel
    ? esDescansoProgramado
      ? 'Editar descanso'
      : `Editar ${licenciaLabel.toLowerCase()}`
    : 'Editar Jornada'
  const sheetDescription = licenciaLabel
    ? esDescansoProgramado
      ? 'Ajusta la fecha y los valores de este registro especial. Si cambias la fecha, el descanso asociado se sincroniza automaticamente.'
      : 'Ajusta la fecha y los valores de este registro especial.'
    : 'General es el turno habitual del dia cuando no aplica una clasificacion especial.'
  const deleteButtonLabel = licenciaLabel ? `Quitar ${licenciaLabel.toLowerCase()}` : 'Eliminar jornada'

  // Estados locales string para inputs numéricos — evita que el campo se fuerce a "0" al borrar
  const [hsInput, setHsInput] = useState(String(editingRow?.horas_mensuales ?? ''))
  const [hsAdicInput, setHsAdicInput] = useState(String(editingRow?.horas_adicionales ?? ''))
  const [turnoEspInput, setTurnoEspInput] = useState(String(editingRow?.turno_especial_unidades ?? ''))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{sheetTitle}</SheetTitle>
          <SheetDescription>{sheetDescription}</SheetDescription>
        </SheetHeader>

        {editingRow && (
          <div className="mt-6 space-y-4">
            {esDescansoProgramado && (
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                Este registro proviene de un descanso automatico. Si cambias la fecha, se actualiza el descanso mensual asociado.
              </div>
            )}
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
                <p className="text-[11px] text-muted-foreground">General = turno habitual del dia.</p>
                {editingTurnoSelectValue === 'otro' && (
                  <Input
                    value={editingRow.turno || ''}
                    onChange={(e) => onUpdateRow({ turno: e.target.value })}
                    placeholder="Escribir turno personalizado"
                  />
                )}
              </div>
              <div className="space-y-1">
                <Label>Puesto del dia</Label>
                <Input
                  value={sanitizeTaskValue(editingRow.tarea)}
                  onChange={(e) => onUpdateRow({ tarea: e.target.value })}
                  placeholder="Ej: caja, reposicion, reparto"
                />
                <p className="text-[11px] text-muted-foreground">Referencia del puesto cumplido ese dia.</p>
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
                  value={hsInput}
                  onChange={(e) => setHsInput(e.target.value)}
                  onBlur={(e) => onUpdateRow({ horas_mensuales: toNum(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label>Hs adicionales</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={hsAdicInput}
                  onChange={(e) => setHsAdicInput(e.target.value)}
                  onBlur={(e) => onUpdateRow({ horas_adicionales: toNum(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label>Turno especial (unidades)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={turnoEspInput}
                  onChange={(e) => setTurnoEspInput(e.target.value)}
                  onBlur={(e) => onUpdateRow({ turno_especial_unidades: toNum(e.target.value) })}
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

            <div className="flex flex-col gap-2 pt-2">
              {onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={loading}
                  className="w-full"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {deleteButtonLabel}
                </Button>
              )}
              <div className="flex gap-2">
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
          </div>
        )}
      </SheetContent>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteButtonLabel}</AlertDialogTitle>
            <AlertDialogDescription>
              {licenciaLabel
                ? 'Se eliminara la jornada de esta liquidacion y tambien la licencia de origen para que no vuelva a aparecer al recalcular.'
                : 'Se eliminara la jornada de esta liquidacion. Esta accion no se puede deshacer.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={loading}
              onClick={() => {
                if (!editingRow || !onDelete) return
                setDeleteConfirmOpen(false)
                void onDelete(editingRow)
              }}
            >
              {loading ? 'Eliminando...' : deleteButtonLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  )
}
