import { createAdminClient } from '@/lib/supabase/server'
import {
  fetchHikConnectEvents,
  safeLogHikError,
  validateHikConnectConfig,
} from '@/lib/services/hikconnect.client'
import {
  getArgentinaDateRange,
  normalizeHikAttendanceEvents,
  timestampToLocalHour,
} from '@/lib/services/rrhh-horarios.service'
import {
  applyConfiguredHikMappings,
  loadHikPersonMapConfig,
} from '@/lib/services/hik-mapping.service'

const ARG_TZ = 'America/Argentina/Buenos_Aires'
const MIDDAY_HORA_ARG = Number(process.env.HIK_SPLIT_TURNO_HORA || '14')
const HORA_LIMITE_ENTRADA = process.env.HORA_LIMITE_ENTRADA || '08:00'

export type RrhhLiquidacionAutoRunSource = 'cron' | 'ui_fallback' | 'manual'
export type RrhhLiquidacionAutoRunState = 'success' | 'error' | 'skipped'

export interface RrhhLiquidacionPeriodo {
  mes: number
  anio: number
}

interface SyncSummary {
  dias_procesados: number
  registros_sincronizados: number
  dias_con_error: number
}

interface LiquidacionesSummary {
  empleados_objetivo: number
  liquidaciones_creadas: number
  liquidaciones_recalculadas: number
  liquidaciones_omitidas_estado: number
  errores: number
}

export interface RrhhLiquidacionAutoRunResult {
  run_id?: string
  periodo_mes: number
  periodo_anio: number
  fuente: RrhhLiquidacionAutoRunSource
  estado: RrhhLiquidacionAutoRunState
  started_at: string
  finished_at: string
  mensaje: string
  sync: SyncSummary
  liquidaciones: LiquidacionesSummary
  warnings: string[]
  error?: string
}

interface EmpleadoLookup {
  id: string
  dni: string | null
  cuil: string | null
  legajo: string | null
  nombre: string | null
  apellido: string | null
  usuario?: {
    nombre?: string | null
    apellido?: string | null
  } | null
}

interface HorarioRowMapeado {
  empleado_id: string
  hora_entrada?: string
  hora_salida?: string
  hora_entrada_manana?: string
  hora_salida_manana?: string
  hora_entrada_tarde?: string
  hora_salida_tarde?: string
}

type TurnoAsistencia = 'turno_completo' | 'medio_turno_manana' | 'medio_turno_tarde' | 'general'

interface RunOptions {
  mes?: number
  anio?: number
  source?: RrhhLiquidacionAutoRunSource
  createdBy?: string | null
  forceRun?: boolean
}

interface DailyRowsResult {
  rows: HorarioRowMapeado[]
  warnings: string[]
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function buildDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function getArgentinaDate(baseDate = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ARG_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(baseDate)
}

function getArgentinaYearMonth(baseDate = new Date()): { year: number; month: number } {
  const formatted = getArgentinaDate(baseDate)
  const [yearRaw, monthRaw] = formatted.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return {
      year: baseDate.getUTCFullYear(),
      month: baseDate.getUTCMonth() + 1,
    }
  }

  return { year, month }
}

function getArgentinaTodayParts(baseDate = new Date()): { year: number; month: number; day: number } {
  const formatted = getArgentinaDate(baseDate)
  const [yearRaw, monthRaw, dayRaw] = formatted.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    const fallback = baseDate
    return {
      year: fallback.getFullYear(),
      month: fallback.getMonth() + 1,
      day: fallback.getDate(),
    }
  }

  return { year, month, day }
}

