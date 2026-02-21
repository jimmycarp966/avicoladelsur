'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
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
import { useNotificationStore } from '@/store/notificationStore'
import {
  aprobarLiquidacionAction,
  autorizarPagoLiquidacionAction,
  actualizarLiquidacionControlAction,
  marcarLiquidacionPagadaAction,
  recalcularLiquidacionAction,
  upsertLiquidacionJornadaAction,
} from '@/actions/rrhh.actions'
import type { AdelantoCuota, Liquidacion, LiquidacionJornada, LiquidacionReglaPuesto } from '@/types/domain.types'

type CuotaWithPlan = AdelantoCuota & {
  plan?: {
    tipo?: string
    monto_total?: number
    descripcion?: string
    cantidad_cuotas?: number
  }
}

type Props = {
  liquidacion: Liquidacion
  jornadas: LiquidacionJornada[]
  cuotas: CuotaWithPlan[]
  puestosDisponibles: Pick<LiquidacionReglaPuesto, 'puesto_codigo'>[]
}

type JornadaCalculoInput = Pick<
  LiquidacionJornada,
  | 'horas_mensuales'
  | 'horas_adicionales'
  | 'turno_especial_unidades'
  | 'tarifa_hora_base'
  | 'tarifa_hora_extra'
  | 'tarifa_turno_especial'
>

type NewRowDraft = {
  fecha: string
  turno: string
  tarea: string
  horas_mensuales: number
  horas_adicionales: number
  turno_especial_unidades: number
  tarifa_hora_base: number
  tarifa_hora_extra: number
  tarifa_turno_especial: number
  observaciones: string
}

type ConfirmFlowAction = 'aprobar' | 'pagar' | 'no_autorizar'

function toNum(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value?: number | null) {
  return `$${(value || 0).toLocaleString()}`
}

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

