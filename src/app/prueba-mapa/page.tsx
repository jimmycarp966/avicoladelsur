'use client'

import { useState } from 'react'
import { GoogleMapSelector } from '@/components/ui/google-map-selector'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function PruebaMapa() {
  const [coordenadas, setCoordenadas] = useState<{ lat: number; lng: number } | null>(null)
  const [direccion, setDireccion] = useState('')

  const handleCoordenadasChange = (coords: { lat: number; lng: number } | null) => {
    console.log('[PruebaMapa] Coordenadas cambiadas:', coords)
    setCoordenadas(coords)
  }

  const handleDireccionChange = (dir: string) => {
    console.log('[PruebaMapa] Dirección cambiada:', dir)
    setDireccion(dir)
  }

  const resetValues = () => {
    setCoordenadas(null)
    setDireccion('')
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">Prueba de GoogleMapSelector</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estado Actual</CardTitle>
          <CardDescription>
            Valores actuales de coordenadas y dirección
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Coordenadas:</label>
              <div className="text-sm text-muted-foreground font-mono">
                {coordenadas ? `Lat: ${coordenadas.lat.toFixed(6)}, Lng: ${coordenadas.lng.toFixed(6)}` : 'No seleccionadas'}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Dirección:</label>
              <div className="text-sm text-muted-foreground">
                {direccion || 'No especificada'}
              </div>
            </div>
          </div>
          <Button onClick={resetValues} variant="outline">
            Resetear Valores
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Selector de Mapa</CardTitle>
          <CardDescription>
            Componente GoogleMapSelector - abre la consola del navegador para ver logs detallados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GoogleMapSelector
            coordenadas={coordenadas}
            onCoordenadasChange={handleCoordenadasChange}
            direccion={direccion}
            onDireccionChange={handleDireccionChange}
            placeholder="Busca una dirección para probar..."
          />

          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">¿No funciona?</h4>
            <p className="text-sm text-blue-800 mb-3">
              Si el mapa no carga aquí pero sí en /diagnostico-google-maps, el problema está en el timing del componente.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => window.location.href = '/diagnostico-google-maps'}
                variant="outline"
                size="sm"
              >
                Ir a Diagnóstico
              </Button>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                size="sm"
              >
                Recargar Página
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instrucciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">1. Abre la consola del navegador (F12 → Console)</p>
          <p className="text-sm">2. Busca mensajes que empiecen con [GoogleMapSelector]</p>
          <p className="text-sm">3. Si el mapa no carga, verás los detalles del error</p>
          <p className="text-sm">4. Compara con la página de diagnóstico (/diagnostico-google-maps)</p>
        </CardContent>
      </Card>
    </div>
  )
}
