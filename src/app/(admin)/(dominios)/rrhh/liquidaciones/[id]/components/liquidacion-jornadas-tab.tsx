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
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useNotificationStore } from '@/store/notificationStore'
import {
  actualizarAprobacionHorasExtraJornadaAction,
  eliminarLiquidacionJornadaAction,
  guardarLiquidacionTramosPuestoAction,
  upsertLiquidacionJornadaAction,
} from '@/actions/rrhh.actions'
import { JornadaEditSheet } from './jornada-edit-sheet'
import { JornadaAddSheet } from './jornada-add-sheet'
import { JornadasCalendario } from './jornadas-calendario'
import type {
  Liquidacion,
  LiquidacionJornada,
  LiquidacionReglaPuesto,
  LiquidacionTramoPuesto,
} from '@/types/domain.types'
import {
  TURNO_OPTIONS,
  getTurnoLabel,
  getAutoLicenciaLabel,
  getHorasExtraBadgeClasses,
  normalizeOrigen,
  normalizeTurno,
  sanitizeTaskValue,
  formatMoney,
  getTurnoEstadoClasses,
  getRowBreakdown,
  getAusenciaMotivo,
  buildAusenciaObservacion,
  isAusenciaObservacion,
  validateJornada,
  type NewRowDraft,
} from './liquidacion-utils'

function getOrigenBadge(origen: string | null | undefined) {
  if (origen === 'auto_licencia_descanso') {
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
        Descanso
      </Badge>
    )
  }

  if (origen === 'auto_suspension') {
    return (
      <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-xs">
        Suspension
      </Badge>
    )
  }

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
  puestosDisponibles: Pick<LiquidacionReglaPuesto, 'puesto_codigo'>[]
  tramosPuesto: LiquidacionTramoPuesto[]
}

type JornadaRowView = LiquidacionJornada & {
  __placeholder?: boolean
}

