'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Pencil, Plus, Table2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useNotificationStore } from '@/store/notificationStore'
import { upsertLiquidacionJornadaAction } from '@/actions/rrhh.actions'
import { JornadaEditSheet } from './jornada-edit-sheet'
import { JornadaAddSheet } from './jornada-add-sheet'
import { JornadasCalendario } from './jornadas-calendario'
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
  feriados: Array<{ fecha: string; descripcion?: string | null }>
  isSucursalEmployee: boolean
}

type JornadaRowView = LiquidacionJornada & {
  __placeholder?: boolean
}

export function LiquidacionJornadasTab({
  liquidacion,
  jornadas,
  feriados,
  isSucursalEmployee,
}: LiquidacionJornadasTabProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()

  const [rows, setRows] = useState<LiquidacionJornada[]>(jornadas)
  const [loading, setLoading] = useState(false)
  const [vistaCalendario, setVistaCalendario] = useState(false)

  useEffect(() => {
    setRows(jornadas)
  }, [jornadas])

  // Edit sheet state
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<LiquidacionJornada | null>(null)

  // Add sheet state
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [addSheetInitialDraft, setAddSheetInitialDraft] = useState<Partial<NewRowDraft> | undefined>(undefined)
  const [addSheetSession, setAddSheetSession] = useState(0)

  // Filters
  const [jornadaSearch, setJornadaSearch] = useState('')
  const [jornadaTurnoFilter, setJornadaTurnoFilter] = useState<string>('todos')
  const [jornadaOrigenFilter, setJornadaOrigenFilter] = useState<string>('todos')
  const [soloDiferencias, setSoloDiferencias] = useState(false)
  const defaultPuestoLabel =
    liquidacion.puesto_override?.trim() ||
    liquidacion.empleado?.categoria?.nombre?.trim() ||
    'Sin puesto asignado'

  const editingRowBreakdown = editingRow ? getRowBreakdown(editingRow, isSucursalEmployee) : null
  const feriadosMap = useMemo(
    () =>
      new Map<string, string>(
        feriados
          .filter((f) => Boolean(f.fecha))
          .map((f) => [String(f.fecha).slice(0, 10), (f.descripcion || 'Feriado').trim() || 'Feriado']),
      ),
    [feriados],
  )

  const formatDateDMY = (value?: string | null): string => {
    const iso = value?.slice(0, 10) || ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '—'
    const [year, month, day] = iso.split('-')
    return `${day}-${month}-${year}`
  }

  const isSunday = (isoDate: string): boolean => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false
    return new Date(`${isoDate}T00:00:00`).getDay() === 0
  }

  const todayArgentina = useMemo(
    () =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires',
      }).format(new Date()),
    [],
  )

  const getPlaceholderTipo = (fechaIso: string): 'ausente' | 'no_laboral' | 'pendiente' => {
    if (!fechaIso) return 'no_laboral'
    if (fechaIso > todayArgentina) return 'pendiente'
    if (isSunday(fechaIso) || feriadosMap.has(fechaIso)) return 'no_laboral'
    return 'ausente'
  }

  const filteredRows = useMemo(() => {
    const rowsConTodosLosDias: JornadaRowView[] = (() => {
      const diasDelMes = new Date(liquidacion.periodo_anio, liquidacion.periodo_mes, 0).getDate()
      const fechasConCarga = new Set(
        rows
          .filter((row) => Boolean(row.fecha))
          .map((row) => String(row.fecha).slice(0, 10)),
      )

      const faltantes: JornadaRowView[] = []
      for (let dia = 1; dia <= diasDelMes; dia++) {
        const fecha = `${liquidacion.periodo_anio}-${String(liquidacion.periodo_mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
        if (!fechasConCarga.has(fecha)) {
          faltantes.push({
            id: `placeholder-${fecha}`,
            liquidacion_id: liquidacion.id,
            empleado_id: liquidacion.empleado_id,
            created_at: `${fecha}T00:00:00.000Z`,
            fecha,
            turno: 'general',
            tarea: '',
            horas_mensuales: 0,
            horas_adicionales: 0,
            turno_especial_unidades: 0,
            tarifa_hora_base: liquidacion.valor_hora || 0,
            tarifa_hora_extra: 0,
            tarifa_turno_especial: 0,
            origen: 'manual',
            observaciones: 'Sin carga',
            __placeholder: true,
          })
        }
      }

      return [...rows, ...faltantes].sort((a, b) => {
        const dateDiff = String(a.fecha || '').localeCompare(String(b.fecha || ''))
        if (dateDiff !== 0) return dateDiff
        if (a.__placeholder && !b.__placeholder) return 1
        if (!a.__placeholder && b.__placeholder) return -1
        return String(a.created_at || '').localeCompare(String(b.created_at || ''))
      })
    })()

    const term = jornadaSearch.trim().toLowerCase()
    return rowsConTodosLosDias.filter((row) => {
      const esPlaceholder = Boolean(row.__placeholder)
      const task = (sanitizeTaskValue(row.tarea) || defaultPuestoLabel).toLowerCase()
      const turno = normalizeTurno(row.turno)
      const origen = normalizeOrigen(row.origen)
      const fechaIso = row.fecha?.slice(0, 10) || ''
      const fechaDmy = formatDateDMY(row.fecha).toLowerCase()
      const hasDiferencia =
        (row.horas_adicionales || 0) > 0 ||
        (row.turno_especial_unidades || 0) > 0 ||
        (row.tarifa_hora_base || 0) !== (liquidacion.valor_hora || 0)

      if (soloDiferencias && !hasDiferencia) return false
      if (jornadaTurnoFilter !== 'todos' && turno !== jornadaTurnoFilter) return false
      if (esPlaceholder && jornadaOrigenFilter !== 'todos') return false
      if (jornadaOrigenFilter !== 'todos' && origen !== jornadaOrigenFilter) return false
      if (!term) return true

      const byFecha = fechaIso.includes(term) || fechaDmy.includes(term)
      return Boolean(byFecha || task.includes(term) || turno.includes(term) || origen.includes(term))
    })
  }, [
    rows,
    jornadaSearch,
    jornadaTurnoFilter,
    jornadaOrigenFilter,
    soloDiferencias,
    liquidacion.id,
    liquidacion.empleado_id,
    liquidacion.periodo_mes,
    liquidacion.periodo_anio,
    liquidacion.valor_hora,
    defaultPuestoLabel,
  ])

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
        id: row.id?.startsWith('placeholder-') ? undefined : row.id,
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
      setAddSheetInitialDraft(undefined)
      router.refresh()
    } catch {
      showToast('error', 'Error inesperado al agregar fila', 'Error')
    } finally {
      setLoading(false)
    }
  }

  const rowTotal = (row: LiquidacionJornada) => getRowBreakdown(row, isSucursalEmployee).total

  const handleAusenteCalendarioClick = (fecha: string) => {
    setAddSheetInitialDraft({
      fecha,
      turno: 'general',
      tarea: '',
      observaciones: '',
    })
    setAddSheetSession((prev) => prev + 1)
    setAddSheetOpen(true)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Detalle de jornadas</CardTitle>
              <CardDescription>
                Haga clic en el icono de lapiz para editar una jornada. Cada guardado recalcula la liquidacion.
              </CardDescription>
              {isSucursalEmployee && (
                <p className="text-xs text-muted-foreground mt-1">
                  En empleados de sucursal, las hs adicionales son informativas y no impactan el total pagable.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-md border bg-muted/30 p-0.5">
                <Button
                  size="sm"
                  variant={vistaCalendario ? 'ghost' : 'secondary'}
                  className="h-7 px-2 gap-1"
                  onClick={() => setVistaCalendario(false)}
                >
                  <Table2 className="h-3.5 w-3.5" />
                  <span className="text-xs">Tabla</span>
                </Button>
                <Button
                  size="sm"
                  variant={vistaCalendario ? 'secondary' : 'ghost'}
                  className="h-7 px-2 gap-1"
                  onClick={() => setVistaCalendario(true)}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span className="text-xs">Calendario</span>
                </Button>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setAddSheetInitialDraft(undefined)
                  setAddSheetSession((prev) => prev + 1)
                  setAddSheetOpen(true)
                }}
                disabled={loading}
              >
                <Plus className="h-4 w-4 mr-1" />
                Agregar jornada
              </Button>
            </div>
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

          {/* Filtros (solo en vista tabla) */}
          {!vistaCalendario && <div className="rounded-md border p-3 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Buscar</Label>
                <Input
                  placeholder="fecha, puesto, turno"
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
          </div>}

          {/* Vista calendario */}
          {vistaCalendario && (
            <JornadasCalendario
              jornadas={rows}
              feriados={feriados}
              periodoMes={liquidacion.periodo_mes}
              periodoAnio={liquidacion.periodo_anio}
              onDiaClick={(dia) => {
                if (dia.tipo !== 'ausente') return
                handleAusenteCalendarioClick(dia.fecha)
              }}
            />
          )}

          {/* Tabla */}
          {!vistaCalendario && <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Turno</TableHead>
                  <TableHead>Puesto del dia</TableHead>
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
                  filteredRows.map((row) => {
                    const isPlaceholder = (row as JornadaRowView).__placeholder === true
                    const fechaIso = row.fecha?.slice(0, 10) || ''
                    const feriadoLabel = feriadosMap.get(fechaIso)
                    const esFeriado = Boolean(feriadoLabel)
                    const esDomingo = isSunday(fechaIso)
                    const esDescanso = row.origen === 'auto_licencia_descanso'
                    const placeholderTipo = isPlaceholder ? getPlaceholderTipo(fechaIso) : null
                    const hasDiferencia =
                      (row.horas_adicionales || 0) > 0 ||
                      (row.turno_especial_unidades || 0) > 0 ||
                      (row.tarifa_hora_base || 0) !== (liquidacion.valor_hora || 0)
                    const rowClass = isPlaceholder
                      ? placeholderTipo === 'ausente'
                        ? 'bg-red-50/70'
                        : 'bg-slate-50/90'
                      : esFeriado || esDomingo
                      ? 'bg-rose-50/60'
                      : hasDiferencia
                        ? 'bg-amber-50/30'
                        : undefined

                    return (
                    <TableRow
                      key={row.id}
                      className={rowClass}
                    >
                      <TableCell className="text-sm whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{formatDateDMY(row.fecha)}</span>
                          {esDomingo && (
                            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]">
                              Domingo
                            </Badge>
                          )}
                          {esFeriado && (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                              {feriadoLabel}
                            </Badge>
                          )}
                          {esDescanso && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                              Descanso
                            </Badge>
                          )}
                          {isPlaceholder && (
                            <>
                              {placeholderTipo === 'ausente' ? (
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                                  Ausente
                                </Badge>
                              ) : placeholderTipo === 'pendiente' ? (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                                  Pendiente
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 text-[10px]">
                                  Sin carga
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {isPlaceholder ? (
                          <span
                            className={
                              placeholderTipo === 'ausente'
                                ? 'text-red-700 font-medium'
                                : placeholderTipo === 'pendiente'
                                ? 'text-amber-700'
                                : 'text-muted-foreground'
                            }
                          >
                            {placeholderTipo === 'ausente'
                              ? 'Ausente'
                              : placeholderTipo === 'pendiente'
                              ? 'Pendiente'
                              : 'Sin carga'}
                          </span>
                        ) : (() => {
                          const horasInsuf =
                            (row.horas_mensuales ?? 0) > 0 &&
                            (row.horas_mensuales ?? 0) < 4 &&
                            row.origen !== 'auto_licencia_descanso'
                          return horasInsuf ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="flex items-center gap-1.5 cursor-help">
                                    <span className="text-red-600 font-medium">{getTurnoLabel(row.turno)}</span>
                                    <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-[10px] leading-tight py-0">
                                      Faltan hs
                                    </Badge>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Solo {row.horas_mensuales}hs registradas, se esperan ≥4hs del HIK
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            getTurnoLabel(row.turno)
                          )
                        })()}
                      </TableCell>
                      <TableCell className="text-sm max-w-[160px] truncate">
                        {isPlaceholder ? (
                          <span className="text-muted-foreground">Sin puesto cargado</span>
                        ) : (
                          sanitizeTaskValue(row.tarea) || defaultPuestoLabel
                        )}
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
                    )
                  })
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
          </div>}
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
        key={`jornada-add-sheet-${addSheetSession}-${addSheetInitialDraft?.fecha || 'default'}`}
        open={addSheetOpen}
        onOpenChange={(open) => {
          setAddSheetOpen(open)
          if (!open) {
            setAddSheetInitialDraft(undefined)
          }
        }}
        isSucursalEmployee={isSucursalEmployee}
        loading={loading}
        valorHora={liquidacion.valor_hora || 0}
        rows={rows}
        onAdd={handleAddRow}
        initialDraft={addSheetInitialDraft}
      />
    </>
  )
}