const TURNO_OPTIONS = [
  { value: 'general', label: 'General (jornada normal)' },
  { value: 'manana', label: 'Manana' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noche', label: 'Noche' },
  { value: 'feriado', label: 'Feriado' },
  { value: 'domingo', label: 'Domingo' },
] as const

const TASK_TEMPLATES = ['Caja', 'Atencion al cliente', 'Reposicion', 'Reparto', 'Deposito', 'Limpieza'] as const

const TURNO_VALUE_SET = new Set<string>(TURNO_OPTIONS.map((opt) => opt.value))

function normalizeTurno(value?: string | null): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function getTurnoSelectValue(value?: string | null): string {
  const normalized = normalizeTurno(value)
  if (!normalized) return 'general'
  return TURNO_VALUE_SET.has(normalized) ? normalized : 'otro'
}

function getTurnoLabel(value?: string | null): string {
  const normalized = normalizeTurno(value)
  if (!normalized) return 'General'
  const option = TURNO_OPTIONS.find((opt) => opt.value === normalized)
  if (option) {
    return option.label.replace(' (jornada normal)', '')
  }
  return value?.trim() || 'General'
}

function sanitizeTaskValue(value?: string | null): string {
  const raw = (value || '').trim()
  if (!raw) return ''
  const normalized = raw.toLowerCase()
  if (normalized.includes('sincronizado desde hikconnect') || normalized.includes('sincronizado')) {
    return ''
  }
  return raw
}

function normalizeOrigen(origen?: string | null): 'hik' | 'asistencia' | 'manual' {
  const value = (origen || '').toLowerCase().trim()
  if (value.includes('hik')) return 'hik'
  if (value.includes('asistencia')) return 'asistencia'
  return 'manual'
}

export function LiquidacionDetalleClient({ liquidacion, jornadas, cuotas, puestosDisponibles }: Props) {
  const router = useRouter()
  const { showToast } = useNotificationStore()

  const [rows, setRows] = useState<LiquidacionJornada[]>(jornadas)
  const [loading, setLoading] = useState(false)

  // Sincronizar rows cuando el Server Component se refresca con nuevas jornadas
  useEffect(() => {
    setRows(jornadas)
  }, [jornadas])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<LiquidacionJornada | null>(null)
  const [editingRowError, setEditingRowError] = useState<string | null>(null)
  const [showEditingAdvancedTarifas, setShowEditingAdvancedTarifas] = useState(false)

  const [control, setControl] = useState({
    puesto_override: liquidacion.puesto_override || '',
    puesto_hs_extra: liquidacion.puesto_hs_extra ?? null as string | null,
    dias_cajero: liquidacion.dias_cajero || 0,
    diferencia_turno_cajero: liquidacion.diferencia_turno_cajero || 0,
    orden_pago: liquidacion.orden_pago || 0,
    observaciones: liquidacion.observaciones || '',
  })

  const [newRow, setNewRow] = useState<NewRowDraft>({
    fecha: new Date().toISOString().slice(0, 10),
    turno: 'general',
    tarea: '',
    horas_mensuales: 0,
    horas_adicionales: 0,
    turno_especial_unidades: 0,
    tarifa_hora_base: liquidacion.valor_hora || 0,
    tarifa_hora_extra: liquidacion.valor_hora || 0,
    tarifa_turno_especial: 0,
    observaciones: '',
  })
  const [newRowError, setNewRowError] = useState<string | null>(null)
  const [showAdvancedTarifas, setShowAdvancedTarifas] = useState(false)

  const [motivoNoAutorizado, setMotivoNoAutorizado] = useState(liquidacion.motivo_no_autorizado || '')
  const [confirmFlowAction, setConfirmFlowAction] = useState<ConfirmFlowAction | null>(null)
  const [jornadaSearch, setJornadaSearch] = useState('')
  const [jornadaTurnoFilter, setJornadaTurnoFilter] = useState<string>('todos')
  const [jornadaOrigenFilter, setJornadaOrigenFilter] = useState<string>('todos')
  const [soloDiferencias, setSoloDiferencias] = useState(false)

  const isSucursalEmployee = useMemo(() => {
    const categoriaNombre = liquidacion.empleado?.categoria?.nombre?.toLowerCase() || ''
    return Boolean(liquidacion.empleado?.sucursal_id) || categoriaNombre.includes('sucursal')
  }, [liquidacion.empleado?.categoria?.nombre, liquidacion.empleado?.sucursal_id])

  const getRowBreakdown = (row: JornadaCalculoInput) => {
    const base = (row.horas_mensuales || 0) * (row.tarifa_hora_base || 0)
    const extra = (row.horas_adicionales || 0) * (row.tarifa_hora_extra || 0)
    const especial = (row.turno_especial_unidades || 0) * (row.tarifa_turno_especial || 0)
    const extraAplicado = isSucursalEmployee ? 0 : extra

    return {
      base,
      extra,
      extraAplicado,
      especial,
      total: base + extraAplicado + especial,
    }
  }

  const newRowBreakdown = getRowBreakdown(newRow)
  const editingRowBreakdown = editingRow ? getRowBreakdown(editingRow) : null
  const newRowTurnoSelectValue = getTurnoSelectValue(newRow.turno)
  const editingTurnoSelectValue = getTurnoSelectValue(editingRow?.turno)
  const trimmedMotivoNoAutorizado = motivoNoAutorizado.trim()

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
      const breakdown = getRowBreakdown(row)
      acc.totalAplicado += breakdown.total
      return acc
    },
    {
      horasMensuales: 0,
      horasAdicionales: 0,
      turnosEspeciales: 0,
      totalAplicado: 0,
    },
  )

  const estadoLabel =
    liquidacion.estado === 'borrador'
      ? 'Borrador'
      : liquidacion.estado === 'calculada'
        ? 'Calculada'
        : liquidacion.estado === 'aprobada'
          ? 'Aprobada'
          : 'Pagada'

  const estadoBadgeClass =
    liquidacion.estado === 'pagada'
      ? 'bg-green-50 text-green-700 border-green-200'
      : liquidacion.estado === 'aprobada'
        ? 'bg-blue-50 text-blue-700 border-blue-200'
        : liquidacion.estado === 'calculada'
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-slate-50 text-slate-700 border-slate-200'

  const approveBlockedReason =
    liquidacion.estado === 'aprobada' || liquidacion.estado === 'pagada'
      ? 'La liquidacion ya esta aprobada o pagada.'
      : liquidacion.control_30_superado && !liquidacion.pago_autorizado
        ? 'Supera control 30%. Primero autorice el pago.'
        : null

  const payBlockedReason =
    liquidacion.estado !== 'aprobada'
      ? 'Solo se puede pagar una liquidacion aprobada.'
      : null

  const nextStep =
    liquidacion.estado === 'pagada'
      ? 'No hay acciones pendientes.'
      : liquidacion.estado === 'aprobada'
        ? 'Siguiente paso: marcar como pagada.'
        : liquidacion.control_30_superado && !liquidacion.pago_autorizado
          ? 'Siguiente paso: autorizar pago o cargar motivo de rechazo.'
          : 'Siguiente paso: revisar control y aprobar.'

  const confirmTitle =
    confirmFlowAction === 'aprobar'
      ? 'Confirmar aprobacion'
      : confirmFlowAction === 'pagar'
        ? 'Confirmar pago'
        : 'Confirmar no autorizacion'

  const confirmDescription =
    confirmFlowAction === 'aprobar'
      ? 'Se marcara la liquidacion como aprobada.'
      : confirmFlowAction === 'pagar'
        ? 'Se marcara la liquidacion como pagada.'
        : 'Se registrara la no autorizacion con el motivo cargado.'

  const confirmActionLabel =
    confirmFlowAction === 'aprobar'
      ? 'Aprobar'
      : confirmFlowAction === 'pagar'
        ? 'Marcar pagada'
        : 'No autorizar'

  const updateNewRow = (patch: Partial<NewRowDraft>) => {
    setNewRow((prev) => ({ ...prev, ...patch }))
    if (newRowError) {
      setNewRowError(null)
    }
  }

  const validateNewRow = () => {
    if (!newRow.fecha) return 'La fecha es obligatoria.'

    const checks: Array<[string, number]> = [
      ['hs mensuales', newRow.horas_mensuales],
      ['hs adicionales', newRow.horas_adicionales],
      ['turno especial', newRow.turno_especial_unidades],
      ['tarifa base', newRow.tarifa_hora_base],
      ['tarifa extra', newRow.tarifa_hora_extra],
      ['tarifa especial', newRow.tarifa_turno_especial],
    ]

    const invalidNegative = checks.find(([, value]) => value < 0)
    if (invalidNegative) return `El campo ${invalidNegative[0]} no puede ser negativo.`

    const unidades =
      (newRow.horas_mensuales || 0) + (newRow.horas_adicionales || 0) + (newRow.turno_especial_unidades || 0)
    if (unidades <= 0) {
      return 'Debe cargar al menos hs mensuales, hs adicionales o turno especial mayor a 0.'
    }

    if ((newRow.horas_mensuales || 0) > 0 && (newRow.tarifa_hora_base || 0) <= 0) {
      return 'Si carga hs mensuales, la tarifa base debe ser mayor a 0.'
    }

    if (!isSucursalEmployee && (newRow.horas_adicionales || 0) > 0 && (newRow.tarifa_hora_extra || 0) <= 0) {
      return 'Si carga hs adicionales, la tarifa extra debe ser mayor a 0.'
    }

    if ((newRow.turno_especial_unidades || 0) > 0 && (newRow.tarifa_turno_especial || 0) <= 0) {
      return 'Si carga turno especial, la tarifa especial debe ser mayor a 0.'
    }

    return null
  }

  const validateExistingRow = (row: LiquidacionJornada) => {
    if (!row.fecha) return 'La fecha es obligatoria.'

    const checks: Array<[string, number]> = [
      ['hs mensuales', row.horas_mensuales || 0],
      ['hs adicionales', row.horas_adicionales || 0],
      ['turno especial', row.turno_especial_unidades || 0],
      ['tarifa base', row.tarifa_hora_base || 0],
      ['tarifa extra', row.tarifa_hora_extra || 0],
      ['tarifa especial', row.tarifa_turno_especial || 0],
    ]

    const invalidNegative = checks.find(([, value]) => value < 0)
    if (invalidNegative) return `El campo ${invalidNegative[0]} no puede ser negativo.`

    const unidades =
      (row.horas_mensuales || 0) + (row.horas_adicionales || 0) + (row.turno_especial_unidades || 0)
    if (unidades <= 0) {
      return 'Debe cargar al menos hs mensuales, hs adicionales o turno especial mayor a 0.'
    }

    if ((row.horas_mensuales || 0) > 0 && (row.tarifa_hora_base || 0) <= 0) {
      return 'Si carga hs mensuales, la tarifa base debe ser mayor a 0.'
    }

    if (!isSucursalEmployee && (row.horas_adicionales || 0) > 0 && (row.tarifa_hora_extra || 0) <= 0) {
      return 'Si carga hs adicionales, la tarifa extra debe ser mayor a 0.'
    }

    if ((row.turno_especial_unidades || 0) > 0 && (row.tarifa_turno_especial || 0) <= 0) {
      return 'Si carga turno especial, la tarifa especial debe ser mayor a 0.'
    }

    return null
  }

  const cuotasPeriodo = useMemo(() => {
    return cuotas.filter(
      (c) => c.periodo_mes === liquidacion.periodo_mes && c.periodo_anio === liquidacion.periodo_anio,
    )
  }, [cuotas, liquidacion.periodo_mes, liquidacion.periodo_anio])

  const control30Anticipos = liquidacion.control_30_anticipos ?? 0
  const control30Limite = liquidacion.control_30_limite ?? 0
  const control30Pct =
    control30Limite > 0 ? Math.min(Math.round((control30Anticipos / control30Limite) * 100), 100) : 0

  const handleSaveRow = async (row: LiquidacionJornada) => {
    const validationError = validateExistingRow(row)
    if (validationError) {
      setEditingRowError(validationError)
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
      setSheetOpen(false)
      setEditingRow(null)
      router.refresh()
    } catch {
      showToast('error', 'Error inesperado al guardar jornada', 'Error')
    } finally {
      setLoading(false)
    }
  }

  const handleAddRow = async () => {
    const validationError = validateNewRow()
    if (validationError) {
      setNewRowError(validationError)
      showToast('error', validationError, 'Validacion')
      return
    }

    setLoading(true)
    try {
      const result = await upsertLiquidacionJornadaAction(liquidacion.id, {
        fecha: newRow.fecha,
        turno: newRow.turno.trim() || 'general',
        tarea: sanitizeTaskValue(newRow.tarea) || null,
        horas_mensuales: newRow.horas_mensuales,
        horas_adicionales: newRow.horas_adicionales,
        turno_especial_unidades: newRow.turno_especial_unidades,
        tarifa_hora_base: newRow.tarifa_hora_base,
        tarifa_hora_extra: newRow.tarifa_hora_extra,
        tarifa_turno_especial: newRow.tarifa_turno_especial,
        origen: 'manual',
        observaciones: newRow.observaciones,
      })

      if (!result.success) {
        showToast('error', result.error || 'No se pudo agregar la jornada', 'Error')
        return
      }

      setNewRow((prev) => ({
        ...prev,
        turno: prev.turno || 'general',
        tarea: '',
        horas_mensuales: 0,
        horas_adicionales: 0,
        turno_especial_unidades: 0,
        observaciones: '',
      }))
      setNewRowError(null)
      setShowAdvancedTarifas(false)
      showToast('success', 'Fila agregada correctamente', 'Guardado')
      router.refresh()
    } catch {
      showToast('error', 'Error inesperado al agregar fila', 'Error')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveControl = async () => {
    setLoading(true)
    try {
      const result = await actualizarLiquidacionControlAction(liquidacion.id, {
        puesto_override: control.puesto_override || null,
        puesto_hs_extra: control.puesto_hs_extra || null,
        dias_cajero: control.dias_cajero,
        diferencia_turno_cajero: control.diferencia_turno_cajero,
        orden_pago: control.orden_pago || null,
        observaciones: control.observaciones || null,
      })

      if (!result.success) {
        showToast('error', result.error || 'No se pudo guardar control', 'Error')
        return
      }

      showToast('success', 'Control actualizado y liquidacion recalculada', 'Guardado')
      router.refresh()
    } catch {
      showToast('error', 'Error inesperado al guardar control', 'Error')
    } finally {
      setLoading(false)
    }
  }

  const handleRecalcular = async () => {
    setLoading(true)
    try {
      const result = await recalcularLiquidacionAction(liquidacion.id)
      if (!result.success) {
        showToast('error', result.error || 'No se pudo recalcular', 'Error')
        return
      }
      showToast('success', 'Liquidacion recalculada', 'OK')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const handleAutorizar = async (autorizado: boolean) => {
    if (!autorizado && !trimmedMotivoNoAutorizado) {
      showToast('error', 'Ingrese un motivo para no autorizar.', 'Validacion')
      return
    }

    setLoading(true)
    try {
      const result = await autorizarPagoLiquidacionAction(
        liquidacion.id,
        autorizado,
        autorizado ? undefined : motivoNoAutorizado,
      )
      if (!result.success) {
        showToast('error', result.error || 'No se pudo actualizar autorizacion', 'Error')
        return
      }
      showToast('success', autorizado ? 'Pago autorizado' : 'Pago no autorizado', 'OK')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const requestAprobar = () => {
    if (approveBlockedReason) {
      showToast('error', approveBlockedReason, 'Accion bloqueada')
      return
    }
    setConfirmFlowAction('aprobar')
  }

  const requestPagar = () => {
    if (payBlockedReason) {
      showToast('error', payBlockedReason, 'Accion bloqueada')
      return
    }
    setConfirmFlowAction('pagar')
  }

  const requestNoAutorizar = () => {
    if (!trimmedMotivoNoAutorizado) {
      showToast('error', 'Ingrese el motivo de no autorizacion antes de continuar.', 'Validacion')
      return
    }
    setConfirmFlowAction('no_autorizar')
  }

  const confirmFlow = async () => {
    const action = confirmFlowAction
    setConfirmFlowAction(null)
    if (!action) return

    if (action === 'aprobar') {
      await handleAprobar()
      return
    }
    if (action === 'pagar') {
      await handlePagar()
      return
    }
    await handleAutorizar(false)
  }

  const handleAprobar = async () => {
    setLoading(true)
    try {
      const result = await aprobarLiquidacionAction(liquidacion.id)
      if (!result.success) {
        showToast('error', result.error || 'No se pudo aprobar', 'Error')
        return
      }
      showToast('success', 'Liquidacion aprobada', 'OK')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const handlePagar = async () => {
    setLoading(true)
    try {
      const result = await marcarLiquidacionPagadaAction(liquidacion.id)
      if (!result.success) {
        showToast('error', result.error || 'No se pudo marcar como pagada', 'Error')
        return
      }
      showToast('success', 'Liquidacion marcada como pagada', 'OK')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const rowTotal = (row: LiquidacionJornada) => {
    return getRowBreakdown(row).total
  }

  const openEditSheet = (row: LiquidacionJornada) => {
    setEditingRow({
      ...row,
      turno: row.turno?.trim() || 'general',
      tarea: sanitizeTaskValue(row.tarea),
    })
    setEditingRowError(null)
    setShowEditingAdvancedTarifas(false)
    setSheetOpen(true)
  }

  const updateEditingRow = (patch: Partial<LiquidacionJornada>) => {
    setEditingRow((prev) => (prev ? { ...prev, ...patch } : prev))
    if (editingRowError) {
      setEditingRowError(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Stat cards — siempre visibles */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total sin descuentos</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatMoney(liquidacion.total_sin_descuentos)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Anticipos periodo</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatMoney(liquidacion.control_30_anticipos)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total a percibir</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-blue-600">
            {formatMoney(liquidacion.total_neto)}
          </CardContent>
        </Card>

        {/* QW-3: Progress bar para Control 30% */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Control 30%</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground text-xs">
                {formatMoney(control30Anticipos)} / {formatMoney(control30Limite)}
              </span>
              <span
                className={`font-semibold text-sm ${
                  control30Pct >= 100
                    ? 'text-red-600'
                    : control30Pct >= 70
                      ? 'text-amber-600'
                      : 'text-green-600'
                }`}
              >
                {control30Pct}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  control30Pct >= 100
                    ? 'bg-red-500'
                    : control30Pct >= 70
                      ? 'bg-amber-400'
                      : 'bg-green-500'
                }`}
                style={{ width: `${control30Pct}%` }}
              />
            </div>
            {liquidacion.control_30_superado && (
              <Badge variant="destructive" className="text-xs">
                Superado
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* MM-2: Tabs de secciones */}
      <Tabs defaultValue="control" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="control">Control y Autorización</TabsTrigger>
          <TabsTrigger value="jornadas" className="flex items-center gap-2">
            Detalle de Horas
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 min-w-5">
              {rows.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="anticipos" className="flex items-center gap-2">
            Anticipos
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 min-w-5">
              {cuotasPeriodo.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Control y Autorización */}
        <TabsContent value="control" className="space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle>Estado de flujo</CardTitle>
              <CardDescription>Vista rapida del estado y la siguiente accion recomendada.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-md border bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Estado</p>
                  <Badge variant="outline" className={`mt-2 ${estadoBadgeClass}`}>
                    {estadoLabel}
                  </Badge>
                </div>
                <div className="rounded-md border bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Pago autorizado</p>
                  <Badge variant={liquidacion.pago_autorizado ? 'outline' : 'secondary'} className="mt-2">
                    {liquidacion.pago_autorizado ? 'Si' : 'Pendiente'}
                  </Badge>
                </div>
                <div className="rounded-md border bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Control 30%</p>
                  <p className="mt-2 font-semibold tabular-nums">{control30Pct}%</p>
                </div>
                <div className="rounded-md border bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Siguiente paso</p>
                  <p className="mt-2 text-sm">{nextStep}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Control de liquidación</CardTitle>
              <CardDescription>Campos operativos equivalentes a la planilla principal.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Puesto override</Label>
                <Input
                  value={control.puesto_override}
                  onChange={(e) => setControl((p) => ({ ...p, puesto_override: e.target.value }))}
                />
              </div>
              <div>
                <Label>Puesto para horas extra</Label>
                <p className="text-xs text-muted-foreground mb-1">
                  Si el empleado hizo horas extra en otro rol (ej: almacenista cubriendo de repartidor),
                  seleccionar ese puesto para que las horas adicionales se paguen a su tarifa.
                </p>
                <Select
                  value={control.puesto_hs_extra ?? 'mismo'}
                  onValueChange={(v) =>
                    setControl((p) => ({ ...p, puesto_hs_extra: v === 'mismo' ? null : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Mismo puesto (por defecto)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mismo">Mismo puesto (por defecto)</SelectItem>
                    {puestosDisponibles.map((p) => (
                      <SelectItem key={p.puesto_codigo} value={p.puesto_codigo}>
                        {p.puesto_codigo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Orden de pago</Label>
                <Input
                  type="number"
                  value={control.orden_pago}
                  onChange={(e) => setControl((p) => ({ ...p, orden_pago: toNum(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Días como cajero</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={control.dias_cajero}
                  onChange={(e) => setControl((p) => ({ ...p, dias_cajero: toNum(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Diferencia turno cajero</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={control.diferencia_turno_cajero}
                  onChange={(e) =>
                    setControl((p) => ({ ...p, diferencia_turno_cajero: toNum(e.target.value) }))
                  }
                />
              </div>
              <div className="md:col-span-2">
                <Label>Observaciones</Label>
                <Textarea
                  value={control.observaciones}
                  onChange={(e) => setControl((p) => ({ ...p, observaciones: e.target.value }))}
                />
              </div>

              {/* QW-2: Botones de edición */}
              <div className="md:col-span-2 flex gap-2 flex-wrap pt-1">
                <Button onClick={handleSaveControl} disabled={loading}>
                  Guardar control
                </Button>
                <Button variant="outline" onClick={handleRecalcular} disabled={loading}>
                  Recalcular
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Autorización de pago</CardTitle>
              <CardDescription>Si supera control 30%, requiere autorización manual.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border bg-slate-50 p-3 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={liquidacion.pago_autorizado ? 'outline' : 'secondary'}>
                    {liquidacion.pago_autorizado ? 'Pago autorizado' : 'Autorizacion pendiente'}
                  </Badge>
                  <Button size="sm" onClick={() => handleAutorizar(true)} disabled={loading}>
                    Autorizar
                  </Button>
                  <Button size="sm" variant="outline" onClick={requestNoAutorizar} disabled={loading}>
                    No autorizar
                  </Button>
                </div>
                <div>
                  <Label>Motivo no autorizado</Label>
                  <Textarea
                    value={motivoNoAutorizado}
                    onChange={(e) => setMotivoNoAutorizado(e.target.value)}
                    placeholder="Obligatorio para no autorizar"
                  />
                  {!trimmedMotivoNoAutorizado && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Si decide no autorizar, debe completar este motivo.
                    </p>
                  )}
                </div>
              </div>

              <Separator />
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Acciones de flujo</p>
              <div className="flex gap-2 flex-wrap">
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={requestAprobar}
                  disabled={loading || Boolean(approveBlockedReason)}
                >
                  Aprobar
                </Button>
                <Button
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={requestPagar}
                  disabled={loading || Boolean(payBlockedReason)}
                >
                  Marcar pagada
                </Button>
              </div>
              {approveBlockedReason && <p className="text-xs text-muted-foreground">{approveBlockedReason}</p>}
              {payBlockedReason && <p className="text-xs text-muted-foreground">{payBlockedReason}</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Detalle de Horas — MM-3: Tabla read-only + Sheet */}
        <TabsContent value="jornadas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detalle control hs</CardTitle>
              <CardDescription>
                Haga clic en el ícono de lápiz para editar una jornada. Cada guardado recalcula la
                liquidación.
              </CardDescription>
              {isSucursalEmployee && (
                <p className="text-xs text-muted-foreground">
                  En empleados de sucursal, las hs adicionales son informativas y no impactan el total pagable.
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
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
                          <TableCell className="text-sm max-w-[160px] truncate">{sanitizeTaskValue(row.tarea) || 'Sin tarea cargada'}</TableCell>
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
                </Table>
              </div>

              {/* Formulario nueva fila */}
              <div className="border rounded-md p-4 space-y-4 bg-slate-50/60">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">Agregar jornada manual</p>
                    <p className="text-xs text-muted-foreground">
                      Cargue solo los datos operativos. Las tarifas quedan en opciones avanzadas.
                    </p>
                  </div>
                  {isSucursalEmployee && (
                    <Badge variant="outline" className="text-[11px]">
                      Sucursal: hs adicionales informativas
                    </Badge>
                  )}
                </div>

                {newRowError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {newRowError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                      value={newRowTurnoSelectValue}
                      onValueChange={(value) =>
                        updateNewRow({
                          turno: value === 'otro' ? '' : value,
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
                    <p className="text-[11px] text-muted-foreground">General = jornada normal del dia.</p>
                    {newRowTurnoSelectValue === 'otro' && (
                      <Input
                        placeholder="Escribir turno personalizado"
                        value={newRow.turno}
                        onChange={(e) => updateNewRow({ turno: e.target.value })}
                      />
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tarea</Label>
                    <Input
                      list="tareas-recientes"
                      placeholder="Que tarea realizo"
                      value={newRow.tarea}
                      onChange={(e) => updateNewRow({ tarea: e.target.value })}
                    />
                    <datalist id="tareas-recientes">
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
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Hs mensuales</Label>
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
                      onChange={(e) =>
                        updateNewRow({ turno_especial_unidades: toNum(e.target.value) })
                      }
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

                <div className="rounded-md border bg-white px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Resumen automatico
                  </p>
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Base</p>
                      <p className="font-medium tabular-nums">{formatMoney(newRowBreakdown.base)}</p>
                    </div>
                    <div className={isSucursalEmployee ? 'text-muted-foreground' : ''}>
                      <p className="text-xs">
                        Extra {isSucursalEmployee ? '(informativo)' : ''}
                      </p>
                      <p className="font-medium tabular-nums">{formatMoney(newRowBreakdown.extra)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Especial</p>
                      <p className="font-medium tabular-nums">{formatMoney(newRowBreakdown.especial)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total aplicado</p>
                      <p className="font-semibold tabular-nums">{formatMoney(newRowBreakdown.total)}</p>
                    </div>
                  </div>
                </div>

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
                          onChange={(e) =>
                            updateNewRow({ tarifa_turno_especial: toNum(e.target.value) })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleAddRow} disabled={loading} size="sm">
                    Agregar fila manual
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={loading}
                    onClick={() =>
                      updateNewRow({
                        tarifa_hora_base: liquidacion.valor_hora || 0,
                        tarifa_hora_extra: liquidacion.valor_hora || 0,
                        tarifa_turno_especial: 0,
                      })
                    }
                  >
                    Restaurar tarifas sugeridas
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Anticipos */}
        <TabsContent value="anticipos">
          <Card>
            <CardHeader>
              <CardTitle>Cuotas de anticipos del período</CardTitle>
            </CardHeader>
            <CardContent>
              {cuotasPeriodo.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No hay cuotas aplicadas para este período.
                </p>
              ) : (
                <div className="space-y-2">
                  {cuotasPeriodo.map((cuota) => (
                    <div
                      key={cuota.id}
                      className="flex items-center justify-between border rounded-md p-3"
                    >
                      <div className="text-sm">
                        <span className="font-medium">Cuota #{cuota.nro_cuota}</span>
                        <span className="text-muted-foreground ml-2">
                          — {cuota.plan?.tipo || 'N/A'}
                        </span>
                        {cuota.plan?.descripcion && (
                          <span className="text-muted-foreground ml-1 text-xs">
                            ({cuota.plan.descripcion})
                          </span>
                        )}
                      </div>
                      <div className="font-semibold tabular-nums">{formatMoney(cuota.monto_cuota)}</div>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t text-sm font-semibold">
                    <span>Total anticipos período</span>
                    <span>{formatMoney(cuotasPeriodo.reduce((s, c) => s + (c.monto_cuota ?? 0), 0))}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MM-3: Sheet lateral para edición de jornada */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar Jornada</SheetTitle>
            <SheetDescription>
              Turno general significa jornada normal del dia, sin clasificacion especial.
            </SheetDescription>
          </SheetHeader>

          {editingRow && (
            <div className="mt-6 space-y-4">
              {editingRowError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {editingRowError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 col-span-2">
                  <Label>Fecha</Label>
                  <Input
                    type="date"
                    value={editingRow.fecha?.slice(0, 10) ?? ''}
                    onChange={(e) => updateEditingRow({ fecha: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Turno</Label>
                  <Select
                    value={editingTurnoSelectValue}
                    onValueChange={(value) =>
                      updateEditingRow({
                        turno: value === 'otro' ? '' : value,
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
                  <p className="text-[11px] text-muted-foreground">General = jornada normal del dia.</p>
                  {editingTurnoSelectValue === 'otro' && (
                    <Input
                      value={editingRow.turno || ''}
                      onChange={(e) => updateEditingRow({ turno: e.target.value })}
                      placeholder="Escribir turno personalizado"
                    />
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Tarea</Label>
                  <Input
                    value={editingRow.tarea || ''}
                    onChange={(e) => updateEditingRow({ tarea: e.target.value })}
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
                    onChange={(e) => updateEditingRow({ horas_mensuales: toNum(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Hs adicionales</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingRow.horas_adicionales ?? 0}
                    onChange={(e) => updateEditingRow({ horas_adicionales: toNum(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Turno especial (unidades)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingRow.turno_especial_unidades ?? 0}
                    onChange={(e) => updateEditingRow({ turno_especial_unidades: toNum(e.target.value) })}
                  />
                </div>
              </div>

              <Separator />
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEditingAdvancedTarifas((prev) => !prev)}
                  disabled={loading}
                >
                  {showEditingAdvancedTarifas ? 'Ocultar tarifas avanzadas' : 'Mostrar tarifas avanzadas'}
                </Button>

                {showEditingAdvancedTarifas && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-md border bg-white p-3">
                    <div className="space-y-1">
                      <Label>Tarifa hora base</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editingRow.tarifa_hora_base ?? 0}
                        onChange={(e) => updateEditingRow({ tarifa_hora_base: toNum(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Tarifa hora extra</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editingRow.tarifa_hora_extra ?? 0}
                        onChange={(e) => updateEditingRow({ tarifa_hora_extra: toNum(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Tarifa turno especial</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editingRow.tarifa_turno_especial ?? 0}
                        onChange={(e) => updateEditingRow({ tarifa_turno_especial: toNum(e.target.value) })}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label>Observaciones</Label>
                <Textarea
                  value={editingRow.observaciones || ''}
                  onChange={(e) => updateEditingRow({ observaciones: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="pt-2 border-t text-sm space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Base</span>
                  <span>{formatMoney(editingRowBreakdown?.base)}</span>
                </div>
                <div className={`flex justify-between ${isSucursalEmployee ? 'text-muted-foreground' : ''}`}>
                  <span>Extra {isSucursalEmployee ? '(informativo)' : ''}</span>
                  <span>{formatMoney(editingRowBreakdown?.extra)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Especial</span>
                  <span>{formatMoney(editingRowBreakdown?.especial)}</span>
                </div>
                <div className="flex justify-between font-semibold pt-1">
                  <span>Total jornada aplicada:</span>
                  <span>{formatMoney(editingRowBreakdown?.total)}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => {
                    setRows((prev) =>
                      prev.map((r) => (r.id === editingRow.id ? { ...editingRow } : r)),
                    )
                    void handleSaveRow(editingRow)
                  }}
                  disabled={loading}
                  className="flex-1"
                >
                  Guardar y recalcular
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSheetOpen(false)
                    setEditingRow(null)
                  }}
                  disabled={loading}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(confirmFlowAction)} onOpenChange={(open) => !open && setConfirmFlowAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmFlow()} disabled={loading}>
              {confirmActionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
