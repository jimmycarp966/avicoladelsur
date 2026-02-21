import type { LiquidacionJornada } from '@/types/domain.types'

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

export function normalizeOrigen(origen?: string | null): 'hik' | 'asistencia' | 'manual' {
  const value = (origen || '').toLowerCase().trim()
  if (value.includes('hik')) return 'hik'
  if (value.includes('asistencia')) return 'asistencia'
  return 'manual'
}

export type JornadaCalculoInput = Pick<
  LiquidacionJornada,
  | 'horas_mensuales'
  | 'horas_adicionales'
  | 'turno_especial_unidades'
  | 'tarifa_hora_base'
  | 'tarifa_hora_extra'
  | 'tarifa_turno_especial'
>

export function getRowBreakdown(row: JornadaCalculoInput, isSucursalEmployee: boolean) {
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
  row: { fecha?: string; horas_mensuales?: number; horas_adicionales?: number; turno_especial_unidades?: number; tarifa_hora_base?: number; tarifa_hora_extra?: number; tarifa_turno_especial?: number },
  isSucursalEmployee: boolean,
): string | null {
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
