'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useNotificationStore } from '@/store/notificationStore'
import { upsertLiquidacionJornadaAction } from '@/actions/rrhh.actions'
import { JornadaEditSheet } from './jornada-edit-sheet'
import { JornadaAddSheet } from './jornada-add-sheet'
import type { Liquidacion, LiquidacionJornada } from '@/types/domain.types'
import {
  TURNO_OPTIONS,
  getTurnoLabel,
  normalizeOrigen,
  normalizeTurno,
  sanitizeTaskValue,
  formatMoney,
  getRowBreakdown,
  validateJornada,
  type NewRowDraft,
} from './liquidacion-utils'

function getOrigenBadge(origen: string | null | undefined) {
  switch (normalizeOrigen(origen)) {
    case 'hik':
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 text-xs">
          HIK
        </Badge>
      )
    case 'asistencia':
      return (
        <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 text-xs">
          Asist.
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-600 border-yellow-200 text-xs">
          Manual
        </Badge>
      )
  }
}

type LiquidacionJornadasTabProps = {
  liquidacion: Liquidacion
  jornadas: LiquidacionJornada[]
  isSucursalEmployee: boolean
}

export function LiquidacionJornadasTab({
  liquidacion,
  jornadas,
  isSucursalEmployee,
}: LiquidacionJornadasTabProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()

  const [rows, setRows] = useState<LiquidacionJornada[]>(jornadas)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setRows(jornadas)
  }, [jornadas])

  // Edit sheet state
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<LiquidacionJornada | null>(null)

  // Add sheet state
  const [addSheetOpen, setAddSheetOpen] = useState(false)

  // Filters
  const [jornadaSearch, setJornadaSearch] = useState('')
  const [jornadaTurnoFilter, setJornadaTurnoFilter] = useState<string>('todos')
  const [jornadaOrigenFilter, setJornadaOrigenFilter] = useState<string>('todos')
  const [soloDiferencias, setSoloDiferencias] = useState(false)

  const editingRowBreakdown = editingRow ? getRowBreakdown(editingRow, isSucursalEmployee) : null

  const filteredRows = useMemo(() => {
    const term = jornadaSearch.trim().toLowerCase()
    return rows.filter((row) => {
      const task = sanitizeTaskValue(row.tarea).toLowerCase()
      const turno = normalizeTurno(row.turno)
      const origen = normalizeOrigen(row.origen)
      const hasDiferencia =
        (row.horas_adicionales || 0) > 0 ||
        (row.turno_especial_unidades || 0) > 0 ||
        (row.tarifa_hora_base || 0) !== (liquidacion.valor_hora || 0)

      if (soloDiferencias && !hasDiferencia) return false
      if (jornadaTurnoFilter !== 'todos' && turno !== jornadaTurnoFilter) return false
      if (jornadaOrigenFilter !== 'todos' && origen !== jornadaOrigenFilter) return false
      if (!term) return true

      const byFecha = row.fecha?.slice(0, 10)?.includes(term)
      return Boolean(byFecha || task.includes(term) || turno.includes(term) || origen.includes(term))
    })
  }, [rows, jornadaSearch, jornadaTurnoFilter, jornadaOrigenFilter, soloDiferencias, liquidacion.valor_hora])

  const jornadasResumen = filteredRows.reduce(
    (acc, row) => {
      acc.horasMensuales += row.horas_mensuales || 0
      acc.horasAdicionales += row.horas_adicionales || 0
      acc.turnosEspeciales += row.turno_especial_unidades || 0
      const breakdown = getRowBreakdown(row, isSucursalEmployee)
      acc.totalAplicado += breakdown.total
      return acc
    },
    { horasMensuales: 0, horasAdicionales: 0, turnosEspeciales: 0, totalAplicado: 0 },
  )

  const openEditSheet = (row: LiquidacionJornada) => {
    setEditingRow({
      ...row,
      turno: row.turno?.trim() || 'general',
      tarea: sanitizeTaskValue(row.tarea),
    })
    setEditSheetOpen(true)
  }

  const handleSaveRow = async (row: LiquidacionJornada) => {
    const validationError = validateJornada(row, isSucursalEmployee)
    if (validationError) {
      showToast('error', validationError, 'Validacion')
      return
    }

    setLoading(true)
    try {
      const result = await upsertLiquidacionJornadaAction(liquidacion.id, {
        id: row.id,
        fecha: row.fecha,
        turno: row.turno?.trim() || 'general',
        tarea: sanitizeTaskValue(row.tarea) || null,
        horas_mensuales: row.horas_mensuales,
        horas_adicionales: row.horas_adicionales,
        turno_especial_unidades: row.turno_especial_unidades,
        tarifa_hora_base: row.tarifa_hora_base,
        tarifa_hora_extra: row.tarifa_hora_extra,
        tarifa_turno_especial: row.tarifa_turno_especial,
        origen: row.origen,
        observaciones: row.observaciones,
      })

      if (!result.success) {
        showToast('error', result.error || 'No se pudo guardar la jornada', 'Error')
        return
      }

      showToast('success', 'Jornada guardada y liquidacion recalculada', 'Guardado')
      setEditSheetOpen(false)
      setEditingRow(null)
      router.refresh()
    } catch {
      showToast('error', 'Error inesperado al guardar jornada', 'Error')
    } finally {
      setLoading(false)
    }
  }

  const handleAddRow = async (draft: NewRowDraft) => {
    setLoading(true)
    try {
      const result = await upsertLiquidacionJornadaAction(liquidacion.id, {
        fecha: draft.fecha,
        turno: draft.turno.trim() || 'general',
        tarea: sanitizeTaskValue(draft.tarea) || null,
        horas_mensuales: draft.horas_mensuales,
        horas_adicionales: draft.horas_adicionales,
        turno_especial_unidades: draft.turno_especial_unidades,
        tarifa_hora_base: draft.tarifa_hora_base,
        tarifa_hora_extra: draft.tarifa_hora_extra,
        tarifa_turno_especial: draft.tarifa_turno_especial,
        origen: 'manual',
        observaciones: draft.observaciones,
      })

      if (!result.success) {
        showToast('error', result.error || 'No se pudo agregar la jornada', 'Error')
        return
      }

      showToast('success', 'Fila agregada correctamente', 'Guardado')
      setAddSheetOpen(false)
      router.refresh()
    } catch {
      showToast('error', 'Error inesperado al agregar fila', 'Error')
    } finally {
      setLoading(false)
    }
  }

  const rowTotal = (row: LiquidacionJornada) => getRowBreakdown(row, isSucursalEmployee).total

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Detalle control hs</CardTitle>
              <CardDescription>
                Haga clic en el icono de lapiz para editar una jornada. Cada guardado recalcula la liquidacion.
              </CardDescription>
              {isSucursalEmployee && (
                <p className="text-xs text-muted-foreground mt-1">
                  En empleados de sucursal, las hs adicionales son informativas y no impactan el total pagable.
                </p>
              )}
            </div>
            <Button size="sm" onClick={() => setAddSheetOpen(true)} disabled={loading}>
              <Plus className="h-4 w-4 mr-1" />
              Agregar jornada
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Resumen */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div className="rounded-md border bg-slate-50 p-3">
              <p className="text-xs text-muted-foreground">Hs mensuales</p>
              <p className="font-semibold tabular-nums">{jornadasResumen.horasMensuales.toFixed(2)}</p>
            </div>
            <div className="rounded-md border bg-slate-50 p-3">
              <p className="text-xs text-muted-foreground">
                Hs adicionales {isSucursalEmployee ? '(informativas)' : ''}
              </p>
              <p className="font-semibold tabular-nums">{jornadasResumen.horasAdicionales.toFixed(2)}</p>
            </div>
            <div className="rounded-md border bg-slate-50 p-3">
              <p className="text-xs text-muted-foreground">Turnos especiales</p>
              <p className="font-semibold tabular-nums">{jornadasResumen.turnosEspeciales.toFixed(2)}</p>
            </div>
            <div className="rounded-md border bg-slate-50 p-3">
              <p className="text-xs text-muted-foreground">Total aplicado</p>
              <p className="font-semibold tabular-nums">{formatMoney(jornadasResumen.totalAplicado)}</p>
            </div>
          </div>

          {/* Filtros */}
          <div className="rounded-md border p-3 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Buscar</Label>
                <Input
                  placeholder="fecha, tarea, turno"
                  value={jornadaSearch}
                  onChange={(e) => setJornadaSearch(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Turno</Label>
                <Select value={jornadaTurnoFilter} onValueChange={setJornadaTurnoFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los turnos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {TURNO_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Origen</Label>
                <Select value={jornadaOrigenFilter} onValueChange={setJornadaOrigenFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los origenes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="hik">HIK</SelectItem>
                    <SelectItem value="asistencia">Asistencia</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end justify-between gap-2">
                <label className="flex items-center gap-2 text-sm pb-2">
                  <Checkbox
                    checked={soloDiferencias}
                    onCheckedChange={(checked) => setSoloDiferencias(Boolean(checked))}
                  />
                  Solo diferencias
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setJornadaSearch('')
                    setJornadaTurnoFilter('todos')
                    setJornadaOrigenFilter('todos')
                    setSoloDiferencias(false)
                  }}
                >
                  Limpiar
                </Button>
              </div>
            </div>
          </div>

          {/* Tabla */}
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Turno</TableHead>
                  <TableHead>Tarea</TableHead>
                  <TableHead className="text-right">Hs Mens.</TableHead>
                  <TableHead className="text-right">Hs Adic.</TableHead>
                  <TableHead className="text-right">T. Especial</TableHead>
                  <TableHead className="text-right">Total aplicado</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-6">
                      No hay jornadas que coincidan con los filtros
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={
                        (row.horas_adicionales || 0) > 0 ||
                        (row.turno_especial_unidades || 0) > 0 ||
                        (row.tarifa_hora_base || 0) !== (liquidacion.valor_hora || 0)
                          ? 'bg-amber-50/30'
                          : undefined
                      }
                    >
                      <TableCell className="text-sm whitespace-nowrap">
                        {row.fecha?.slice(0, 10) ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm">{getTurnoLabel(row.turno)}</TableCell>
                      <TableCell className="text-sm max-w-[160px] truncate">
                        {sanitizeTaskValue(row.tarea) || 'Sin tarea cargada'}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {row.horas_mensuales ?? 0}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {row.horas_adicionales ?? 0}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {row.turno_especial_unidades ?? 0}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums">
                        {formatMoney(rowTotal(row))}
                      </TableCell>
                      <TableCell>{getOrigenBadge(row.origen)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEditSheet(row)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {filteredRows.length > 0 && (
                <TableFooter>
                  <TableRow className="bg-slate-50 font-semibold">
                    <TableCell colSpan={3} className="text-sm">
                      Totales ({filteredRows.length} jornadas)
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {jornadasResumen.horasMensuales.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {jornadasResumen.horasAdicionales.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {jornadasResumen.turnosEspeciales.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {formatMoney(jornadasResumen.totalAplicado)}
                    </TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Sheets */}
      <JornadaEditSheet
        open={editSheetOpen}
        onOpenChange={(open) => {
          setEditSheetOpen(open)
          if (!open) setEditingRow(null)
        }}
        editingRow={editingRow}
        isSucursalEmployee={isSucursalEmployee}
        loading={loading}
        onSave={(row) => {
          setRows((prev) => prev.map((r) => (r.id === row.id ? { ...row } : r)))
          void handleSaveRow(row)
        }}
        onUpdateRow={(patch) => {
          setEditingRow((prev) => (prev ? { ...prev, ...patch } : prev))
        }}
        breakdown={editingRowBreakdown}
      />

      <JornadaAddSheet
        open={addSheetOpen}
        onOpenChange={setAddSheetOpen}
        isSucursalEmployee={isSucursalEmployee}
        loading={loading}
        valorHora={liquidacion.valor_hora || 0}
        rows={rows}
        onAdd={handleAddRow}
      />
    </>
  )
}
