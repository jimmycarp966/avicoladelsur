'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { devError } from '@/lib/utils/logger'
import type { ApiResponse } from '@/types/api.types'
import type { HorariosHoyData, HorarioEventoNormalizado } from '@/types/domain.types'
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
  normalizeHikNameReference,
} from '@/lib/services/hik-mapping.service'

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

type TurnoAsistencia = 'turno_completo' | 'medio_turno_manana' | 'medio_turno_tarde' | 'general'
type EstadoHorarioConsolidado = 'presente' | 'ausente' | 'vacaciones' | 'enfermedad'

interface AsistenciaLookup {
  empleado_id: string
  estado: 'presente' | 'ausente' | 'tarde' | 'licencia'
  retraso_minutos?: number | null
  hora_entrada?: string | null
  hora_salida?: string | null
}

interface LicenciaLookup {
  empleado_id: string
  tipo: 'vacaciones' | 'enfermedad' | 'maternidad' | 'estudio' | 'otro' | 'descanso_programado'
  observaciones?: string | null
  fecha_inicio: string
  fecha_fin: string
}

function getTodayArgentina(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function normalizeIdentity(value: string): string {
  return value.replace(/[^0-9A-Za-z]+/g, '').toUpperCase()
}

function digitsOnly(value: string): string {
  return value.replace(/\D+/g, '')
}

function normalizePersonName(value: string): string {
  return normalizeHikNameReference(value)
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

  if (typeof value !== 'string') {
    return String(value)
  }

  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^\d{13}$/.test(trimmed)) return new Date(Number(trimmed)).toISOString()
  if (/^\d{10}$/.test(trimmed)) return new Date(Number(trimmed) * 1000).toISOString()
  return trimmed
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
    // API cloud HikConnect devuelve occurTime como epoch en milisegundos (número de 13 dígitos, UTC)
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
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed)
  return eventDate === date
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

async function checkAdmin(supabase: SupabaseClient): Promise<boolean> {
  const { data: authResult, error: authError } = await supabase.auth.getUser()
  if (authError || !authResult.user) return false

  const { data: userData, error: userError } = await supabase
    .from('usuarios')
    .select('rol, activo')
    .eq('id', authResult.user.id)
    .single()

  if (userError || !userData) return false
  return userData.activo && userData.rol === 'admin'
}

// Hora corte mañana/tarde (Argentina). Marcaciones antes de este horario = turno mañana.
// Configurable via HIK_SPLIT_TURNO_HORA (default 14 para reflejar entradas de tarde desde 14:00)
const MIDDAY_HORA_ARG = Number(process.env.HIK_SPLIT_TURNO_HORA || '14')

function getHoraArgentina(date: Date): number {
  return parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Argentina/Buenos_Aires',
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
    if (hora < MIDDAY_HORA_ARG) {
      manana.push(ts)
    } else {
      tarde.push(ts)
    }
  }
  return { manana, tarde }
}

/**
 * Busca empleado por nombre parcial: todos los tokens del nombre DB
 * deben estar presentes en el nombre Hik (maneja segundos nombres).
 * Ej: "Irma Zelaya" (DB) matchea "Irma Rosa Zelaya" (Hik).
 */
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
    const matched = dbWords.filter(w => hikWords.has(w)).length
    const score = matched / dbWords.length
    // Todos los tokens del nombre DB deben aparecer en el nombre Hik
    if (score === 1 && matched > bestScore) {
      bestScore = matched
      bestMatch = emp
    }
  }
  return bestMatch
}

function formatEmpleadoNombre(empleado?: EmpleadoLookup | null): string {
  return `${empleado?.usuario?.nombre || empleado?.nombre || ''} ${empleado?.usuario?.apellido || empleado?.apellido || ''}`.trim()
}

function normalizeHourFromAsistencia(value?: string | null): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (/^\d{2}:\d{2}$/.test(trimmed)) return trimmed

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return undefined
  return timestampToLocalHour(parsed.toISOString())
}

function hasAnyMarcacion(row?: HorariosHoyData['registros'][number], asistencia?: AsistenciaLookup): boolean {
  return Boolean(
    row?.hora_entrada ||
    row?.hora_salida ||
    row?.hora_entrada_manana ||
    row?.hora_salida_manana ||
    row?.hora_entrada_tarde ||
    row?.hora_salida_tarde ||
    asistencia?.hora_entrada ||
    asistencia?.hora_salida ||
    (asistencia?.estado && asistencia.estado !== 'ausente' && asistencia.estado !== 'licencia'),
  )
}

