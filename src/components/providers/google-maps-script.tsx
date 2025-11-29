'use client'
import Script from 'next/script'

export function GoogleMapsScript() {
  // Solo cargar el script si tenemos la API key
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const isDevelopment = process.env.NODE_ENV === 'development'

  if (!apiKey) {
    const errorMsg = isDevelopment
      ? '⚠️ Google Maps API key not configured in .env.local'
      : '⚠️ Google Maps API key not configured in Vercel environment variables'

    console.error('❌ GOOGLE MAPS NOT LOADED:', errorMsg)
    console.error('📝 To fix this:')
    if (isDevelopment) {
      console.error('   1. Create .env.local file in project root')
      console.error('   2. Add: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-api-key')
      console.error('   3. Restart dev server')
    } else {
      console.error('   1. Go to Vercel Dashboard → Your Project → Settings')
      console.error('   2. Navigate to Environment Variables')
      console.error('   3. Add: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = your-api-key')
      console.error('   4. Redeploy the project')
      console.error('   5. Ensure API key allows requests from your Vercel domain')
    }
    return null
  }

  console.log(`🗺️ Loading Google Maps script [${isDevelopment ? 'DEV' : 'PROD'}] with API key:`, apiKey.substring(0, 10) + '...')


  return (
    <Script
      src={`https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&v=weekly&loading=async`}
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
