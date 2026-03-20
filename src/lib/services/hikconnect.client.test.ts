import { strict as assert } from 'node:assert'
import { afterEach, test } from 'node:test'

import { fetchHikConnectEvents } from './hikconnect.client'

const originalFetch = globalThis.fetch
const envKeys = [
  'HIK_CONNECT_BASE_URL',
  'HIK_CONNECT_API_KEY',
  'HIK_CONNECT_API_SECRET',
  'HIK_CONNECT_AUTH_MODE',
  'HIK_CONNECT_EVENTS_METHOD',
  'HIK_CONNECT_MAX_PAGES',
]
const originalEnv = new Map(envKeys.map((key) => [key, process.env[key]]))

afterEach(() => {
  globalThis.fetch = originalFetch
  for (const key of envKeys) {
    const value = originalEnv.get(key)
    if (typeof value === 'undefined') {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
})

function responseJson(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

function buildEvent(timestampIso: string, personCode: string) {
  return {
    occurTime: Date.parse(timestampIso),
    personCode,
    employeeNo: personCode,
    personInfo: {
      personCode,
      baseInfo: {
        personCode,
      },
    },
  }
}

test('fetchHikConnectEvents sigue hasta la pagina 11 y trae la marcacion de la manana', async () => {
  process.env.HIK_CONNECT_BASE_URL = 'https://hik.example.test'
  process.env.HIK_CONNECT_API_KEY = 'api-key'
  process.env.HIK_CONNECT_API_SECRET = 'api-secret'
  process.env.HIK_CONNECT_AUTH_MODE = 'hcc_token'
  process.env.HIK_CONNECT_EVENTS_METHOD = 'POST'
  process.env.HIK_CONNECT_MAX_PAGES = '50'

  const requestedPages: number[] = []
  const morningEvent = buildEvent('2026-03-03T08:27:00-03:00', 'EMP013')

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()

    if (url.includes('/token/get')) {
      return responseJson({ token: 'token-123' })
    }

    if (url.includes('/certificaterecords/search')) {
      const body = JSON.parse(String(init?.body || '{}')) as { pageNo?: number; pageIndex?: number }
      const pageNo = body.pageNo || body.pageIndex || 1
      requestedPages.push(pageNo)

      const rows = pageNo === 11
        ? [morningEvent]
        : [buildEvent(`2026-03-03T21:${String(pageNo).padStart(2, '0')}:00-03:00`, `EMP${String(pageNo).padStart(3, '0')}`)]

      return responseJson({
        data: {
          reportDataList: rows,
          totalNum: 2200,
          pageSize: 200,
        },
      })
    }

    throw new Error(`Unexpected fetch URL: ${url}`)
  }) as typeof fetch

  const result = await fetchHikConnectEvents({
    startTime: '2026-03-03T00:00:00-03:00',
    endTime: '2026-03-03T23:59:59-03:00',
    date: '2026-03-03',
    pageNo: 1,
    pageSize: 200,
  })

  assert.deepEqual(requestedPages, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
  assert.equal(result.pagination.complete, true)
  assert.equal(result.pagination.truncated, false)
  assert.equal(result.warnings.some((warning) => warning.includes('limite de paginas')), false)
  assert.equal(result.events.some((row) => (row as { occurTime?: number }).occurTime === morningEvent.occurTime), true)
})

test('fetchHikConnectEvents avisa cuando el tope manual corta la consulta', async () => {
  process.env.HIK_CONNECT_BASE_URL = 'https://hik.example.test'
  process.env.HIK_CONNECT_API_KEY = 'api-key'
  process.env.HIK_CONNECT_API_SECRET = 'api-secret'
  process.env.HIK_CONNECT_AUTH_MODE = 'hcc_token'
  process.env.HIK_CONNECT_EVENTS_METHOD = 'POST'
  process.env.HIK_CONNECT_MAX_PAGES = '50'

  const requestedPages: number[] = []

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()

    if (url.includes('/token/get')) {
      return responseJson({ token: 'token-123' })
    }

    if (url.includes('/certificaterecords/search')) {
      const body = JSON.parse(String(init?.body || '{}')) as { pageNo?: number; pageIndex?: number }
      const pageNo = body.pageNo || body.pageIndex || 1
      requestedPages.push(pageNo)

      return responseJson({
        data: {
          reportDataList: [buildEvent(`2026-03-03T21:${String(pageNo).padStart(2, '0')}:00-03:00`, `EMP${String(pageNo).padStart(3, '0')}`)],
          totalNum: 2200,
          pageSize: 200,
        },
      })
    }

    throw new Error(`Unexpected fetch URL: ${url}`)
  }) as typeof fetch

  const result = await fetchHikConnectEvents({
    startTime: '2026-03-03T00:00:00-03:00',
    endTime: '2026-03-03T23:59:59-03:00',
    date: '2026-03-03',
    pageNo: 1,
    pageSize: 200,
    maxPages: 10,
  })

  assert.deepEqual(requestedPages, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  assert.equal(result.pagination.complete, false)
  assert.equal(result.pagination.truncated, true)
  assert.equal(result.warnings.some((warning) => warning.includes('limite de 10 paginas')), true)
})