function pickRelevantLicencia(licencias: LicenciaLookup[]): LicenciaLookup | null {
  if (licencias.length === 0) return null

  return [...licencias].sort((a, b) => {
    const priority = (tipo: LicenciaLookup['tipo']) => {
      if (tipo === 'vacaciones') return 0
      if (tipo === 'enfermedad') return 1
      return 2
    }

    return priority(a.tipo) - priority(b.tipo)
  })[0]
}

function buildEstadoHorario(
  licencia: LicenciaLookup | null,
  row?: HorariosHoyData['registros'][number],
  asistencia?: AsistenciaLookup,
): {
  estado: EstadoHorarioConsolidado
  detalle?: string
  licenciaTipo?: LicenciaLookup['tipo'] | null
} {
  if (licencia?.tipo === 'vacaciones') {
    return {
      estado: 'vacaciones',
      detalle: 'Licencia aprobada vigente.',
      licenciaTipo: licencia.tipo,
    }
  }

  if (licencia?.tipo === 'enfermedad') {
    return {
      estado: 'enfermedad',
      detalle: 'Licencia aprobada vigente.',
      licenciaTipo: licencia.tipo,
    }
  }

  const presente = hasAnyMarcacion(row, asistencia)
  if (presente) {
    if ((asistencia?.retraso_minutos || 0) > 0) {
      return {
        estado: 'presente',
        detalle: `Ingreso con ${asistencia?.retraso_minutos} min de demora.`,
        licenciaTipo: licencia?.tipo || null,
      }
    }

    return {
      estado: 'presente',
      detalle: licencia ? `Con licencia aprobada: ${licencia.tipo.replaceAll('_', ' ')}.` : undefined,
      licenciaTipo: licencia?.tipo || null,
    }
  }

  return {
    estado: 'ausente',
    detalle: licencia ? `Sin marcacion. Licencia aprobada: ${licencia.tipo.replaceAll('_', ' ')}.` : 'Sin marcacion registrada en el dia.',
    licenciaTipo: licencia?.tipo || null,
  }
}

function buildRosterRows(
  empleados: EmpleadoLookup[],
  hikRows: HorariosHoyData['registros'],
  asistencias: AsistenciaLookup[],
  licencias: LicenciaLookup[],
): HorariosHoyData['registros'] {
  const hikByEmpleadoId = new Map(
    hikRows.filter((row) => row.empleado_id).map((row) => [row.empleado_id!, row]),
  )
  const asistenciaByEmpleadoId = new Map(asistencias.map((asistencia) => [asistencia.empleado_id, asistencia]))
  const licenciasByEmpleadoId = new Map<string, LicenciaLookup[]>()

  for (const licencia of licencias) {
    const current = licenciasByEmpleadoId.get(licencia.empleado_id) || []
    current.push(licencia)
    licenciasByEmpleadoId.set(licencia.empleado_id, current)
  }

  const rosterRows = empleados.map((empleado) => {
    const hikRow = hikByEmpleadoId.get(empleado.id)
    const asistencia = asistenciaByEmpleadoId.get(empleado.id)
    const licencia = pickRelevantLicencia(licenciasByEmpleadoId.get(empleado.id) || [])
    const estado = buildEstadoHorario(licencia, hikRow, asistencia)

    const horaEntrada = hikRow?.hora_entrada || normalizeHourFromAsistencia(asistencia?.hora_entrada)
    const horaSalida = hikRow?.hora_salida || normalizeHourFromAsistencia(asistencia?.hora_salida)

    return {
      employee_no: hikRow?.employee_no || empleado.legajo || empleado.dni || empleado.id,
      empleado_id: empleado.id,
      dni: empleado.dni || empleado.cuil || empleado.legajo || empleado.id,
      empleado_nombre: formatEmpleadoNombre(empleado),
      hora_entrada_manana: hikRow?.hora_entrada_manana,
      hora_salida_manana: hikRow?.hora_salida_manana,
      hora_entrada_tarde: hikRow?.hora_entrada_tarde,
      hora_salida_tarde: hikRow?.hora_salida_tarde,
      hora_entrada: horaEntrada,
      hora_salida: horaSalida,
      mapeado: true,
      tiene_marcacion: hasAnyMarcacion(hikRow, asistencia),
      estado_consolidado: estado.estado,
      estado_detalle: estado.detalle,
      licencia_tipo: estado.licenciaTipo || null,
      licencia_activa: Boolean(licencia),
      sincronizado_asistencia: Boolean(asistencia),
      origen: 'hik_connect' as const,
    }
  })

  const unmappedRows = hikRows
    .filter((row) => !row.empleado_id)
    .map((row) => ({
      ...row,
      tiene_marcacion: true,
      estado_consolidado: 'presente' as const,
      estado_detalle: 'Marcacion detectada sin vinculo con un empleado activo.',
      licencia_tipo: null,
      licencia_activa: false,
      sincronizado_asistencia: false,
    }))

  return [...rosterRows, ...unmappedRows].sort((a, b) => {
    if (a.mapeado !== b.mapeado) return a.mapeado ? -1 : 1

    const priority = (estado?: EstadoHorarioConsolidado) => {
      if (estado === 'ausente') return 0
      if (estado === 'enfermedad' || estado === 'vacaciones') return 1
      return 2
    }

    const byEstado = priority(a.estado_consolidado) - priority(b.estado_consolidado)
    if (byEstado !== 0) return byEstado
    return (a.empleado_nombre || '').localeCompare(b.empleado_nombre || '', 'es')
  })
}

