import { devError } from '@/lib/utils/logger'

interface HikConnectConfig {
  baseUrl: string
  apiKey: string
  apiSecret: string
  tokenPath: string
  eventsPath: string
  eventsMethod: 'GET' | 'POST'
  authMode: 'hcc_token' | 'bearer'
}

interface HikConnectTokenResponse {
  token: string
  expiresIn?: number
}

export interface HikConnectEventsRequest {
  startTime: string
  endTime: string
  date?: string
  pageNo?: number
  pageSize?: number
  maxPages?: number
}

export interface HikConnectEventsResponse {
  raw: unknown
  events: Record<string, unknown>[]
  warnings: string[]
}

interface HikPageResult {
  payload: Record<string, unknown>
  events: Record<string, unknown>[]
  totalNum?: number
  pageSize?: number
}

function getConfig(): HikConnectConfig {
  const baseUrl = (process.env.HIK_CONNECT_BASE_URL || '').trim()
  const apiKey = (process.env.HIK_CONNECT_API_KEY || '').trim()
  const apiSecret = (process.env.HIK_CONNECT_API_SECRET || '').trim()

  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    apiKey,
    apiSecret,
    tokenPath: process.env.HIK_CONNECT_TOKEN_PATH || '/api/hccgw/platform/v1/token/get',
    eventsPath: process.env.HIK_CONNECT_EVENTS_PATH || '/api/hccgw/acs/v1/event/certificaterecords/search',
    eventsMethod: (process.env.HIK_CONNECT_EVENTS_METHOD || 'POST').toUpperCase() === 'GET' ? 'GET' : 'POST',
    authMode: (process.env.HIK_CONNECT_AUTH_MODE || 'hcc_token').toLowerCase() === 'bearer' ? 'bearer' : 'hcc_token',
  }
}

export function validateHikConnectConfig(): string[] {
  const cfg = getConfig()
  const missing: string[] = []

  if (!cfg.baseUrl) missing.push('HIK_CONNECT_BASE_URL')
  if (!cfg.apiKey) missing.push('HIK_CONNECT_API_KEY')
  if (!cfg.apiSecret) missing.push('HIK_CONNECT_API_SECRET')

  return missing
}

function resolveUrl(baseUrl: string, path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

function extractToken(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const root = payload as Record<string, unknown>
  const data = (root.data && typeof root.data === 'object' ? root.data : {}) as Record<string, unknown>
  const result = (root.result && typeof root.result === 'object' ? root.result : {}) as Record<string, unknown>

  return (
    (typeof root.access_token === 'string' ? root.access_token : null) ||
    (typeof root.accessToken === 'string' ? root.accessToken : null) ||
    (typeof root.token === 'string' ? root.token : null) ||
    (typeof data.access_token === 'string' ? data.access_token : null) ||
    (typeof data.accessToken === 'string' ? data.accessToken : null) ||
    (typeof data.token === 'string' ? data.token : null) ||
    (typeof result.access_token === 'string' ? result.access_token : null) ||
    (typeof result.accessToken === 'string' ? result.accessToken : null) ||
    (typeof result.token === 'string' ? result.token : null) ||
    null
  )
}

async function getAccessToken(config: HikConnectConfig): Promise<HikConnectTokenResponse> {
  const tokenUrl = resolveUrl(config.baseUrl, config.tokenPath)

  const tokenBody =
    config.authMode === 'hcc_token'
      ? {
          appKey: config.apiKey,
          secretKey: config.apiSecret,
        }
      : {
          apiKey: config.apiKey,
          apiSecret: config.apiSecret,
          grant_type: 'client_credentials',
        }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(tokenBody),
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(`Hik token error ${response.status}: ${JSON.stringify(payload)}`)
  }

  const token = extractToken(payload)
  if (!token) {
    throw new Error('No se encontró access token en respuesta de Hik-Connect')
  }

  const root = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>
  const data = (root.data && typeof root.data === 'object' ? root.data : {}) as Record<string, unknown>
  const expiresFromRoot = typeof root.expires_in === 'number' ? root.expires_in : undefined
  const expiresFromData = typeof data.expires_in === 'number' ? data.expires_in : undefined
  const expiresAtEpochRoot = typeof root.expireTime === 'number' ? root.expireTime : undefined
  const expiresAtEpochData = typeof data.expireTime === 'number' ? data.expireTime : undefined

  return { token, expiresIn: expiresFromRoot ?? expiresFromData ?? expiresAtEpochRoot ?? expiresAtEpochData }
}

function extractEvents(payload: unknown): Record<string, unknown>[] {
  const root = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>
  const data = (root.data && typeof root.data === 'object' ? root.data : {}) as Record<string, unknown>

  const candidates = [
    data.reportDataList,
    data.recordList,
    data.events,
    data.list,
    data.records,
    root.events,
    root.list,
    root.records,
    root.data,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((row) => row && typeof row === 'object')
    }
  }

  return []
}

