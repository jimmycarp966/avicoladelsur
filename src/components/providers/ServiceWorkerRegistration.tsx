'use client'

import { useEffect } from 'react'

const SERVICE_WORKER_PATH = '/sw.js'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      return
    }

    if (!('serviceWorker' in navigator)) {
      return
    }

    let cancelled = false

    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register(SERVICE_WORKER_PATH, {
          scope: '/',
        })
      } catch (error) {
        if (!cancelled) {
          console.error('[PWA] Error registering service worker:', error)
        }
      }
    }

    if (document.readyState === 'complete') {
      void registerServiceWorker()
    } else {
      const onLoad = () => {
        void registerServiceWorker()
      }

      window.addEventListener('load', onLoad, { once: true })

      return () => {
        cancelled = true
        window.removeEventListener('load', onLoad)
      }
    }

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