function getMonthLastDay(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function normalizeIdentity(value: string): string {
  return value.replace(/[^0-9A-Za-z]+/g, '').toUpperCase()
}

function digitsOnly(value: string): string {
  return value.replace(/\D+/g, '')
}

function normalizePersonName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^0-9A-Za-z ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  return typeof value === 'string' ? value.trim() : ''
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

function extractHikPersonName(raw: Record<string, unknown>): string | undefined {
  const direct =
    readString(raw, 'personName') ||
    readString(raw, 'name') ||
    readString(raw, 'employeeName') ||
    readString(raw, 'userName')

  if (direct) return direct

  const personInfo = raw.personInfo
  if (!personInfo || typeof personInfo !== 'object') return undefined
  const person = personInfo as Record<string, unknown>

  const personName = readString(person, 'personName') || readString(person, 'name')
  if (personName) return personName

  const baseInfo = person.baseInfo
  if (!baseInfo || typeof baseInfo !== 'object') return undefined
  const base = baseInfo as Record<string, unknown>

  const full = readString(base, 'personName') || readString(base, 'name')
  if (full) return full

  const first = readString(base, 'firstName')
  const last = readString(base, 'lastName')
  const composed = `${first} ${last}`.trim()
  return composed || undefined
}

function extractRawEventTimestamp(raw: Record<string, unknown>): string | undefined {
  const candidates = [
    'occurTime',
    'eventTime',
    'time',
    'timestamp',
    'punchTime',
    'recordTime',
    'deviceTime',
    'authTime',
    'verifyTime',
    'eventDateTime',
    'captureTime',
    'localTime',
    'createdAt',
  ]

  for (const key of candidates) {
    const value = raw[key]
    if (typeof value === 'string' && value.trim()) return normalizeTimestampValue(value)
    if (typeof value === 'number' && Number.isFinite(value)) {
      return normalizeTimestampValue(value)
    }
  }

  return undefined
}

function isTimestampOnBusinessDate(timestamp: string, date: string): boolean {
  const parsed = new Date(normalizeTimestampValue(timestamp))
  if (Number.isNaN(parsed.getTime())) return false
  const eventDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: ARG_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed)
  return eventDate === date
}

function getHoraArgentina(date: Date): number {
  return parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: ARG_TZ,
      hour: 'numeric',
      hour12: false,
    }).format(date),
    10,
  )
}

function splitTurnos(sortedTimes: Date[]): { manana: Date[]; tarde: Date[] } {
  const manana: Date[] = []
  const tarde: Date[] = []

  for (const ts of sortedTimes) {
    const hora = getHoraArgentina(ts)
    if (hora < MIDDAY_HORA_ARG) manana.push(ts)
    else tarde.push(ts)
  }

  return { manana, tarde }
}

function findEmployeeByPartialName(
  hikNameKey: string,
  employeeByName: Map<string, EmpleadoLookup>,
): EmpleadoLookup | undefined {
  if (!hikNameKey) return undefined
  const hikWords = new Set(hikNameKey.split(' ').filter(Boolean))
  let bestMatch: EmpleadoLookup | undefined
  let bestScore = 0

  for (const [dbName, emp] of employeeByName.entries()) {
    const dbWords = dbName.split(' ').filter(Boolean)
    if (dbWords.length === 0) continue
    const matched = dbWords.filter((w) => hikWords.has(w)).length
    const score = matched / dbWords.length
    if (score === 1 && matched > bestScore) {
      bestScore = matched
      bestMatch = emp
    }
  }

  return bestMatch
}

function calcularEstadoYRetraso(horaEntrada: string | undefined): {
  estado: 'presente' | 'tarde'
  retraso_minutos: number
} {
  if (!horaEntrada) return { estado: 'presente', retraso_minutos: 0 }

  const [limH, limM] = HORA_LIMITE_ENTRADA.split(':').map(Number)
  const [entH, entM] = horaEntrada.split(':').map(Number)
  if (Number.isNaN(limH) || Number.isNaN(limM) || Number.isNaN(entH) || Number.isNaN(entM)) {
    return { estado: 'presente', retraso_minutos: 0 }
  }

  const limiteMin = limH * 60 + limM
  const entradaMin = entH * 60 + entM
  const diferencia = entradaMin - limiteMin

  if (diferencia <= 0) return { estado: 'presente', retraso_minutos: 0 }
  return { estado: 'tarde', retraso_minutos: diferencia }
}

function calcHoras(entTs: string | null, salTs: string | null): number {
  if (!entTs || !salTs) return 0
  const e = new Date(entTs)
  const s = new Date(salTs)
  if (Number.isNaN(e.getTime()) || Number.isNaN(s.getTime())) return 0
  return (s.getTime() - e.getTime()) / 3600000
}