function readNumber(source: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return undefined
}

function extractPagingMeta(payload: unknown): { totalNum?: number; pageSize?: number } {
  const root = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>
  const data = (root.data && typeof root.data === 'object' ? root.data : {}) as Record<string, unknown>

  const totalNum = readNumber(data, ['totalNum', 'total', 'totalCount', 'count']) ?? readNumber(root, ['totalNum', 'total', 'totalCount', 'count'])
  const pageSize = readNumber(data, ['pageSize']) ?? readNumber(root, ['pageSize'])

  return { totalNum, pageSize }
}

export async function fetchHikConnectEvents(params: HikConnectEventsRequest): Promise<HikConnectEventsResponse> {
  const config = getConfig()
  const warnings: string[] = []

  const tokenInfo = await getAccessToken(config)
  const eventsUrl = resolveUrl(config.baseUrl, config.eventsPath)

  const authHeaders =
    config.authMode === 'hcc_token'
      ? {
          token: tokenInfo.token,
          appKey: config.apiKey,
        }
      : {
          Authorization: `Bearer ${tokenInfo.token}`,
          'x-api-key': config.apiKey,
        }

  const defaultPageSize = Math.min(params.pageSize || 200, 200)
  const maxPagesFromEnv = Number(process.env.HIK_CONNECT_MAX_PAGES || '10')
  const maxPagesFromParams = typeof params.maxPages === 'number' ? params.maxPages : maxPagesFromEnv
  const maxPages = Number.isFinite(maxPagesFromParams) ? Math.max(1, Math.min(maxPagesFromParams, 50)) : 10

  const fetchPage = async (pageNo: number): Promise<HikPageResult> => {
    let response: Response

    if (config.eventsMethod === 'GET') {
      const url = new URL(eventsUrl)
      url.searchParams.set('startTime', params.startTime)
      url.searchParams.set('endTime', params.endTime)
      url.searchParams.set('pageNo', String(pageNo))
      url.searchParams.set('pageSize', String(defaultPageSize))

      response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...authHeaders,
        },
        cache: 'no-store',
      })
    } else {
      const body: Record<string, unknown> =
        config.authMode === 'hcc_token'
          ? {
              beginTime: params.startTime,
              endTime: params.endTime,
              startTime: params.startTime,
              occurTimeBegin: params.startTime,
              occurTimeEnd: params.endTime,
              pageIndex: pageNo,
              pageNo,
              pageSize: defaultPageSize,
            }
          : {
              startTime: params.startTime,
              endTime: params.endTime,
              pageNo,
              pageSize: defaultPageSize,
            }

      response = await fetch(eventsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(body),
        cache: 'no-store',
      })
    }

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
    if (!response.ok) {
      throw new Error(`Hik events error ${response.status}: ${JSON.stringify(payload)}`)
    }

    const events = extractEvents(payload)
    const paging = extractPagingMeta(payload)
    return { payload, events, totalNum: paging.totalNum, pageSize: paging.pageSize ?? defaultPageSize }
  }

  const firstPageNo = params.pageNo || 1
  const first = await fetchPage(firstPageNo)
  const mergedEvents = [...first.events]
  const totalNum = first.totalNum
  const effectivePageSize = first.pageSize || defaultPageSize

  if (typeof totalNum === 'number' && totalNum > effectivePageSize) {
    const totalPages = Math.ceil(totalNum / effectivePageSize)
    const pagesToFetch = Math.min(totalPages, maxPages)

    for (let page = firstPageNo + 1; page <= pagesToFetch; page++) {
      const next = await fetchPage(page)
      mergedEvents.push(...next.events)
    }

    if (totalPages > maxPages) {
      warnings.push(`Se recuperaron ${maxPages} paginas de Hik-Connect y puede haber mas eventos pendientes.`)
    }
  }

  const withPersonCode = mergedEvents.filter((row) => {
    const event = row as Record<string, unknown>
    const personInfo = (event.personInfo && typeof event.personInfo === 'object') ? (event.personInfo as Record<string, unknown>) : undefined
    const baseInfo = (personInfo?.baseInfo && typeof personInfo.baseInfo === 'object') ? (personInfo.baseInfo as Record<string, unknown>) : undefined
    return (
      typeof baseInfo?.personCode === 'string' ||
      typeof personInfo?.personCode === 'string' ||
      typeof event.personCode === 'string' ||
      typeof event.employeeNo === 'string'
    )
  }).length

  if (mergedEvents.length > 0 && withPersonCode < mergedEvents.length) {
    warnings.push(`Hik devolvio ${mergedEvents.length - withPersonCode} eventos sin personCode/employeeNo (normal en ciertos eventType).`)
  }

  return {
    raw: first.payload,
    events: mergedEvents,
    warnings,
  }
}

export function safeLogHikError(error: unknown): void {
  if (error instanceof Error) {
    devError('[HikConnect] Error:', error.message)
    return
  }
  devError('[HikConnect] Error desconocido')
}
