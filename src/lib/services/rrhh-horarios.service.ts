import type { HorarioEventoNormalizado } from '@/types/domain.types'

const BUSINESS_TIMEZONE = 'America/Argentina/Buenos_Aires'
const NON_ATTENDANCE_EVENT_TYPES = new Set(['110517'])
const HIK_ATTENDANCE_DEBOUNCE_MINUTES = Math.max(
  0,
  Number(process.env.HIK_ATTENDANCE_DEBOUNCE_MINUTES || '1'),
)

function normalizeIdentity(value: string): string {
  return value.replace(/[^0-9A-Za-z]+/g, '').toUpperCase()
}

function normalizeTimestampValue(value: string | number): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 1e10) return new Date(value).toISOString()
    if (value > 1e9) return new Date(value * 1000).toISOString()
    return String(value)
  }

  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^\d{13}$/.test(trimmed)) return new Date(Number(trimmed)).toISOString()
  if (/^\d{10}$/.test(trimmed)) return new Date(Number(trimmed) * 1000).toISOString()
  return trimmed
}

function getStringValue(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
    // Epoch en milisegundos (API cloud HikConnect devuelve occurTime como número de 13 dígitos)
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (value > 1e10) {
        return new Date(value).toISOString()
      }
      return String(value)
    }
  }
  return null
}

function getTimestampValue(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) {
      return normalizeTimestampValue(value)
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return normalizeTimestampValue(value)
    }
  }
  return null
}

function inferEventType(record: Record<string, unknown>): 'check_in' | 'check_out' | null {
  const direction = record.direction
  if (typeof direction === 'number') {
    if (direction === 0) return 'check_in'
    if (direction === 1) return 'check_out'
  }
  if (typeof direction === 'string') {
    const normalizedDirection = direction.trim().toLowerCase()
    if (normalizedDirection === '0' || normalizedDirection === 'in') return 'check_in'
    if (normalizedDirection === '1' || normalizedDirection === 'out') return 'check_out'
  }

  const signal = getStringValue(record, [
    'eventType',
    'type',
    'attendanceType',
    'inOut',
    'direction',
    'status',
    'eventName',
  ])

  if (!signal) return null

  const normalized = signal.toLowerCase()
  const isIn = /(check[\s_-]?in|entry|entrada|in\b)/.test(normalized)
  const isOut = /(check[\s_-]?out|exit|salida|out\b)/.test(normalized)

  if (isIn && !isOut) return 'check_in'
  if (isOut && !isIn) return 'check_out'
  return null
}

function isAttendanceEvent(record: Record<string, unknown>): boolean {
  const eventType = getStringValue(record, ['eventType'])?.trim()
  if (eventType && NON_ATTENDANCE_EVENT_TYPES.has(eventType)) {
    return false
  }

  const attendanceStatus = getStringValue(record, ['attendanceStatus'])
  if (attendanceStatus) {
    const normalized = attendanceStatus.toLowerCase()
    if (/(check|attendance|entry|exit|in|out|entrada|salida)/.test(normalized)) {
      return true
    }
  }

  return true
}

function inferTimestamp(record: Record<string, unknown>): string | null {
  return getTimestampValue(record, [
    'eventTime',
    'time',
    'timestamp',
    'punchTime',
    'occurTime',
    'authTime',
    'verifyTime',
    'eventDateTime',
    'captureTime',
    'localTime',
    'createdAt',
  ])
}

function inferEmployeeNo(record: Record<string, unknown>): string | null {
  const directCode = getStringValue(record, ['personCode'])
  if (directCode) return directCode

  const personInfo = record.personInfo
  if (personInfo && typeof personInfo === 'object') {
    const person = personInfo as Record<string, unknown>
    const personCode = getStringValue(person, ['personCode', 'employeeNo', 'employeeId', 'personId', 'userId'])
    if (personCode) return personCode

    const baseInfo = (personInfo as Record<string, unknown>).baseInfo
    if (baseInfo && typeof baseInfo === 'object') {
      const code = (baseInfo as Record<string, unknown>).personCode
      if (typeof code === 'string' && code.trim()) {
        return code.trim()
      }
    }
  }

  return getStringValue(record, [
    'employeeNo',
    'employee_id',
    'employeeId',
    'employeeCode',
    'identityNo',
    'idNumber',
    'personId',
    'personNo',
    'jobNo',
    'certificateNo',
    'cardNo',
    'userId',
  ])
}