function inferTurnoAsistencia(
  horaEntradaManana: string | null,
  horaSalidaManana: string | null,
  horaEntradaTarde: string | null,
  horaSalidaTarde: string | null,
): TurnoAsistencia {
  const tieneManana = Boolean(horaEntradaManana && horaSalidaManana)
  const tieneTarde = Boolean(horaEntradaTarde && horaSalidaTarde)

  if (tieneManana && tieneTarde) return 'turno_completo'
  if (tieneManana) return 'medio_turno_manana'
  if (tieneTarde) return 'medio_turno_tarde'
  return 'general'
}

function isMissingRunsTableError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message || '').toLowerCase()
  const code = String((error as { code?: string })?.code || '')
  return code === '42P01' || message.includes('rrhh_liquidacion_runs')
}

function isUniqueViolation(error: unknown): boolean {
  return String((error as { code?: string })?.code || '') === '23505'
}

function emptySyncSummary(): SyncSummary {
  return {
    dias_procesados: 0,
    registros_sincronizados: 0,
    dias_con_error: 0,
  }
}

function emptyLiquidacionesSummary(): LiquidacionesSummary {
  return {
    empleados_objetivo: 0,
    liquidaciones_creadas: 0,
    liquidaciones_recalculadas: 0,
    liquidaciones_omitidas_estado: 0,
    errores: 0,
  }
}

async function getEmployeeMaps(adminSupabase: ReturnType<typeof createAdminClient>): Promise<{
  employeeMap: Map<string, EmpleadoLookup>
  employeeById: Map<string, EmpleadoLookup>
  employeeByName: Map<string, EmpleadoLookup>
}> {
  const { data: empleados, error } = await adminSupabase
    .from('rrhh_empleados')
    .select('id, dni, cuil, legajo, nombre, apellido, usuario:usuarios(nombre, apellido)')
    .eq('activo', true)

  if (error) {
    throw new Error(`No se pudieron cargar empleados RRHH para sync Hik: ${error.message}`)
  }

  const employeeMap = new Map<string, EmpleadoLookup>()
  const employeeById = new Map<string, EmpleadoLookup>()
  const employeeByName = new Map<string, EmpleadoLookup>()

  for (const empleado of (empleados || []) as EmpleadoLookup[]) {
    employeeById.set(empleado.id, empleado)

    const fullName = `${empleado.nombre || ''} ${empleado.apellido || ''}`.trim()
    if (fullName) {
      employeeByName.set(normalizePersonName(fullName), empleado)
      const reverseName = `${empleado.apellido || ''} ${empleado.nombre || ''}`.trim()
      if (reverseName) employeeByName.set(normalizePersonName(reverseName), empleado)
    }

    const keys = [
      empleado.dni ? normalizeIdentity(empleado.dni) : '',
      empleado.cuil ? normalizeIdentity(empleado.cuil) : '',
      empleado.legajo ? normalizeIdentity(empleado.legajo) : '',
      empleado.id ? normalizeIdentity(empleado.id) : '',
    ].filter(Boolean)

    for (const key of keys) {
      employeeMap.set(key, empleado)
      const keyDigits = digitsOnly(key)
      if (keyDigits) employeeMap.set(keyDigits, empleado)
    }
  }

  const hikMapConfig = await loadHikPersonMapConfig({ adminSupabase })
  const { unresolvedCount } = applyConfiguredHikMappings({
    configuredMap: hikMapConfig.map,
    employeeMap,
    employeeById,
  })

  if (hikMapConfig.warnings.length > 0) {
    for (const warning of hikMapConfig.warnings) {
      devError('[RRHH AUTO LIQ][HIK MAP]', warning)
    }
  }
  if (unresolvedCount > 0) {
    devError(
      `[RRHH AUTO LIQ][HIK MAP] Quedaron ${unresolvedCount}/${hikMapConfig.map.size} codigos sin resolver.`,
    )
  }

  return { employeeMap, employeeById, employeeByName }
}

