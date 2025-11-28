'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle, XCircle, AlertCircle, MapPin } from 'lucide-react'

declare global {
  interface Window {
    google: any
  }
}

export default function DiagnosticoGoogleMaps() {
  const [diagnostico, setDiagnostico] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [scriptStatus, setScriptStatus] = useState<'loading' | 'loaded' | 'error' | 'not-loaded'>('not-loaded')
  const [googleStatus, setGoogleStatus] = useState<any>(null)

  const ejecutarDiagnostico = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/test-google-maps')
      const data = await response.json()
      setDiagnostico(data)
    } catch (error) {
      setDiagnostico({
        success: false,
        error: 'Error al conectar con el servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const verificarScriptGoogle = () => {
    setScriptStatus('loading')

    // Verificar si el script ya está cargado
    if (window.google && window.google.maps) {
      setScriptStatus('loaded')
      setGoogleStatus({
        maps: !!window.google.maps,
        places: !!window.google.maps.places,
        map: !!window.google.maps.Map,
        autocomplete: !!window.google.maps.places?.Autocomplete,
        version: window.google.maps.version || 'unknown'
      })
      return
    }

    // Si no está cargado, esperar un poco
    setTimeout(() => {
      if (window.google && window.google.maps) {
        setScriptStatus('loaded')
        setGoogleStatus({
          maps: !!window.google.maps,
          places: !!window.google.maps.places,
          map: !!window.google.maps.Map,
          autocomplete: !!window.google.maps.places?.Autocomplete,
          version: window.google.maps.version || 'unknown'
        })
      } else {
        setScriptStatus('error')
        setGoogleStatus({
          error: 'Script de Google Maps no se cargó después de 5 segundos'
        })
      }
    }, 5000)
  }

  const probarGeocoding = async () => {
    if (!window.google || !window.google.maps) {
      alert('Google Maps no está disponible')
      return
    }

    try {
      const geocoder = new window.google.maps.Geocoder()
      const result = await new Promise((resolve, reject) => {
        geocoder.geocode({ address: 'Monteros, Tucumán, Argentina' }, (results: any, status: any) => {
          if (status === 'OK') {
            resolve(results[0])
          } else {
            reject(status)
          }
        })
      })

      alert('Geocoding exitoso: ' + JSON.stringify(result, null, 2))
    } catch (error) {
      alert('Error en geocoding: ' + error)
    }
  }

  const probarCrearMapa = () => {
    if (!window.google || !window.google.maps || !window.google.maps.Map) {
      alert('Maps JavaScript API no está disponible')
      return
    }

    try {
      // Intentar crear un mapa básico
      const mapDiv = document.createElement('div')
      mapDiv.style.width = '400px'
      mapDiv.style.height = '300px'
      mapDiv.style.position = 'fixed'
      mapDiv.style.top = '50%'
      mapDiv.style.left = '50%'
      mapDiv.style.transform = 'translate(-50%, -50%)'
      mapDiv.style.zIndex = '9999'
      mapDiv.style.border = '2px solid black'

      const map = new window.google.maps.Map(mapDiv, {
        center: { lat: -27.1671, lng: -65.4995 }, // Monteros, Tucumán
        zoom: 10
      })

      document.body.appendChild(mapDiv)

      // Agregar botón para cerrar
      const closeButton = document.createElement('button')
      closeButton.innerText = 'Cerrar Mapa'
      closeButton.style.position = 'absolute'
      closeButton.style.top = '10px'
      closeButton.style.right = '10px'
      closeButton.style.zIndex = '10000'
      closeButton.onclick = () => document.body.removeChild(mapDiv)
      mapDiv.appendChild(closeButton)

      alert('Mapa creado exitosamente')
    } catch (error) {
      alert('Error al crear mapa: ' + error)
    }
  }

  useEffect(() => {
    ejecutarDiagnostico()
    verificarScriptGoogle()
  }, [])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2">
        <MapPin className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Diagnóstico Google Maps</h1>
      </div>

      {/* Estado del Script de Google Maps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {scriptStatus === 'loading' && <Loader2 className="h-5 w-5 animate-spin" />}
            {scriptStatus === 'loaded' && <CheckCircle className="h-5 w-5 text-green-500" />}
            {scriptStatus === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
            Estado del Script de Google Maps
          </CardTitle>
          <CardDescription>
            Verifica si el script de Google Maps se está cargando correctamente en el navegador
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span>Estado:</span>
            <Badge variant={
              scriptStatus === 'loaded' ? 'default' :
              scriptStatus === 'error' ? 'destructive' :
              'secondary'
            }>
              {scriptStatus === 'loading' ? 'Cargando...' :
               scriptStatus === 'loaded' ? 'Cargado' :
               scriptStatus === 'error' ? 'Error' : 'No cargado'}
            </Badge>
          </div>

          {googleStatus && (
            <div className="space-y-2">
              <h4 className="font-medium">Detalles de Google Maps:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(googleStatus).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span>{key}:</span>
                    <Badge variant={value ? 'default' : 'destructive'}>
                      {value ? '✓' : '✗'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={verificarScriptGoogle} variant="outline">
              Verificar Script
            </Button>
            <Button onClick={probarGeocoding} disabled={scriptStatus !== 'loaded'}>
              Probar Geocoding
            </Button>
            <Button onClick={probarCrearMapa} disabled={scriptStatus !== 'loaded'}>
              Probar Crear Mapa
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Diagnóstico del Servidor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Diagnóstico del Servidor
          </CardTitle>
          <CardDescription>
            Verifica la configuración de la API key desde el servidor
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Ejecutando diagnóstico...
            </div>
          ) : diagnostico ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span>Estado:</span>
                <Badge variant={diagnostico.success ? 'default' : 'destructive'}>
                  {diagnostico.success ? 'OK' : 'Error'}
                </Badge>
              </div>

              {diagnostico.message && (
                <p className="text-sm text-muted-foreground">{diagnostico.message}</p>
              )}

              {diagnostico.error && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {diagnostico.error}
                </div>
              )}

              {diagnostico.data && (
                <div className="space-y-1 text-sm">
                  <div>API Key configurada: {diagnostico.data.apiKeyConfigured ? 'Sí' : 'No'}</div>
                  <div>Longitud API Key: {diagnostico.data.apiKeyLength}</div>
                  <div>Respuesta de prueba: {diagnostico.data.testResponse}</div>
                  {diagnostico.data.scriptUrl && (
                    <div>URL del script: <code className="text-xs bg-gray-100 p-1 rounded">{diagnostico.data.scriptUrl}</code></div>
                  )}
                </div>
              )}

              {diagnostico.recommendations && (
                <div className="space-y-1">
                  <h4 className="font-medium text-sm">Recomendaciones:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {diagnostico.recommendations.map((rec: string, i: number) => (
                      <li key={i}>• {rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No se ha ejecutado el diagnóstico aún</p>
          )}

          <Button onClick={ejecutarDiagnostico} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Ejecutar Diagnóstico
          </Button>
        </CardContent>
      </Card>

      {/* Información de Troubleshooting */}
      <Card>
        <CardHeader>
          <CardTitle>Solución de Problemas</CardTitle>
          <CardDescription>
            Pasos para resolver problemas comunes con Google Maps
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">1. Verificar restricciones de API Key</h4>
            <p className="text-sm text-muted-foreground">
              Ve a Google Cloud Console → APIs y Servicios → Credenciales.
              Selecciona tu API Key y verifica que no tenga restricciones de IP o dominio que bloqueen tu sitio.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">2. Verificar APIs habilitadas</h4>
            <p className="text-sm text-muted-foreground">
              Asegúrate de que estén habilitadas: Maps JavaScript API, Directions API, Places API.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">3. Verificar consola del navegador</h4>
            <p className="text-sm text-muted-foreground">
              Abre las herramientas de desarrollo (F12) y revisa la pestaña Console para errores específicos de Google Maps.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">4. Verificar configuración específica de Maps JavaScript API</h4>
            <p className="text-sm text-muted-foreground">
              En Google Cloud Console → APIs y Servicios → Biblioteca, busca "Maps JavaScript API" y verifica que esté habilitada específicamente (no solo activada en general).
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">5. Probar con nueva API Key</h4>
            <p className="text-sm text-muted-foreground">
              Crea una nueva API Key específicamente para Maps JavaScript API y pruébala.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">6. Verificar restricciones de aplicación</h4>
            <p className="text-sm text-muted-foreground">
              Asegúrate de que las restricciones permitan "http://localhost:3000" y "localhost" sin restricciones de tipo de API.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