export function LiquidacionJornadasTab({
  liquidacion,
  jornadas,
  feriados,
  isSucursalEmployee,
  puestosDisponibles,
  tramosPuesto,
}: LiquidacionJornadasTabProps) {
  const router = useRouter()
  const { showToast } = useNotificationStore()

  const [rows, setRows] = useState<LiquidacionJornada[]>(jornadas)
  const [tramosDraft, setTramosDraft] = useState<LiquidacionTramoPuesto[]>(tramosPuesto)
  const [loading, setLoading] = useState(false)
  const [savingTramos, setSavingTramos] = useState(false)
  const [vistaCalendario, setVistaCalendario] = useState(false)
  const permiteAprobacionHorasExtra = liquidacion.grupo_base_snapshot === 'galpon'
  const periodoDesde = `${liquidacion.periodo_anio}-${String(liquidacion.periodo_mes).padStart(2, '0')}-01`
  const periodoHasta = `${liquidacion.periodo_anio}-${String(liquidacion.periodo_mes).padStart(2, '0')}-${String(new Date(liquidacion.periodo_anio, liquidacion.periodo_mes, 0).getDate()).padStart(2, '0')}`

  useEffect(() => {
    setRows(jornadas)
  }, [jornadas])

  useEffect(() => {
    setTramosDraft(tramosPuesto)
  }, [tramosPuesto])

  // Edit sheet state
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<LiquidacionJornada | null>(null)

  // Add sheet state
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [addSheetInitialDraft, setAddSheetInitialDraft] = useState<Partial<NewRowDraft> | undefined>(undefined)
  const [addSheetSession, setAddSheetSession] = useState(0)
  const [ausenciaDialogOpen, setAusenciaDialogOpen] = useState(false)
  const [ausenciaFecha, setAusenciaFecha] = useState('')
  const [ausenciaMotivo, setAusenciaMotivo] = useState('')
  const [ausenciaRow, setAusenciaRow] = useState<LiquidacionJornada | null>(null)

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

  const getHorasExtraEstado = (row: LiquidacionJornada) => {
    if ((row.horas_adicionales || 0) <= 0) return 'Sin extras'
    if (isSucursalEmployee) return 'Informativas'
    if (!permiteAprobacionHorasExtra) return 'Aplicadas'
    return row.horas_extra_aprobadas === false ? 'Pendientes' : 'Aprobadas'
  }

  const buildNuevoTramo = (): LiquidacionTramoPuesto => {
    const ultimo = [...tramosDraft].sort((a, b) => a.orden - b.orden).at(-1)
    const fechaDesde =
      ultimo?.fecha_hasta && ultimo.fecha_hasta < periodoHasta
        ? new Date(new Date(`${ultimo.fecha_hasta}T12:00:00`).getTime() + 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10)
        : periodoDesde
    return {
      id: '',
      liquidacion_id: liquidacion.id,
      fecha_desde: fechaDesde,
      fecha_hasta: fechaDesde,
      puesto_codigo: ultimo?.puesto_codigo || liquidacion.puesto_override || liquidacion.empleado?.categoria?.nombre || '',
      orden: tramosDraft.length + 1,
      created_at: new Date().toISOString(),
    }
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

      const rowsCompletos: JornadaRowView[] = [...rows, ...faltantes]
      return rowsCompletos.sort((a, b) => {
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
        tarea: sanitizeTaskValue(row.tarea) || undefined,
        horas_mensuales: row.horas_mensuales,
        horas_adicionales: row.horas_adicionales,
        horas_extra_aprobadas: row.horas_extra_aprobadas,
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

  const handleDeleteRow = async (row: LiquidacionJornada) => {
    setLoading(true)
    try {
      const result = await eliminarLiquidacionJornadaAction(liquidacion.id, row.id)

      if (!result.success) {
        showToast('error', result.error || 'No se pudo eliminar la jornada', 'Error')
        return
      }

      setRows((prev) => prev.filter((current) => current.id !== row.id))
      setEditSheetOpen(false)
      setEditingRow(null)
      showToast('success', result.message || 'Jornada eliminada y liquidacion recalculada', 'Eliminado')
      router.refresh()
    } catch {
      showToast('error', 'Error inesperado al eliminar la jornada', 'Error')
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
        tarea: sanitizeTaskValue(draft.tarea) || undefined,
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

  const handleAusenteCalendarioClick = (fecha: string, row?: LiquidacionJornada | null) => {
    setAusenciaFecha(fecha)
    setAusenciaRow(row || null)
    setAusenciaMotivo(getAusenciaMotivo(row?.observaciones))
    setAusenciaDialogOpen(true)
  }

  const handleSaveAusencia = async () => {
    const motivo = ausenciaMotivo.trim()
    if (!motivo) {
      showToast('error', 'Debe escribir el motivo de ausencia', 'Validacion')
      return
    }

    setLoading(true)
    try {
      const result = await upsertLiquidacionJornadaAction(liquidacion.id, {
        id: ausenciaRow?.id,
        fecha: ausenciaFecha,
        turno: ausenciaRow?.turno?.trim() || 'general',
        tarea: sanitizeTaskValue(ausenciaRow?.tarea) || undefined,
        horas_mensuales: 0,
        horas_adicionales: 0,
        horas_extra_aprobadas: true,
        turno_especial_unidades: 0,
        tarifa_hora_base: ausenciaRow?.tarifa_hora_base ?? liquidacion.valor_hora ?? 0,
        tarifa_hora_extra: ausenciaRow?.tarifa_hora_extra ?? liquidacion.valor_hora ?? 0,
        tarifa_turno_especial: ausenciaRow?.tarifa_turno_especial ?? 0,
        origen: ausenciaRow?.origen || 'manual',
        observaciones: buildAusenciaObservacion(motivo),
      })

      if (!result.success) {
        showToast('error', result.error || 'No se pudo guardar la ausencia', 'Error')
        return
      }

      showToast('success', 'Motivo de ausencia guardado', 'Guardado')
      setAusenciaDialogOpen(false)
      setAusenciaFecha('')
      setAusenciaMotivo('')
      setAusenciaRow(null)
      router.refresh()
    } catch {
      showToast('error', 'Error inesperado al guardar la ausencia', 'Error')
    } finally {
      setLoading(false)
    }
  }

  const handleGuardarTramos = async () => {
    setSavingTramos(true)
    try {
      const result = await guardarLiquidacionTramosPuestoAction(
        liquidacion.id,
        tramosDraft.map((tramo, index) => ({
          id: tramo.id || undefined,
          fecha_desde: tramo.fecha_desde,
          fecha_hasta: tramo.fecha_hasta,
          puesto_codigo: tramo.puesto_codigo,
          orden: index + 1,
        })),
      )

      if (!result.success) {
        showToast('error', result.error || 'No se pudieron guardar los tramos', 'Error')
        return
      }

      showToast('success', 'Tramos guardados y liquidacion recalculada', 'Guardado')
      router.refresh()
    } catch {
      showToast('error', 'Error inesperado al guardar los tramos', 'Error')
    } finally {
      setSavingTramos(false)
    }
  }

  const handleToggleHorasExtra = async (row: LiquidacionJornada, aprobadas: boolean) => {
    setLoading(true)
    try {
      const result = await actualizarAprobacionHorasExtraJornadaAction(liquidacion.id, row.id, aprobadas)

      if (!result.success) {
        showToast('error', result.error || 'No se pudo actualizar la aprobacion de extras', 'Error')
        return
      }

      showToast('success', result.message || 'Horas extra actualizadas', 'Guardado')
      router.refresh()
    } catch {
      showToast('error', 'Error inesperado al actualizar las horas extra', 'Error')
    } finally {
      setLoading(false)
    }
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
              {permiteAprobacionHorasExtra && (
                <p className="text-xs text-muted-foreground mt-1">
                  En galpon, las horas por encima de 9 quedan visibles pero solo se imputan al sueldo cuando se aprueban por dia.
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
          <div className="rounded-md border bg-white p-4 space-y-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold">Tramos de puesto del periodo</p>
                <p className="text-xs text-muted-foreground">
                  Si hay vacaciones o cambios de puesto dentro del mes, puede dividir la liquidacion en rangos para aplicar la tarifa correcta por tramo.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setTramosDraft((prev) => [...prev, buildNuevoTramo()])}
                  disabled={savingTramos}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Agregar tramo
                </Button>
                <Button type="button" size="sm" onClick={() => void handleGuardarTramos()} disabled={savingTramos}>
                  {savingTramos ? 'Guardando...' : 'Guardar tramos'}
                </Button>
              </div>
            </div>

            {tramosDraft.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
                Sin tramos cargados. En ese caso se usa el puesto resuelto general de la liquidacion.
              </div>
            ) : (
              <div className="space-y-2">
                {tramosDraft
                  .slice()
                  .sort((a, b) => a.orden - b.orden)
                  .map((tramo, index) => (
                    <div key={`${tramo.id || 'new'}-${index}`} className="grid grid-cols-1 gap-2 rounded-md border p-3 md:grid-cols-[1fr_1fr_2fr_auto]">
                      <div className="space-y-1">
                        <Label className="text-xs">Desde</Label>
                        <Input
                          type="date"
                          min={periodoDesde}
                          max={periodoHasta}
                          value={tramo.fecha_desde}
                          onChange={(event) =>
                            setTramosDraft((prev) =>
                              prev.map((current, currentIndex) =>
                                currentIndex === index ? { ...current, fecha_desde: event.target.value } : current,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Hasta</Label>
                        <Input
                          type="date"
                          min={periodoDesde}
                          max={periodoHasta}
                          value={tramo.fecha_hasta}
                          onChange={(event) =>
                            setTramosDraft((prev) =>
                              prev.map((current, currentIndex) =>
                                currentIndex === index ? { ...current, fecha_hasta: event.target.value } : current,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Puesto del tramo</Label>
                        <Input
                          list="puestos-tramo-liquidacion"
                          value={tramo.puesto_codigo}
                          onChange={(event) =>
                            setTramosDraft((prev) =>
                              prev.map((current, currentIndex) =>
                                currentIndex === index ? { ...current, puesto_codigo: event.target.value } : current,
                              ),
                            )
                          }
                          placeholder="Ej: caja, reposicion, reparto"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => setTramosDraft((prev) => prev.filter((_, currentIndex) => currentIndex !== index))}
                          disabled={savingTramos}
                        >
                          Quitar
                        </Button>
                      </div>
                    </div>
                  ))}
                <datalist id="puestos-tramo-liquidacion">
                  {puestosDisponibles.map((puesto) => (
                    <option key={puesto.puesto_codigo} value={puesto.puesto_codigo} />
                  ))}
                </datalist>
              </div>
            )}
          </div>

          {/* Resumen */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div className="rounded-md border bg-slate-50 p-3">
              <p className="text-xs text-muted-foreground">Horas diarias</p>
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
                    <SelectItem value="suspension">Suspension</SelectItem>
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
                handleAusenteCalendarioClick(dia.fecha, dia.jornada)
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
                  <TableHead className="text-right">Hs diarias</TableHead>
                  <TableHead className="text-right">Hs Adic.</TableHead>
                  <TableHead>Estado extra</TableHead>
                  <TableHead className="text-right">T. Especial</TableHead>
                  <TableHead className="text-right">Total aplicado</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead className="w-[150px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-6">
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
                    const licenciaLabel = getAutoLicenciaLabel(row)
                    const esAusenciaRegistrada = isAusenciaObservacion(row.observaciones)
                    const placeholderTipo = isPlaceholder ? getPlaceholderTipo(fechaIso) : null
                    const esLicenciaAutomatica = Boolean(licenciaLabel)
                    const editActionLabel = licenciaLabel
                      ? licenciaLabel.toLowerCase().includes('descanso')
                        ? 'Editar descanso'
                        : `Editar ${licenciaLabel.toLowerCase()}`
                      : 'Editar jornada'
                    const hasDiferencia =
                      (row.horas_adicionales || 0) > 0 ||
                      (row.turno_especial_unidades || 0) > 0 ||
                      (row.tarifa_hora_base || 0) !== (liquidacion.valor_hora || 0)
                    const turnoClasses = getTurnoEstadoClasses(row)
                    const extraStatusClasses = getHorasExtraBadgeClasses({
                      horasAdicionales: row.horas_adicionales,
                      horasExtraAprobadas: row.horas_extra_aprobadas,
                      isSucursalEmployee,
                      permiteAprobacion: permiteAprobacionHorasExtra,
                    })
                    const rowClass = isPlaceholder
                      ? placeholderTipo === 'ausente'
                        ? 'bg-red-50/70'
                        : 'bg-slate-50/90'
                      : esAusenciaRegistrada
                      ? 'bg-red-50/70'
                      : row.origen === 'auto_suspension'
                      ? 'bg-rose-50/60'
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
                          {licenciaLabel && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                              {licenciaLabel}
                            </Badge>
                          )}
                          {!isPlaceholder && esAusenciaRegistrada && (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                              Ausente
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
                        ) : esAusenciaRegistrada ? (
                          <span className="text-red-700 font-medium">Ausente</span>
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
                            <Badge variant="outline" className={`text-xs ${turnoClasses}`}>
                              {getTurnoLabel(row.turno)}
                            </Badge>
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
                      <TableCell className="text-sm">
                        {isPlaceholder ? (
                          <span className="text-muted-foreground">-</span>
                        ) : (
                          <div className="flex flex-col items-start gap-1">
                            <Badge variant="outline" className={`text-[10px] ${extraStatusClasses}`}>
                              {getHorasExtraEstado(row)}
                            </Badge>
                            {permiteAprobacionHorasExtra && (row.horas_adicionales || 0) > 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-0 text-xs text-primary hover:bg-transparent"
                                onClick={() => void handleToggleHorasExtra(row, row.horas_extra_aprobadas === false)}
                                disabled={loading}
                              >
                                {row.horas_extra_aprobadas === false ? 'Aprobar' : 'Revocar'}
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {row.turno_especial_unidades ?? 0}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums">
                        {formatMoney(rowTotal(row))}
                      </TableCell>
                      <TableCell>{getOrigenBadge(row.origen)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {esLicenciaAutomatica ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 gap-1.5 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
                            onClick={() => openEditSheet(row)}
                            aria-label={`${editActionLabel} del dia ${formatDateDMY(row.fecha)}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="text-xs font-medium">{editActionLabel}</span>
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditSheet(row)}
                            aria-label={`Editar jornada del dia ${formatDateDMY(row.fecha)}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
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
                    <TableCell />
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
        key={`jornada-edit-sheet-${editingRow?.id || 'empty'}`}
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
        onDelete={(row) => void handleDeleteRow(row)}
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

      <Dialog
        open={ausenciaDialogOpen}
        onOpenChange={(open) => {
          setAusenciaDialogOpen(open)
          if (!open) {
            setAusenciaFecha('')
            setAusenciaMotivo('')
            setAusenciaRow(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Motivo de ausencia</DialogTitle>
            <DialogDescription>
              Registre el motivo para el día {formatDateDMY(ausenciaFecha)}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="motivo-ausencia">Detalle</Label>
            <Textarea
              id="motivo-ausencia"
              value={ausenciaMotivo}
              onChange={(event) => setAusenciaMotivo(event.target.value)}
              placeholder="Ej: enfermedad, trámite, falta sin aviso..."
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAusenciaDialogOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button onClick={() => void handleSaveAusencia()} disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar motivo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