function buildDailyRows(
  events: Array<{ employee_no: string; timestamp: string; raw: Record<string, unknown> }>,
  employeeMap: Map<string, EmpleadoLookup>,
  employeeByName: Map<string, EmpleadoLookup>,
): DailyRowsResult {
  const grouped = new Map<string, { employeeNo: string; timestamps: string[]; hikName?: string }>()
  const warnings: string[] = []

  for (const event of events) {
    const key = event.employee_no
    const current = grouped.get(key) || {
      employeeNo: key,
      timestamps: [],
      hikName: undefined,
    }
    current.timestamps.push(event.timestamp)
    if (!current.hikName && event.raw && typeof event.raw === 'object') {
      current.hikName = extractHikPersonName(event.raw)
    }
    grouped.set(key, current)
  }

  const rows: HorarioRowMapeado[] = []
  let sinMapeoCount = 0

  for (const row of grouped.values()) {
    const employeeNoKey = normalizeIdentity(row.employeeNo)
    const employeeNoDigits = digitsOnly(row.employeeNo)
    const hikNameKey = row.hikName ? normalizePersonName(row.hikName) : ''
    const empleado =
      employeeMap.get(employeeNoKey) ||
      (employeeNoDigits ? employeeMap.get(employeeNoDigits) : undefined) ||
      (hikNameKey ? employeeByName.get(hikNameKey) : undefined) ||
      findEmployeeByPartialName(hikNameKey, employeeByName)

    if (!empleado?.id) {
      sinMapeoCount++
      continue
    }

    const sortedTimes = row.timestamps
      .map((ts) => new Date(ts))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())

    if (sortedTimes.length === 0) continue

    const { manana, tarde } = splitTurnos(sortedTimes)

    const horaEntradaManana = manana[0] ? timestampToLocalHour(manana[0].toISOString()) : undefined
    const horaSalidaManana =
      manana.length > 1 ? timestampToLocalHour(manana[manana.length - 1].toISOString()) : undefined
    const horaEntradaTarde = tarde[0] ? timestampToLocalHour(tarde[0].toISOString()) : undefined
    const horaSalidaTarde =
      tarde.length > 1 ? timestampToLocalHour(tarde[tarde.length - 1].toISOString()) : undefined

    const first = sortedTimes[0]
    const last = sortedTimes[sortedTimes.length - 1]
    const hasDistinctOut = first && last && first.getTime() !== last.getTime()

    rows.push({
      empleado_id: empleado.id,
      hora_entrada: first ? timestampToLocalHour(first.toISOString()) : undefined,
      hora_salida: hasDistinctOut ? timestampToLocalHour(last.toISOString()) : undefined,
      hora_entrada_manana: horaEntradaManana,
      hora_salida_manana: horaSalidaManana,
      hora_entrada_tarde: horaEntradaTarde,
      hora_salida_tarde: horaSalidaTarde,
    })
  }

  if (sinMapeoCount > 0) {
    warnings.push(`${sinMapeoCount} marcaciones Hik quedaron sin mapear a rrhh_empleados.`)
  }

  return { rows, warnings }
}