function buildDailyRows(
  events: HorarioEventoNormalizado[],
  employeeMap: Map<string, EmpleadoLookup>,
  employeeByName: Map<string, EmpleadoLookup>,
): HorariosHoyData['registros'] {
  const grouped = new Map<
    string,
    {
      employeeNo: string
      timestamps: string[]
      hikName?: string
    }
  >()

  for (const event of events) {
    const key = event.employee_no
    const current = grouped.get(key) || { employeeNo: key, timestamps: [] as string[], hikName: undefined as string | undefined }
    current.timestamps.push(event.timestamp)
    if (!current.hikName && event.raw && typeof event.raw === 'object') {
      current.hikName = extractHikPersonName(event.raw)
    }

    grouped.set(key, current)
  }

  const rows: HorariosHoyData['registros'] = []
  for (const row of grouped.values()) {
    const employeeNoKey = normalizeIdentity(row.employeeNo)
    const employeeNoDigits = digitsOnly(row.employeeNo)
    const hikNameKey = row.hikName ? normalizePersonName(row.hikName) : ''
    const empleado = employeeMap.get(employeeNoKey)
      || (employeeNoDigits ? employeeMap.get(employeeNoDigits) : undefined)
      || (hikNameKey ? employeeByName.get(hikNameKey) : undefined)
      || findEmployeeByPartialName(hikNameKey, employeeByName)

    const nombre = `${empleado?.usuario?.nombre || empleado?.nombre || ''} ${empleado?.usuario?.apellido || empleado?.apellido || ''}`.trim() || row.hikName || ''
    const sortedTimes = row.timestamps
      .map((ts) => new Date(ts))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())

    const { manana, tarde } = splitTurnos(sortedTimes)

    const horaEntradaManana = manana[0] ? timestampToLocalHour(manana[0].toISOString()) : undefined
    const horaSalidaManana = manana.length > 1 ? timestampToLocalHour(manana[manana.length - 1].toISOString()) : undefined
    const horaEntradaTarde = tarde[0] ? timestampToLocalHour(tarde[0].toISOString()) : undefined
    const horaSalidaTarde = tarde.length > 1 ? timestampToLocalHour(tarde[tarde.length - 1].toISOString()) : undefined

    // Primera entrada y última salida del día (para sync)
    const first = sortedTimes[0]
    const last = sortedTimes[sortedTimes.length - 1]
    const hasDistinctOut = first && last && first.getTime() !== last.getTime()

    rows.push({
      employee_no: row.employeeNo,
      empleado_id: empleado?.id,
      dni: empleado?.dni || empleado?.cuil || empleado?.legajo || row.employeeNo,
      empleado_nombre: nombre || undefined,
      hora_entrada_manana: horaEntradaManana,
      hora_salida_manana: horaSalidaManana,
      hora_entrada_tarde: horaEntradaTarde,
      hora_salida_tarde: horaSalidaTarde,
      hora_entrada: first ? timestampToLocalHour(first.toISOString()) : undefined,
      hora_salida: hasDistinctOut ? timestampToLocalHour(last.toISOString()) : undefined,
      mapeado: !!empleado,
      tiene_marcacion: true,
      estado_consolidado: 'presente',
      origen: 'hik_connect',
    })
  }

  return rows.sort((a, b) => {
    if (a.mapeado !== b.mapeado) return a.mapeado ? -1 : 1
    const aName = a.empleado_nombre || ''
    const bName = b.empleado_nombre || ''
    return aName.localeCompare(bName, 'es')
  })
}

