import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // Verificar si es una solicitud desde el cliente para diagnóstico
  const url = new URL(request.url)
  const clientTest = url.searchParams.get('client')

  if (clientTest === 'true') {
    // Respuesta para diagnóstico desde el cliente
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent'),
      apiKeyConfigured: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
      message: 'Este endpoint se usa para diagnóstico desde el cliente. Verifica la consola del navegador.'
    })
  }
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY no está configurada'
    })
  }

  try {
    // Probar la solicitud a la API de Geocoding (servidor)
    const testUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=Buenos%20Aires&key=${apiKey}`

    const response = await fetch(testUrl)
    const data = await response.json()

    // Información adicional sobre la configuración
    const scriptUrl = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=3.55&loading=async`

    if (data.status === 'OK') {
      return NextResponse.json({
        success: true,
        message: 'Google Maps API está funcionando correctamente desde el servidor',
        data: {
          apiKeyConfigured: !!apiKey,
          apiKeyLength: apiKey.length,
          apiKeyPrefix: apiKey.substring(0, 10) + '...',
          testResponse: data.status,
          scriptUrl: scriptUrl,
          configuredLibraries: 'places',
          recommendations: [
            'Si el mapa no carga en el navegador, verifica:',
            '1. Que la API key no tenga restricciones de dominio/IP',
            '2. Que Maps JavaScript API esté habilitada',
            '3. Que no haya bloqueos de CORS o firewall',
            '4. Revisa la consola del navegador para errores específicos'
          ]
        }
      })
    } else {
      return NextResponse.json({
        success: false,
        error: `Error en la API: ${data.status}`,
        details: data.error_message || 'Sin detalles adicionales',
        troubleshooting: {
          commonIssues: [
            'API_KEY_INVALID: Verifica que la API key sea correcta',
            'REQUEST_DENIED: Verifica que las APIs estén habilitadas y no haya restricciones',
            'OVER_QUERY_LIMIT: Has excedido el límite de requests'
          ],
          scriptUrl: scriptUrl
        }
      })
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Error al conectar con Google Maps API',
      details: error instanceof Error ? error.message : 'Error desconocido',
      networkInfo: {
        apiKeyConfigured: !!apiKey,
        scriptWillLoad: !!apiKey,
        possibleCauses: [
          'Problemas de conectividad a internet',
          'Firewall bloqueando requests a Google',
          'Proxy configurado incorrectamente'
        ]
      }
    })
  }
}





