async function sincronizarAsistenciaDia(
  adminSupabase: ReturnType<typeof createAdminClient>,
  fecha: string,
  rows: HorarioRowMapeado[],
): Promise<{ sincronizados: number; errores: number }> {
  if (rows.length === 0) return { sincronizados: 0, errores: 0 }

  const empleadoIds = rows.map((r) => r.empleado_id)
  const { data: existentes } = await adminSupabase
    .from('rrhh_asistencia')
    .select('empleado_id, observaciones')
    .in('empleado_id', empleadoIds)
    .eq('fecha', fecha)

  const manualesSet = new Set<string>()
  for (const reg of existentes || []) {
    const obs = String(reg.observaciones || '').toLowerCase()
    if (obs && !obs.includes('hikconnect') && !obs.includes('hik-connect')) {
      manualesSet.add(reg.empleado_id as string)
    }
  }

  let sincronizados = 0
  let errores = 0

  for (const registro of rows) {
    if (manualesSet.has(registro.empleado_id)) continue

    const { estado, retraso_minutos } = calcularEstadoYRetraso(registro.hora_entrada)

    const horaEntradaTs = registro.hora_entrada ? `${fecha}T${registro.hora_entrada}:00-03:00` : null
    const horaSalidaTs = registro.hora_salida ? `${fecha}T${registro.hora_salida}:00-03:00` : null

    const horaEntradaMTs = registro.hora_entrada_manana
      ? `${fecha}T${registro.hora_entrada_manana}:00-03:00`
      : null
    const horaSalidaMTs = registro.hora_salida_manana
      ? `${fecha}T${registro.hora_salida_manana}:00-03:00`
      : null
    const horaEntradaTTs = registro.hora_entrada_tarde
      ? `${fecha}T${registro.hora_entrada_tarde}:00-03:00`
      : null
    const horaSalidaTTs = registro.hora_salida_tarde
      ? `${fecha}T${registro.hora_salida_tarde}:00-03:00`
      : null

    let horasTrabajadas: number | null = null
    const tieneDosTurnos = horaEntradaMTs && horaSalidaMTs && horaEntradaTTs && horaSalidaTTs
    const turno = inferTurnoAsistencia(horaEntradaMTs, horaSalidaMTs, horaEntradaTTs, horaSalidaTTs)

    if (tieneDosTurnos) {
      const hManana = calcHoras(horaEntradaMTs, horaSalidaMTs)
      const hTarde = calcHoras(horaEntradaTTs, horaSalidaTTs)
      horasTrabajadas = Math.round((hManana + hTarde) * 100) / 100
    } else if (horaEntradaTs && horaSalidaTs) {
      horasTrabajadas = Math.round(calcHoras(horaEntradaTs, horaSalidaTs) * 100) / 100
    }

    const { error } = await adminSupabase
      .from('rrhh_asistencia')
      .upsert(
        {
          empleado_id: registro.empleado_id,
          fecha,
          hora_entrada: horaEntradaTs,
          hora_salida: horaSalidaTs,
          horas_trabajadas: horasTrabajadas,
          turno,
          estado,
          retraso_minutos,
          observaciones: 'Sincronizado desde HikConnect',
        },
        { onConflict: 'empleado_id,fecha' },
      )

    if (error) {
      errores++
      console.error('[RRHH AUTO LIQ] Error sincronizando asistencia:', {
        fecha,
        empleado_id: registro.empleado_id,
        error: error.message,
      })
    } else {
      sincronizados++
    }
  }

  return { sincronizados, errores }
}

async function sincronizarMesRelojAsistencia(
  adminSupabase: ReturnType<typeof createAdminClient>,
  periodo: RrhhLiquidacionPeriodo,
  warnings: string[],
): Promise<SyncSummary> {
  const missingConfig = validateHikConnectConfig()
  if (missingConfig.length > 0) {
    throw new Error(`Faltan variables Hik-Connect: ${missingConfig.join(', ')}`)
  }

  const { employeeMap, employeeByName } = await getEmployeeMaps(adminSupabase)

  const lastDay = getMonthLastDay(periodo.anio, periodo.mes)
  const todayArgentina = getArgentinaTodayParts()
  const isCurrentArgentinaMonth = todayArgentina.year === periodo.anio && todayArgentina.month === periodo.mes
  const maxDay = isCurrentArgentinaMonth ? Math.min(lastDay, todayArgentina.day) : lastDay
  const summary: SyncSummary = {
    dias_procesados: 0,
    registros_sincronizados: 0,
    dias_con_error: 0,
  }

  for (let dia = 1; dia <= maxDay; dia++) {
    const fechaStr = buildDate(periodo.anio, periodo.mes, dia)
    try {
      const baseDate = new Date(`${fechaStr}T12:00:00-03:00`)
      const range = getArgentinaDateRange(baseDate)

      const hikResponse = await fetchHikConnectEvents({
        startTime: range.start,
        endTime: range.end,
        date: range.date,
        pageNo: 1,
        pageSize: 200,
      })

      const rawEventsForDate = hikResponse.events.filter((event) => {
        if (!event || typeof event !== 'object') return false
        const raw = event as Record<string, unknown>
        const timestamp = extractRawEventTimestamp(raw)
        if (!timestamp) return false
        return isTimestampOnBusinessDate(timestamp, range.date)
      })

      if (rawEventsForDate.length === 0) {
        summary.dias_procesados++
        continue
      }

      const normalizedResult = normalizeHikAttendanceEvents(rawEventsForDate)
      warnings.push(...normalizedResult.warnings)

      const dailyRows = buildDailyRows(
        normalizedResult.normalized.map((item) => ({
          employee_no: item.employee_no,
          timestamp: item.timestamp,
          raw: item.raw as Record<string, unknown>,
        })),
        employeeMap,
        employeeByName,
      )
      warnings.push(...dailyRows.warnings)

      const syncResult = await sincronizarAsistenciaDia(adminSupabase, range.date, dailyRows.rows)
      summary.registros_sincronizados += syncResult.sincronizados
      if (syncResult.errores > 0) summary.dias_con_error++

      summary.dias_procesados++
    } catch (error) {
      summary.dias_con_error++
      console.error('[RRHH AUTO LIQ] Error sincronizando dia Hik->Asistencia:', {
        fecha: fechaStr,
        error: error instanceof Error ? error.message : 'Error desconocido',
      })
      safeLogHikError(error)
    }
  }

  return summary
}