// ========== SINCRONIZACIÓN HIK → ASISTENCIA ==========

const HORA_LIMITE_ENTRADA = process.env.HORA_LIMITE_ENTRADA || '08:00'

function calcularEstadoYRetraso(horaEntrada: string | undefined): {
  estado: 'presente' | 'tarde'
  retraso_minutos: number
} {
  if (!horaEntrada) return { estado: 'presente', retraso_minutos: 0 }

  const [limH, limM] = HORA_LIMITE_ENTRADA.split(':').map(Number)
  const [entH, entM] = horaEntrada.split(':').map(Number)

  if (isNaN(limH) || isNaN(limM) || isNaN(entH) || isNaN(entM)) {
    return { estado: 'presente', retraso_minutos: 0 }
  }

  const limiteMin = limH * 60 + limM
  const entradaMin = entH * 60 + entM
  const diferencia = entradaMin - limiteMin

  if (diferencia <= 0) {
    return { estado: 'presente', retraso_minutos: 0 }
  }

  return { estado: 'tarde', retraso_minutos: diferencia }
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

async function sincronizarAsistenciaDesdeHik(
  registros: HorariosHoyData['registros'],
  fecha: string,
): Promise<{ sincronizados: number; errores: number; warnings: string[] }> {
  const mapeados = registros.filter(r => r.mapeado && r.empleado_id)
  if (mapeados.length === 0) return { sincronizados: 0, errores: 0, warnings: [] }

  const adminSupabase = createAdminClient()
  const syncWarnings: string[] = []
  let sincronizados = 0
  let errores = 0

  // Verificar registros existentes editados manualmente para no sobrescribirlos
  const empleadoIds = mapeados.map(r => r.empleado_id!)
  const { data: existentes } = await adminSupabase
    .from('rrhh_asistencia')
    .select('empleado_id, observaciones')
    .in('empleado_id', empleadoIds)
    .eq('fecha', fecha)

  const manualesSet = new Set<string>()
  if (existentes) {
    for (const reg of existentes) {
      const obs = (reg.observaciones || '').toLowerCase()
      // Si fue cargado manualmente (no tiene marca de HikConnect), no sobrescribir
      if (obs && !obs.includes('hikconnect') && !obs.includes('hik-connect')) {
        manualesSet.add(reg.empleado_id)
      }
    }
  }

  for (const registro of mapeados) {
    if (manualesSet.has(registro.empleado_id!)) {
      continue // No sobrescribir registros manuales
    }

    const { estado, retraso_minutos } = calcularEstadoYRetraso(registro.hora_entrada)

    // Construir timestamps completos para hora_entrada y hora_salida
    let horaEntradaTs: string | null = null
    let horaSalidaTs: string | null = null

    if (registro.hora_entrada) {
      horaEntradaTs = `${fecha}T${registro.hora_entrada}:00-03:00`
    }
    if (registro.hora_salida) {
      horaSalidaTs = `${fecha}T${registro.hora_salida}:00-03:00`
    }

    // Calcular horas trabajadas sumando cada turno (evita contar el intervalo del almuerzo)
    let horasTrabajadas: number | null = null
    const calcHoras = (entTs: string | null, salTs: string | null): number => {
      if (!entTs || !salTs) return 0
      const e = new Date(entTs)
      const s = new Date(salTs)
      if (isNaN(e.getTime()) || isNaN(s.getTime())) return 0
      return (s.getTime() - e.getTime()) / 3600000
    }

    const horaEntradaMTs = registro.hora_entrada_manana ? `${fecha}T${registro.hora_entrada_manana}:00-03:00` : null
    const horaSalidaMTs = registro.hora_salida_manana ? `${fecha}T${registro.hora_salida_manana}:00-03:00` : null
    const horaEntradaTTs = registro.hora_entrada_tarde ? `${fecha}T${registro.hora_entrada_tarde}:00-03:00` : null
    const horaSalidaTTs = registro.hora_salida_tarde ? `${fecha}T${registro.hora_salida_tarde}:00-03:00` : null

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
          empleado_id: registro.empleado_id!,
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
      devError(`Error sincronizando asistencia para empleado ${registro.empleado_id}:`, error)
    } else {
      sincronizados++
    }
  }

  if (errores > 0) {
    syncWarnings.push(`${errores} registros no pudieron sincronizarse con Asistencia.`)
  }

  return { sincronizados, errores, warnings: syncWarnings }
}

