const CACHE_VERSION = 'avs-pwa-v1'
const PRECACHE = `avs-precache-${CACHE_VERSION}`
const RUNTIME = `avs-runtime-${CACHE_VERSION}`
const OFFLINE_URL = '/offline'

const PRECACHE_URLS = [
  OFFLINE_URL,
  '/manifest.json',
  '/favicon.ico',
  '/images/apple-touch-icon.png',
  '/images/icon-192.png',
  '/images/icon-512.png',
  '/images/favicon.svg',
  '/images/logo-avicola.svg',
]

const ASSET_DESTINATIONS = new Set(['style', 'script', 'image', 'font', 'manifest'])
const ASSET_PATH_PREFIXES = ['/_next/static/', '/images/']

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE)
      await cache.addAll(PRECACHE_URLS)
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys()
      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith('avs-') && name !== PRECACHE && name !== RUNTIME)
          .map((name) => caches.delete(name)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)

  if (url.origin !== self.location.origin) {
    return
  }

  if (url.pathname.startsWith('/api/')) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request))
    return
  }

  if (isStaticAssetRequest(request, url)) {
    event.respondWith(cacheFirst(request))
  }
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})

function isStaticAssetRequest(request, url) {
  if (request.destination && ASSET_DESTINATIONS.has(request.destination)) {
    return true
  }

  return ASSET_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
    || url.pathname === '/favicon.ico'
    || url.pathname === '/manifest.json'
    || url.pathname.startsWith('/offline')
}

async function handleNavigation(request) {
  try {
    return await fetch(request)
  } catch {
    const cache = await caches.open(PRECACHE)
    const offlineResponse = await cache.match(OFFLINE_URL)

    if (offlineResponse) {
      return offlineResponse
    }

    return new Response(
      '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexion</title></head><body><h1>Sin conexion</h1><p>La app necesita red para cargar esta pantalla.</p></body></html>',
      {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      },
    )
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME)
  const cachedResponse = await cache.match(request)

  if (cachedResponse) {
    return cachedResponse
  }

  try {
    const response = await fetch(request)

    if (response && response.ok) {
      await cache.put(request, response.clone())
    }

    return response
  } catch {
    return cachedResponse || Response.error()
  }
}