function parseTimestampMs(value: string): number | null {
  const parsed = new Date(normalizeTimestampValue(value))
  const ms = parsed.getTime()
  return Number.isNaN(ms) ? null : ms
}

function dedupeRapidEvents(events: HorarioEventoNormalizado[]): {
  deduped: HorarioEventoNormalizado[]
  removedCount: number
} {
  if (HIK_ATTENDANCE_DEBOUNCE_MINUTES <= 0 || events.length <= 1) {
    return { deduped: events, removedCount: 0 }
  }

  const debounceMs = HIK_ATTENDANCE_DEBOUNCE_MINUTES * 60 * 1000
  const lastAcceptedByEmployee = new Map<string, number>()
  const deduped: HorarioEventoNormalizado[] = []
  let removedCount = 0

  const sorted = [...events].sort((a, b) => {
    if (a.employee_no !== b.employee_no) {
      return a.employee_no.localeCompare(b.employee_no)
    }
    const aTs = parseTimestampMs(a.timestamp) ?? 0
    const bTs = parseTimestampMs(b.timestamp) ?? 0
    return aTs - bTs
  })

  for (const event of sorted) {
    const currentMs = parseTimestampMs(event.timestamp)
    if (currentMs == null) {
      deduped.push(event)
      continue
    }

    const previousMs = lastAcceptedByEmployee.get(event.employee_no)
    if (
      typeof previousMs === 'number' &&
      currentMs >= previousMs &&
      currentMs - previousMs <= debounceMs
    ) {
      removedCount++
      continue
    }

    lastAcceptedByEmployee.set(event.employee_no, currentMs)
    deduped.push(event)
  }

  return { deduped, removedCount }
}

export function getArgentinaDateRange(baseDate = new Date()): { date: string; start: string; end: string } {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(baseDate)

  return {
    date,
    start: `${date}T00:00:00-03:00`,
    end: `${date}T23:59:59-03:00`,
  }
}

export function normalizeHikAttendanceEvents(events: Record<string, unknown>[]): {
  normalized: HorarioEventoNormalizado[]
  warnings: string[]
} {
  const normalizedRaw: HorarioEventoNormalizado[] = []
  const warnings: string[] = []
  let omittedCount = 0
  let skippedNonAttendance = 0

  events.forEach((event) => {
    if (!isAttendanceEvent(event)) {
      skippedNonAttendance++
      return
    }

    const employeeNoRaw = inferEmployeeNo(event)
    const timestamp = inferTimestamp(event)
    const type = inferEventType(event) || 'check_in'

    if (!employeeNoRaw || !timestamp) {
      omittedCount++
      return
    }

    const employeeNo = normalizeIdentity(employeeNoRaw)
    if (!employeeNo) {
      omittedCount++
      return
    }

    normalizedRaw.push({
      employee_no: employeeNo,
      timestamp,
      type,
      raw: event,
    })
  })

  if (omittedCount > 0) {
    warnings.push(
      `Se omitieron ${omittedCount} eventos por datos incompletos (employeeNo/timestamp).`,
    )
  }
  if (skippedNonAttendance > 0) {
    warnings.push(`Se ignoraron ${skippedNonAttendance} eventos tecnicos no asociados a asistencia RRHH.`)
  }

  const { deduped, removedCount } = dedupeRapidEvents(normalizedRaw)
  if (removedCount > 0) {
    warnings.push(
      `Se ignoraron ${removedCount} marcaciones repetidas dentro de ${HIK_ATTENDANCE_DEBOUNCE_MINUTES} minuto(s).`,
    )
  }

  return { normalized: deduped, warnings }
}

export function timestampToLocalHour(input: string): string {
  const date = new Date(normalizeTimestampValue(input))
  if (Number.isNaN(date.getTime())) return input

  return new Intl.DateTimeFormat('es-AR', {
    timeZone: BUSINESS_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}
