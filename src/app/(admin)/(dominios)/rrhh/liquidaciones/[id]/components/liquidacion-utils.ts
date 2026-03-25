import type { LiquidacionJornada } from '@/types/domain.types'

export const AUSENCIA_OBSERVACION_PREFIX = '[AUSENTE]'

export const TURNO_OPTIONS = [
  { value: 'general', label: 'General (turno habitual)' },
  { value: 'turno_completo', label: 'Turno completo' },
  { value: 'medio_turno_manana', label: 'Medio turno manana' },
  { value: 'medio_turno_tarde', label: 'Medio turno tarde' },
  { value: 'manana', label: 'Manana' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noche', label: 'Noche' },
  { value: 'feriado', label: 'Feriado' },
  { value: 'domingo', label: 'Domingo' },
] as const

export const TASK_TEMPLATES = ['Caja', 'Atencion al cliente', 'Reposicion', 'Reparto', 'Deposito', 'Encargado'] as const

const TURNO_VALUE_SET = new Set<string>(TURNO_OPTIONS.map((opt) => opt.value))

export function toNum(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatMoney(value?: number | null) {
  return `$${(value || 0).toLocaleString()}`
}

export function normalizeTurno(value?: string | null): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function getTurnoSelectValue(value?: string | null): string {
  const normalized = normalizeTurno(value)
  if (!normalized) return 'general'
  return TURNO_VALUE_SET.has(normalized) ? normalized : 'otro'
}

export function getTurnoLabel(value?: string | null): string {
  const normalized = normalizeTurno(value)
  if (!normalized) return 'General'
  const option = TURNO_OPTIONS.find((opt) => opt.value === normalized)
  if (option) {
    return option.label.replace(' (turno habitual)', '')
  }
  return value?.trim() || 'General'
}

export function sanitizeTaskValue(value?: string | null): string {
  const raw = (value || '').trim()
  if (!raw) return ''
  const normalized = raw.toLowerCase()
  if (normalized.includes('sincronizado desde hikconnect') || normalized.includes('sincronizado')) {
    return ''
  }
  return raw
}

export function normalizeOrigen(origen?: string | null): 'hik' | 'asistencia' | 'manual' | 'suspension' {
  const value = (origen || '').toLowerCase().trim()
  if (value.includes('hik')) return 'hik'
  if (value.includes('suspension')) return 'suspension'
  if (value.includes('asistencia') || value.includes('licencia') || value.includes('descanso')) return 'asistencia'
  return 'manual'
}

export function getAutoLicenciaLabel(
  row?: Pick<LiquidacionJornada, 'origen' | 'turno' | 'tarea'> | null,
): string | null {
  if (!row || row.origen !== 'auto_licencia_descanso') return null

  const turno = normalizeTurno(row.turno)
  const tarea = (row.tarea || '').trim().toLowerCase()

  if (turno === 'vacaciones' || tarea.includes('vacaciones')) {
    return 'Vacaciones'
  }

  if (turno === 'descanso' || tarea.includes('descanso')) {
    return 'Descanso programado'
  }

  return 'Licencia'
}

export function isAusenciaObservacion(value?: string | null): boolean {
  return (value || '').trim().toUpperCase().startsWith(AUSENCIA_OBSERVACION_PREFIX)
}

export function buildAusenciaObservacion(motivo: string): string {
  const clean = motivo.trim()
  return clean ? `${AUSENCIA_OBSERVACION_PREFIX} ${clean}` : AUSENCIA_OBSERVACION_PREFIX
}

export function getAusenciaMotivo(value?: string | null): string {
  const raw = (value || '').trim()
  if (!raw) return ''
  if (!isAusenciaObservacion(raw)) return raw
  return raw.slice(AUSENCIA_OBSERVACION_PREFIX.length).trim()
}

export type JornadaCalculoInput = Pick<
  LiquidacionJornada,
  | 'horas_mensuales'
  | 'horas_adicionales'
  | 'horas_extra_aprobadas'
  | 'turno_especial_unidades'
  | 'tarifa_hora_base'
  | 'tarifa_hora_extra'
  | 'tarifa_turno_especial'
>

export function getRowBreakdown(row: JornadaCalculoInput, isSucursalEmployee: boolean) {
  const base = (row.horas_mensuales || 0) * (row.tarifa_hora_base || 0)
  const extra = (row.horas_adicionales || 0) * (row.tarifa_hora_extra || 0)
  const especial = (row.turno_especial_unidades || 0) * (row.tarifa_turno_especial || 0)
  const extraAplicado =
    isSucursalEmployee || row.horas_extra_aprobadas === false
      ? 0
      : extra

  return {
    base,
    extra,
    extraAplicado,
    especial,
    total: base + extraAplicado + especial,
  }
}

export type NewRowDraft = {
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

export function validateJornada(
  row: {
    fecha?: string
    horas_mensuales?: number
    horas_adicionales?: number
    turno_especial_unidades?: number
    tarifa_hora_base?: number
    tarifa_hora_extra?: number
    tarifa_turno_especial?: number
    observaciones?: string | null
  },
  isSucursalEmployee: boolean,
): string | null {
  if (!row.fecha) return 'La fecha es obligatoria.'

  const checks: Array<[string, number]> = [
    ['horas diarias', row.horas_mensuales || 0],
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
  const esAusencia = isAusenciaObservacion(row.observaciones)
  if (unidades <= 0 && !esAusencia) {
    return 'Debe cargar al menos horas diarias, hs adicionales o turno especial mayor a 0.'
  }

  if ((row.horas_mensuales || 0) > 0 && (row.tarifa_hora_base || 0) <= 0) {
    return 'Si carga horas diarias, la tarifa base debe ser mayor a 0.'
  }

  if (!isSucursalEmployee && (row.horas_adicionales || 0) > 0 && (row.tarifa_hora_extra || 0) <= 0) {
    return 'Si carga hs adicionales, la tarifa extra debe ser mayor a 0.'
  }

  if ((row.turno_especial_unidades || 0) > 0 && (row.tarifa_turno_especial || 0) <= 0) {
    return 'Si carga turno especial, la tarifa especial debe ser mayor a 0.'
  }

  return null
}

export function getTurnoEstadoClasses(
  row?: Pick<LiquidacionJornada, 'turno' | 'origen' | 'observaciones'> | null,
): string {
  if (!row) return 'bg-slate-100 text-slate-700 border-slate-200'

  if (normalizeOrigen(row.origen) === 'suspension') {
    return 'bg-rose-50 text-rose-700 border-rose-200'
  }

  if (isAusenciaObservacion(row.observaciones)) {
    return 'bg-red-50 text-red-700 border-red-200'
  }

  const turno = normalizeTurno(row.turno)
  if (turno === 'turno_completo') return 'bg-green-50 text-green-700 border-green-200'
  if (turno.startsWith('medio_turno') || turno === 'manana' || turno === 'tarde') {
    return 'bg-amber-50 text-amber-700 border-amber-200'
  }
  if (turno === 'vacaciones' || turno === 'descanso' || turno === 'feriado' || turno === 'domingo') {
    return 'bg-blue-50 text-blue-700 border-blue-200'
  }
  if (turno === 'noche') return 'bg-indigo-50 text-indigo-700 border-indigo-200'
  return 'bg-slate-100 text-slate-700 border-slate-200'
}

export function getHorasExtraBadgeClasses(options: {
  horasAdicionales?: number | null
  horasExtraAprobadas?: boolean | null
  isSucursalEmployee: boolean
  permiteAprobacion: boolean
}): string {
  if ((options.horasAdicionales || 0) <= 0) return 'bg-slate-100 text-slate-700 border-slate-200'
  if (options.isSucursalEmployee) return 'bg-sky-50 text-sky-700 border-sky-200'
  if (!options.permiteAprobacion || options.horasExtraAprobadas !== false) {
    return 'bg-green-50 text-green-700 border-green-200'
  }
  return 'bg-amber-50 text-amber-700 border-amber-200'
}
