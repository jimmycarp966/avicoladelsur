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
    if (typeof value === 'string' && value.trim()) return value.trim()
    // API cloud HikConnect devuelve occurTime como epoch en milisegundos (número de 13 dígitos, UTC)
    if (typeof value === 'number' && Number.isFinite(value) && value > 1e10) {
      return new Date(value).toISOString()
    }
  }
  return undefined
}

function isTimestampOnBusinessDate(timestamp: string, date: string): boolean {
  const parsed = new Date(timestamp)
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

function parseManualHikMap(): Map<string, string> {
  const raw = (process.env.HIK_CONNECT_PERSON_MAP || '').trim()
  const map = new Map<string, string>()
  if (!raw) return map

  const entries = raw.split(',').map((item) => item.trim()).filter(Boolean)
  for (const entry of entries) {
    const separator = entry.includes('=') ? '=' : entry.includes(':') ? ':' : ''
    if (!separator) continue
    const [left, right] = entry.split(separator).map((part) => part.trim())
    if (!left || !right) continue
    map.set(normalizeIdentity(left), right)
  }

  return map
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
const MIDDAY_HORA_ARG = 13

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
    if (fecha) {
      const safe = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? `${fecha}T12:00:00-03:00` : ''
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

    const { normalized: normalizedToday, warnings } = normalizeHikAttendanceEvents(rawEventsForDate)

    const uniqueIdentityKeys = [...new Set(normalizedToday.map((item) => normalizeIdentity(item.employee_no)).filter(Boolean))]

    const employeeMap = new Map<string, EmpleadoLookup>()
    const employeeById = new Map<string, EmpleadoLookup>()
    const employeeByName = new Map<string, EmpleadoLookup>()
    if (uniqueIdentityKeys.length > 0) {
      const { data: empleados, error } = await supabase
        .from('rrhh_empleados')
        .select('id, dni, cuil, legajo, nombre, apellido, usuario:usuarios(nombre, apellido)')
        .eq('activo', true)

      if (error) {
        devError('Error consultando empleados para mapeo de horarios:', error)
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
    }

    const manualMap = parseManualHikMap()
    let appliedManualMapCount = 0
    for (const [hikCode, employeeRef] of manualMap.entries()) {
      const refKey = normalizeIdentity(employeeRef)
      const refDigits = digitsOnly(employeeRef)
      const resolved =
        employeeById.get(employeeRef) ||
        employeeMap.get(refKey) ||
        (refDigits ? employeeMap.get(refDigits) : undefined)

      if (resolved) {
        employeeMap.set(hikCode, resolved)
        const hikDigits = digitsOnly(hikCode)
        if (hikDigits) {
          employeeMap.set(hikDigits, resolved)
        }
        appliedManualMapCount++
      }
    }

    const registros = buildDailyRows(normalizedToday, employeeMap, employeeByName)
    const mappedCount = registros.filter((row) => row.mapeado).length

    if (manualMap.size > 0 && appliedManualMapCount < manualMap.size) {
      warnings.push(`Se aplicaron ${appliedManualMapCount}/${manualMap.size} mapeos manuales de HIK_CONNECT_PERSON_MAP.`)
    }

    if (registros.length > 0 && mappedCount === 0) {
      warnings.push(
        'No se pudo mapear ninguna marcacion a RRHH. Revise DNI/CUIL/legajo o configure HIK_CONNECT_PERSON_MAP.',
      )
    }

    // Sincronizar marcaciones mapeadas con rrhh_asistencia
    let sincronizados = 0
    if (mappedCount > 0) {
      const syncResult = await sincronizarAsistenciaDesdeHik(registros, range.date)
      sincronizados = syncResult.sincronizados
      warnings.push(...syncResult.warnings)
    }

    return {
      success: true,
      data: {
        fecha: range.date,
        total_eventos: rawEventsForDate.length,
        registros,
        warnings: [...hikResponse.warnings, ...warnings],
        sincronizados,
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

    // Aplicar mapeo manual si existe
    const manualMap = parseManualHikMap()
    for (const [hikCode, employeeRef] of manualMap.entries()) {
      const refKey = normalizeIdentity(employeeRef)
      const refDigits = digitsOnly(employeeRef)
      const resolved = employeeById.get(employeeRef)
        || employeeMap.get(refKey)
        || (refDigits ? employeeMap.get(refDigits) : undefined)
      if (resolved) {
        employeeMap.set(hikCode, resolved)
        const hikDigits = digitsOnly(hikCode)
        if (hikDigits) employeeMap.set(hikDigits, resolved)
      }
    }

    const lastDay = new Date(anio, mes, 0).getDate()
    let diasProcesados = 0
    let registrosSincronizados = 0
    let diasConError = 0

    for (let dia = 1; dia <= lastDay; dia++) {
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
