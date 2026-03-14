import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/server'
import { RRHH_HIK_PERSON_MAP } from '@/lib/config/rrhh-hik-person-map'
import { devError } from '@/lib/utils/logger'

interface DbHikMapRow {
  hik_code: string | null
  empleado_id: string | null
}

interface HikMapLoadOptions {
  adminSupabase?: SupabaseClient
}

export interface HikMapLoadResult {
  map: Map<string, string>
  dbEntries: number
  envEntries: number
  warnings: string[]
}

export interface ApplyHikMapParams<T extends { id: string }> {
  configuredMap: Map<string, string>
  employeeMap: Map<string, T>
  employeeById: Map<string, T>
}

export interface ApplyHikMapResult {
  appliedCount: number
  unresolvedCount: number
}

export function normalizeHikIdentity(value: string): string {
  return value.replace(/[^0-9A-Za-z]+/g, '').toUpperCase()
}

export function hikDigitsOnly(value: string): string {
  return value.replace(/\D+/g, '')
}

function parseEnvHikMap(raw: string): Map<string, string> {
  const map = new Map<string, string>()
  if (!raw) return map

  const entries = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  for (const entry of entries) {
    const separator = entry.includes('=') ? '=' : entry.includes(':') ? ':' : ''
    if (!separator) continue

    const [left, right] = entry.split(separator).map((part) => part.trim())
    if (!left || !right) continue
    map.set(normalizeHikIdentity(left), right)
  }

  return map
}

function buildStaticHikMap(): Map<string, string> {
  const map = new Map<string, string>()

  for (const [hikCode, employeeRef] of Object.entries(RRHH_HIK_PERSON_MAP)) {
    const normalizedHikCode = normalizeHikIdentity(hikCode)
    const normalizedEmployeeRef = employeeRef.trim()
    if (!normalizedHikCode || !normalizedEmployeeRef) continue
    map.set(normalizedHikCode, normalizedEmployeeRef)
  }

  return map
}

function isMissingHikMapTableError(error: { code?: string; message?: string; details?: string } | null): boolean {
  if (!error) return false
  const code = String(error.code || '').toUpperCase()
  const full = `${error.message || ''} ${error.details || ''}`.toLowerCase()

  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    full.includes('rrhh_hik_person_map') ||
    full.includes('could not find the table')
  )
}

export async function loadHikPersonMapConfig(options: HikMapLoadOptions = {}): Promise<HikMapLoadResult> {
  const warnings: string[] = []
  const dbMap = new Map<string, string>()
  const mergedMap = new Map<string, string>()

  let dbEntries = 0
  let envEntries = 0

  const adminSupabase = options.adminSupabase || createAdminClient()

  try {
    const { data, error } = await adminSupabase
      .from('rrhh_hik_person_map')
      .select('hik_code, empleado_id')

    if (error) {
      if (!isMissingHikMapTableError(error)) {
        warnings.push(`No se pudo leer rrhh_hik_person_map (${error.code || 'sin-codigo'}).`)
        devError('[HikMap] Error leyendo rrhh_hik_person_map:', error)
      }
    } else {
      for (const row of (data || []) as DbHikMapRow[]) {
        const hikCode = typeof row.hik_code === 'string' ? normalizeHikIdentity(row.hik_code) : ''
        const empleadoId = typeof row.empleado_id === 'string' ? row.empleado_id.trim() : ''
        if (!hikCode || !empleadoId) continue
        dbMap.set(hikCode, empleadoId)
      }
      dbEntries = dbMap.size
    }
  } catch (error) {
    warnings.push('No se pudo consultar rrhh_hik_person_map por un error inesperado.')
    devError('[HikMap] Excepcion cargando rrhh_hik_person_map:', error)
  }

  const envRaw = (process.env.HIK_CONNECT_PERSON_MAP || '').trim()
  const envMap = parseEnvHikMap(envRaw)
  const staticMap = buildStaticHikMap()
  envEntries = envMap.size

  if (dbMap.size > 0) {
    for (const [hikCode, employeeRef] of dbMap.entries()) {
      mergedMap.set(hikCode, employeeRef)
    }

    if (envMap.size > 0) {
      warnings.push(
        'Se detecto HIK_CONNECT_PERSON_MAP, pero se ignora porque rrhh_hik_person_map ya tiene mapeos cargados.',
      )
    }
  } else if (staticMap.size > 0) {
    for (const [hikCode, employeeRef] of staticMap.entries()) {
      mergedMap.set(hikCode, employeeRef)
    }

    if (envMap.size > 0) {
      warnings.push(
        'Se detecto HIK_CONNECT_PERSON_MAP, pero se ignora porque el proyecto ya tiene un mapa Hik versionado en codigo.',
      )
    }
  } else {
    for (const [hikCode, employeeRef] of envMap.entries()) {
      mergedMap.set(hikCode, employeeRef)
    }
  }

  return {
    map: mergedMap,
    dbEntries,
    envEntries,
    warnings,
  }
}

export function applyConfiguredHikMappings<T extends { id: string }>(
  params: ApplyHikMapParams<T>,
): ApplyHikMapResult {
  const { configuredMap, employeeMap, employeeById } = params

  let appliedCount = 0
  let unresolvedCount = 0

  for (const [hikCode, employeeRef] of configuredMap.entries()) {
    const refKey = normalizeHikIdentity(employeeRef)
    const refDigits = hikDigitsOnly(employeeRef)

    const resolved =
      employeeById.get(employeeRef) ||
      employeeMap.get(refKey) ||
      (refDigits ? employeeMap.get(refDigits) : undefined)

    if (!resolved) {
      unresolvedCount++
      continue
    }

    employeeMap.set(hikCode, resolved)
    const hikDigits = hikDigitsOnly(hikCode)
    if (hikDigits) employeeMap.set(hikDigits, resolved)
    appliedCount++
  }

  return { appliedCount, unresolvedCount }
}