async function getEmpleadosObjetivo(
  adminSupabase: ReturnType<typeof createAdminClient>,
  periodo: RrhhLiquidacionPeriodo,
): Promise<string[]> {
  const lastDay = getMonthLastDay(periodo.anio, periodo.mes)
  const fromDate = buildDate(periodo.anio, periodo.mes, 1)
  const toDate = buildDate(periodo.anio, periodo.mes, lastDay)

  const { data: asistenciaRows, error: asistenciaError } = await adminSupabase
    .from('rrhh_asistencia')
    .select('empleado_id')
    .gte('fecha', fromDate)
    .lte('fecha', toDate)
    .in('estado', ['presente', 'tarde'])

  if (asistenciaError) {
    throw new Error(`No se pudo leer asistencia del periodo: ${asistenciaError.message}`)
  }

  const candidatos = Array.from(
    new Set((asistenciaRows || []).map((row) => String(row.empleado_id || '')).filter(Boolean)),
  )
  if (candidatos.length === 0) return []

  const { data: empleadosActivos, error: empleadosError } = await adminSupabase
    .from('rrhh_empleados')
    .select('id')
    .eq('activo', true)
    .in('id', candidatos)

  if (empleadosError) {
    throw new Error(`No se pudo leer empleados activos RRHH: ${empleadosError.message}`)
  }

  return (empleadosActivos || []).map((row) => String(row.id))
}

function chunkArray<T>(input: T[], size: number): T[][] {
  if (size <= 0) return [input]
  const output: T[][] = []
  for (let i = 0; i < input.length; i += size) {
    output.push(input.slice(i, i + size))
  }
  return output
}

async function procesarLiquidacionesPeriodo(
  adminSupabase: ReturnType<typeof createAdminClient>,
  periodo: RrhhLiquidacionPeriodo,
  empleadoIds: string[],
  createdBy: string | null,
): Promise<LiquidacionesSummary> {
  const summary = emptyLiquidacionesSummary()
  summary.empleados_objetivo = empleadoIds.length
  if (empleadoIds.length === 0) return summary

  const existentesMap = new Map<string, { id: string; estado: string }>()

  for (const chunk of chunkArray(empleadoIds, 200)) {
    const { data: existentes, error: existentesError } = await adminSupabase
      .from('rrhh_liquidaciones')
      .select('id, empleado_id, estado')
      .eq('periodo_mes', periodo.mes)
      .eq('periodo_anio', periodo.anio)
      .in('empleado_id', chunk)

    if (existentesError) {
      throw new Error(`No se pudieron leer liquidaciones existentes: ${existentesError.message}`)
    }

    for (const row of existentes || []) {
      existentesMap.set(String(row.empleado_id), {
        id: String(row.id),
        estado: String(row.estado || ''),
      })
    }
  }

  for (const empleadoId of empleadoIds) {
    const existente = existentesMap.get(empleadoId)
    if (existente && (existente.estado === 'aprobada' || existente.estado === 'pagada')) {
      summary.liquidaciones_omitidas_estado++
      continue
    }

    const rpcArgs = {
      p_empleado_id: empleadoId,
      p_mes: periodo.mes,
      p_anio: periodo.anio,
      p_created_by: createdBy,
    }

    let { error: rpcError } = await adminSupabase.rpc('fn_rrhh_preparar_liquidacion_mensual', rpcArgs)
    if (rpcError && String(rpcError.message || '').toLowerCase().includes('fn_rrhh_preparar_liquidacion_mensual')) {
      const legacy = await adminSupabase.rpc('fn_calcular_liquidacion_mensual', rpcArgs)
      rpcError = legacy.error
    }

    if (rpcError) {
      summary.errores++
      console.error('[RRHH AUTO LIQ] Error preparando liquidacion:', {
        empleado_id: empleadoId,
        periodo_mes: periodo.mes,
        periodo_anio: periodo.anio,
        error: rpcError.message,
      })
      continue
    }

    if (existente) summary.liquidaciones_recalculadas++
    else summary.liquidaciones_creadas++
  }

  return summary
}