export async function obtenerHorariosHoyDesdeHikAction(fecha?: string): Promise<ApiResponse<HorariosHoyData>> {
  try {
    const missingConfig = validateHikConnectConfig()
    if (missingConfig.length > 0) {
      return {
        success: false,
        error: `Faltan variables de entorno: ${missingConfig.join(', ')}`,
      }
    }

    const supabase = await createClient()
    const isAdmin = await checkAdmin(supabase)
    if (!isAdmin) {
      return {
        success: false,
        error: 'No autorizado. Solo administradores pueden consultar horarios Hik-Connect.',
      }
    }

    let baseDate = new Date()
    if (typeof fecha === 'string') {
      const normalizedDate = fecha.trim()
      const safe = /^\d{4}-\d{2}-\d{2}$/.test(normalizedDate) ? `${normalizedDate}T12:00:00-03:00` : ''
      if (!safe) {
        return {
          success: false,
          error: 'Fecha invalida. Use formato YYYY-MM-DD.',
        }
      }
      baseDate = new Date(safe)
      if (Number.isNaN(baseDate.getTime())) {
        return {
          success: false,
          error: 'Fecha invalida. No se pudo interpretar.',
        }
      }
    }

    const range = getArgentinaDateRange(baseDate)
    let hikResponse = await fetchHikConnectEvents({
      startTime: range.start,
      endTime: range.end,
      date: range.date,
      pageNo: 1,
      pageSize: 200,
    })

    const filterRawEventsForDate = (events: Record<string, unknown>[]) => events.filter((event) => {
      if (!event || typeof event !== 'object') return false
      const raw = event as Record<string, unknown>
      const timestamp = extractRawEventTimestamp(raw)
      if (!timestamp) return false
      return isTimestampOnBusinessDate(timestamp, range.date)
    })

    let rawEventsForDate = filterRawEventsForDate(hikResponse.events)
    const todayArgentina = getArgentinaDateRange(new Date()).date
    const isHistoricalDate = range.date < todayArgentina
    const paginationWasTrimmed = !hikResponse.pagination.complete
    const defaultMaxPagesRaw = Number(process.env.HIK_CONNECT_MAX_PAGES || '50')
    const defaultMaxPages = Number.isFinite(defaultMaxPagesRaw)
      ? Math.max(1, Math.min(defaultMaxPagesRaw, 100))
      : 50
    const fallbackMaxPagesRaw = Number(process.env.HIK_CONNECT_MAX_PAGES_HISTORICAL || '100')
    const fallbackMaxPages = Number.isFinite(fallbackMaxPagesRaw)
      ? Math.max(1, Math.min(fallbackMaxPagesRaw, 100))
      : 100

    if (isHistoricalDate && paginationWasTrimmed && fallbackMaxPages > defaultMaxPages) {
      const retryResponse = await fetchHikConnectEvents({
        startTime: range.start,
        endTime: range.end,
        date: range.date,
        pageNo: 1,
        pageSize: 200,
        maxPages: fallbackMaxPages,
      })
      const retryRawEventsForDate = filterRawEventsForDate(retryResponse.events)
      const retryImprovedCoverage = retryRawEventsForDate.length > rawEventsForDate.length
      const retryClosedPaginationGap = retryResponse.pagination.complete && !hikResponse.pagination.complete

      if (retryImprovedCoverage || retryClosedPaginationGap) {
        rawEventsForDate = retryRawEventsForDate
        hikResponse = {
          ...retryResponse,
          warnings: [
            ...hikResponse.warnings,
            retryImprovedCoverage
              ? `Reintento para fecha historica con ${fallbackMaxPages} paginas: se recuperaron marcaciones.`
              : `Reintento para fecha historica con ${fallbackMaxPages} paginas: se completo la cobertura de la consulta.`,
            ...retryResponse.warnings,
          ],
        }
      } else {
        hikResponse = {
          ...retryResponse,
          warnings: [
            ...hikResponse.warnings,
            `Reintento para fecha historica con ${fallbackMaxPages} paginas sin mejorar cobertura para ${range.date}.`,
            ...retryResponse.warnings,
          ],
        }
      }
    }

    const { normalized: normalizedToday, warnings } = normalizeHikAttendanceEvents(rawEventsForDate)

    const adminSupabase = createAdminClient()
    const employeeMap = new Map<string, EmpleadoLookup>()
    const employeeById = new Map<string, EmpleadoLookup>()
    const employeeByName = new Map<string, EmpleadoLookup>()
    const { data: empleados, error: empleadosError } = await supabase
      .from('rrhh_empleados')
      .select('id, dni, cuil, legajo, nombre, apellido, usuario:usuarios(nombre, apellido)')
      .eq('activo', true)

    if (empleadosError) {
      devError('Error consultando empleados para mapeo de horarios:', empleadosError)
    } else {
      ; (empleados || []).forEach((empleado) => {
        const typed = empleado as EmpleadoLookup
        employeeById.set(typed.id, typed)

        const fullName = `${typed.nombre || ''} ${typed.apellido || ''}`.trim()
        if (fullName) {
          const fullNameKey = normalizePersonName(fullName)
          employeeByName.set(fullNameKey, typed)

          const reverseName = `${typed.apellido || ''} ${typed.nombre || ''}`.trim()
          if (reverseName) {
            employeeByName.set(normalizePersonName(reverseName), typed)
          }
        }

        const keys = [
          typed.dni ? normalizeIdentity(typed.dni) : '',
          typed.cuil ? normalizeIdentity(typed.cuil) : '',
          typed.legajo ? normalizeIdentity(typed.legajo) : '',
          typed.id ? normalizeIdentity(typed.id) : '',
        ].filter(Boolean)

        for (const key of keys) {
          employeeMap.set(key, typed)
          const keyDigits = digitsOnly(key)
          if (keyDigits) {
            employeeMap.set(keyDigits, typed)
          }
        }
      })
    }

    const hikMapConfig = await loadHikPersonMapConfig({
      adminSupabase,
    })
    const { appliedCount: appliedHikMapCount, unresolvedCount: unresolvedHikMapCount } =
      applyConfiguredHikMappings({
        configuredMap: hikMapConfig.map,
        employeeMap,
        employeeById,
        employeeByName,
      })
    warnings.push(...hikMapConfig.warnings)

    const hikRegistros = buildDailyRows(normalizedToday, employeeMap, employeeByName)
    const mappedCount = hikRegistros.filter((row) => row.mapeado).length

    if (hikMapConfig.map.size > 0 && unresolvedHikMapCount > 0) {
      warnings.push(
        `Se aplicaron ${appliedHikMapCount}/${hikMapConfig.map.size} mapeos configurados (rrhh_hik_person_map/HIK_CONNECT_PERSON_MAP).`,
      )
    }

    if (hikRegistros.length > 0 && mappedCount === 0) {
      warnings.push(
        'No se pudo mapear ninguna marcacion a RRHH. Revise DNI/CUIL/legajo o configure rrhh_hik_person_map/HIK_CONNECT_PERSON_MAP.',
      )
    }

    // Sincronizar marcaciones mapeadas con rrhh_asistencia
    let sincronizados = 0
    if (mappedCount > 0) {
      const syncResult = await sincronizarAsistenciaDesdeHik(hikRegistros, range.date)
      sincronizados = syncResult.sincronizados
      warnings.push(...syncResult.warnings)
    }

    const activeEmpleadoIds = [...employeeById.keys()]
    const [{ data: asistencias }, { data: licenciasActivas }] = await Promise.all([
      activeEmpleadoIds.length > 0
        ? adminSupabase
          .from('rrhh_asistencia')
          .select('empleado_id, estado, retraso_minutos, hora_entrada, hora_salida')
          .in('empleado_id', activeEmpleadoIds)
          .eq('fecha', range.date)
        : Promise.resolve({ data: [], error: null }),
      activeEmpleadoIds.length > 0
        ? adminSupabase
          .from('rrhh_licencias')
          .select('empleado_id, tipo, observaciones, fecha_inicio, fecha_fin')
          .in('empleado_id', activeEmpleadoIds)
          .eq('aprobado', true)
          .lte('fecha_inicio', range.date)
          .gte('fecha_fin', range.date)
        : Promise.resolve({ data: [], error: null }),
    ])

    const registros = buildRosterRows(
      Array.from(employeeById.values()),
      hikRegistros,
      (asistencias || []) as AsistenciaLookup[],
      (licenciasActivas || []) as LicenciaLookup[],
    )

    return {
      success: true,
      data: {
        fecha: range.date,
        total_eventos: rawEventsForDate.length,
        registros,
        warnings: [...hikResponse.warnings, ...warnings],
        sincronizados,
        consulta_incompleta: !hikResponse.pagination.complete,
        consulta_incompleta_motivo: hikResponse.pagination.complete
          ? undefined
          : `La consulta de Hik-Connect alcanzo el limite de ${hikResponse.pagination.maxPages} paginas desde la pagina ${hikResponse.pagination.startPage}.`,
      },
      message: `Horarios obtenidos. ${sincronizados} registros sincronizados con Asistencia.`,
    }
  } catch (error) {
    safeLogHikError(error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error interno obteniendo horarios desde Hik-Connect',
    }
  }
}

