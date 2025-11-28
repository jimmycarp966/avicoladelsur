'use client'
import Script from 'next/script'

export function GoogleMapsScript() {
  // Solo cargar el script si tenemos la API key
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    console.warn('Google Maps API key not configured')
    return null
  }

  console.log('Loading Google Maps script with API key:', apiKey.substring(0, 10) + '...')

  return (
    <Script
      src={`https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=3.55&loading=async`}
      strategy="beforeInteractive"
      onLoad={() => {
        console.log('✅ Google Maps API script loaded successfully')
        console.log('Available APIs:', {
          maps: !!(window as any).google?.maps,
          places: !!(window as any).google?.maps?.places,
          map: !!(window as any).google?.maps?.Map,
          autocomplete: !!(window as any).google?.maps?.places?.Autocomplete
        })

        // Dispatch custom event to notify components that Google Maps is ready
        window.dispatchEvent(new CustomEvent('google-maps-loaded', {
          detail: {
            maps: !!(window as any).google?.maps,
            places: !!(window as any).google?.maps?.places,
            map: !!(window as any).google?.maps?.Map,
            autocomplete: !!(window as any).google?.maps?.places?.Autocomplete
          }
        }))
      }}
      onError={(e) => {
        console.error('❌ Error loading Google Maps API script:', e)
        console.error('Script URL attempted:', `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,maps&loading=async`)
        console.error('Possible causes:', [
          'API key restrictions (check domain/IP restrictions in Google Cloud Console)',
          'Maps JavaScript API not enabled',
          'Network/firewall blocking Google APIs',
          'Invalid API key'
        ])
      }}
    />
  )
}
