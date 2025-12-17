'use client'

import { useEffect } from 'react'
import Script from 'next/script'

export function GoogleMapsScript() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const isDevelopment = process.env.NODE_ENV === 'development'

  // Evitar logs repetitivos en cada render usando useEffect
  useEffect(() => {
    if (!apiKey) {
      const errorMsg = isDevelopment
        ? '⚠️ Google Maps API key not configured in .env.local'
        : '⚠️ Google Maps API key not configured in Vercel environment variables'

      console.error('❌ GOOGLE MAPS NOT LOADED:', errorMsg)
    } else {
      console.log(`🗺️ Google Maps script provider initialized [${isDevelopment ? 'DEV' : 'PROD'}]`)
    }
  }, [apiKey, isDevelopment])

  if (!apiKey) return null

  return (
    <Script
      id="google-maps-api"
      src={`https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&v=weekly&loading=async`}
      strategy="afterInteractive" // Cambiado a afterInteractive para evitar problemas de SSR/Hydration en Next 15
      onLoad={() => {
        if (typeof window !== 'undefined') {
          console.log('✅ Google Maps API script loaded successfully')

          // Notificar que Maps está listo
          window.dispatchEvent(new CustomEvent('google-maps-loaded', {
            detail: {
              maps: !!(window as any).google?.maps,
              places: !!(window as any).google?.maps?.places
            }
          }))
        }
      }}
      onError={(e) => {
        console.error('❌ Error loading Google Maps API script:', e)
      }}
    />
  )
}