// ========== SINCRONIZACIÓN DE MES COMPLETO ==========

export async function sincronizarMesDesdeHikAction(
  mes: number,
  anio: number,
): Promise<ApiResponse<{ dias_procesados: number; registros_sincronizados: number; dias_con_error: number }>> {
  try {
    const missingConfig = validateHikConnectConfig()
    if (missingConfig.length > 0) {
      return { success: false, error: `Faltan variables de entorno: ${missingConfig.join(', ')}` }
    }

    const supabase = await createClient()
    const isAdmin = await checkAdmin(supabase)
    if (!isAdmin) {
      return { success: false, error: 'No autorizado. Solo administradores pueden sincronizar horarios.' }
    }

    // Cargar empleados una sola vez para todo el mes
    const { data: empleados } = await supabase
      .from('rrhh_empleados')
      .select('id, dni, cuil, legajo, nombre, apellido, usuario:usuarios(nombre, apellido)')
      .eq('activo', true)

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

    const hikMapConfig = await loadHikPersonMapConfig({
      adminSupabase: createAdminClient(),
    })
    const { unresolvedCount: unresolvedHikMapCount } = applyConfiguredHikMappings({
      configuredMap: hikMapConfig.map,
      employeeMap,
      employeeById,
      employeeByName,
    })
    if (unresolvedHikMapCount > 0) {
      devError(
        `[RRHH Horarios] Mapeos Hik sin resolver en sync mensual: ${unresolvedHikMapCount}/${hikMapConfig.map.size}`,
      )
    }

    const lastDay = new Date(anio, mes, 0).getDate()
    const todayArgentina = getTodayArgentina()
    const [todayYearRaw, todayMonthRaw, todayDayRaw] = todayArgentina.split('-')
    const isCurrentArgentinaMonth = Number(todayYearRaw) === anio && Number(todayMonthRaw) === mes
    const maxDay = isCurrentArgentinaMonth ? Math.min(lastDay, Number(todayDayRaw)) : lastDay
    let diasProcesados = 0
    let registrosSincronizados = 0
    let diasConError = 0

    for (let dia = 1; dia <= maxDay; dia++) {
      const fechaStr = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
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
          diasProcesados++
          continue
        }

        const { normalized } = normalizeHikAttendanceEvents(rawEventsForDate)
        const registros = buildDailyRows(normalized, employeeMap, employeeByName)
        const mappedCount = registros.filter((r) => r.mapeado).length

        if (mappedCount > 0) {
          const syncResult = await sincronizarAsistenciaDesdeHik(registros, range.date)
          registrosSincronizados += syncResult.sincronizados
        }

        diasProcesados++
      } catch (diaError) {
        devError(`Error sincronizando día ${fechaStr}:`, diaError)
        diasConError++
      }
    }

    return {
      success: true,
      data: { dias_procesados: diasProcesados, registros_sincronizados: registrosSincronizados, dias_con_error: diasConError },
      message: `Mes sincronizado: ${diasProcesados} días procesados, ${registrosSincronizados} registros en Asistencia.`,
    }
  } catch (error) {
    safeLogHikError(error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error interno al sincronizar mes desde Hik-Connect',
    }
  }
}