export function resolverPeriodoMesVencido(baseDate = new Date()): RrhhLiquidacionPeriodo {
  const { year, month } = getArgentinaYearMonth(baseDate)
  if (month === 1) return { mes: 12, anio: year - 1 }
  return { mes: month - 1, anio: year }
}

export async function esPeriodoPendiente(
  periodo: RrhhLiquidacionPeriodo,
  adminSupabaseParam?: ReturnType<typeof createAdminClient>,
): Promise<boolean> {
  const adminSupabase = adminSupabaseParam || createAdminClient()
  const { data, error } = await adminSupabase
    .from('rrhh_liquidacion_runs')
    .select('id, estado')
    .eq('periodo_mes', periodo.mes)
    .eq('periodo_anio', periodo.anio)
    .in('estado', ['success', 'running'])
    .order('iniciado_at', { ascending: false })
    .limit(1)

  if (error) {
    if (isMissingRunsTableError(error)) return true
    throw new Error(`No se pudo verificar estado de corridas automáticas: ${error.message}`)
  }

  return (data || []).length === 0
}

export async function ejecutarLiquidacionAutomatica(
  options: RunOptions = {},
): Promise<RrhhLiquidacionAutoRunResult> {
  const startedAt = new Date().toISOString()
  const source = options.source || 'manual'
  const warnings: string[] = []
  const adminSupabase = createAdminClient()

  const hasMes = typeof options.mes === 'number'
  const hasAnio = typeof options.anio === 'number'

  let periodo: RrhhLiquidacionPeriodo
  if (hasMes && hasAnio) {
    periodo = { mes: options.mes as number, anio: options.anio as number }
  } else if (!hasMes && !hasAnio) {
    periodo = resolverPeriodoMesVencido()
  } else {
    const finishedAt = new Date().toISOString()
    return {
      periodo_mes: 0,
      periodo_anio: 0,
      fuente: source,
      estado: 'error',
      started_at: startedAt,
      finished_at: finishedAt,
      mensaje: 'Parámetros inválidos: mes y año deben enviarse juntos.',
      sync: emptySyncSummary(),
      liquidaciones: emptyLiquidacionesSummary(),
      warnings,
      error: 'Parámetros inválidos',
    }
  }

  if (!Number.isInteger(periodo.mes) || periodo.mes < 1 || periodo.mes > 12 || !Number.isInteger(periodo.anio)) {
    const finishedAt = new Date().toISOString()
    return {
      periodo_mes: periodo.mes,
      periodo_anio: periodo.anio,
      fuente: source,
      estado: 'error',
      started_at: startedAt,
      finished_at: finishedAt,
      mensaje: 'Período inválido para liquidación automática.',
      sync: emptySyncSummary(),
      liquidaciones: emptyLiquidacionesSummary(),
      warnings,
      error: 'Periodo inválido',
    }
  }

  console.log('[RRHH AUTO LIQ] Inicio de corrida', {
    fuente: source,
    periodo_mes: periodo.mes,
    periodo_anio: periodo.anio,
    started_at: startedAt,
  })

  if (!options.forceRun) {
    try {
      const pendiente = await esPeriodoPendiente(periodo, adminSupabase)
      if (!pendiente) {
        const finishedAt = new Date().toISOString()
        return {
          periodo_mes: periodo.mes,
          periodo_anio: periodo.anio,
          fuente: source,
          estado: 'skipped',
          started_at: startedAt,
          finished_at: finishedAt,
          mensaje: 'El período ya fue procesado o está en ejecución.',
          sync: emptySyncSummary(),
          liquidaciones: emptyLiquidacionesSummary(),
          warnings,
        }
      }
    } catch (error) {
      warnings.push(
        `No se pudo verificar estado de corridas. Se continúa por compatibilidad: ${
          error instanceof Error ? error.message : 'Error desconocido'
        }`,
      )
    }
  }

  let runId: string | undefined
  try {
    const { data: runRow, error: runInsertError } = await adminSupabase
      .from('rrhh_liquidacion_runs')
      .insert({
        periodo_mes: periodo.mes,
        periodo_anio: periodo.anio,
        fuente: source,
        estado: 'running',
        iniciado_at: startedAt,
      })
      .select('id')
      .single()

    if (runInsertError) {
      if (isMissingRunsTableError(runInsertError)) {
        warnings.push('Tabla rrhh_liquidacion_runs no disponible. Se ejecuta sin trazabilidad persistida.')
      } else if (isUniqueViolation(runInsertError)) {
        const finishedAt = new Date().toISOString()
        return {
          periodo_mes: periodo.mes,
          periodo_anio: periodo.anio,
          fuente: source,
          estado: 'skipped',
          started_at: startedAt,
          finished_at: finishedAt,
          mensaje: 'Corrida automática ya registrada para este período/fuente.',
          sync: emptySyncSummary(),
          liquidaciones: emptyLiquidacionesSummary(),
          warnings,
        }
      } else {
        throw new Error(`No se pudo crear la corrida automática: ${runInsertError.message}`)
      }
    } else {
      runId = String(runRow.id)
    }
  } catch (error) {
    warnings.push(
      `No se pudo registrar inicio en rrhh_liquidacion_runs: ${
        error instanceof Error ? error.message : 'Error desconocido'
      }`,
    )
  }

  let syncSummary = emptySyncSummary()
  let liquidacionesSummary = emptyLiquidacionesSummary()

  try {
    syncSummary = await sincronizarMesRelojAsistencia(adminSupabase, periodo, warnings)
    const empleadosObjetivo = await getEmpleadosObjetivo(adminSupabase, periodo)
    liquidacionesSummary = await procesarLiquidacionesPeriodo(
      adminSupabase,
      periodo,
      empleadosObjetivo,
      options.createdBy ?? null,
    )

    const finishedAt = new Date().toISOString()
    const result: RrhhLiquidacionAutoRunResult = {
      run_id: runId,
      periodo_mes: periodo.mes,
      periodo_anio: periodo.anio,
      fuente: source,
      estado: 'success',
      started_at: startedAt,
      finished_at: finishedAt,
      mensaje: `Corrida completada. Sync ${syncSummary.registros_sincronizados} registros; ${liquidacionesSummary.liquidaciones_creadas} creadas, ${liquidacionesSummary.liquidaciones_recalculadas} recalculadas.`,
      sync: syncSummary,
      liquidaciones: liquidacionesSummary,
      warnings,
    }

    if (runId) {
      await adminSupabase
        .from('rrhh_liquidacion_runs')
        .update({
          estado: 'success',
          finalizado_at: finishedAt,
          resumen_json: result,
          error: null,
          updated_at: finishedAt,
        })
        .eq('id', runId)
    }

    console.log('[RRHH AUTO LIQ] Corrida finalizada OK', {
      run_id: runId,
      periodo_mes: periodo.mes,
      periodo_anio: periodo.anio,
      liquidaciones: liquidacionesSummary,
      sync: syncSummary,
    })

    return result
  } catch (error) {
    const finishedAt = new Date().toISOString()
    const errorMessage = error instanceof Error ? error.message : 'Error interno'
    const result: RrhhLiquidacionAutoRunResult = {
      run_id: runId,
      periodo_mes: periodo.mes,
      periodo_anio: periodo.anio,
      fuente: source,
      estado: 'error',
      started_at: startedAt,
      finished_at: finishedAt,
      mensaje: 'Corrida automática finalizada con error.',
      sync: syncSummary,
      liquidaciones: liquidacionesSummary,
      warnings,
      error: errorMessage,
    }

    if (runId) {
      await adminSupabase
        .from('rrhh_liquidacion_runs')
        .update({
          estado: 'error',
          finalizado_at: finishedAt,
          resumen_json: result,
          error: errorMessage,
          updated_at: finishedAt,
        })
        .eq('id', runId)
    }

    console.error('[RRHH AUTO LIQ] Corrida finalizada con error', {
      run_id: runId,
      periodo_mes: periodo.mes,
      periodo_anio: periodo.anio,
      error: errorMessage,
    })

    return result
  }
}
