'use client'

import { useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false })
const CircleMarker = dynamic(() => import('react-leaflet').then(mod => mod.CircleMarker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false })

interface HeatmapMapData {
  zona: string
  lat: number
  lng: number
  valor: number
  label?: string
}

interface HeatmapMapProps {
  title: string
  description?: string
  data: HeatmapMapData[]
  center?: [number, number]
  zoom?: number
  height?: number
}

export function HeatmapMap({ title, description, data, center = [-26.8083, -65.2176], zoom = 12, height = 400 }: HeatmapMapProps) {
  const mapRef = useRef<any>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('leaflet').then((L) => {
        if (L.Icon?.Default) {
          delete (L.Icon.Default.prototype as any)._getIconUrl
          L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
            iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
          })
        }
      })
    }
  }, [])

  const maxValor = Math.max(...data.map(d => d.valor), 1)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div style={{ height: `${height}px` }} className="w-full rounded-lg overflow-hidden">
          <MapContainer
            center={center}
            zoom={zoom}
            style={{ height: '100%', width: '100%' }}
            ref={mapRef}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {data.map((item, index) => {
              const radius = Math.max(10, (item.valor / maxValor) * 50)
              const opacity = Math.max(0.3, item.valor / maxValor)
              return (
                <CircleMarker
                  key={index}
                  center={[item.lat, item.lng]}
                  radius={radius}
                  pathOptions={{
                    fillColor: '#2d6a4f',
                    fillOpacity: opacity,
                    color: '#1a4d3a',
                    weight: 2,
                  }}
                >
                  <Popup>
                    <div className="p-2">
                      <p className="font-semibold">{item.zona}</p>
                      {item.label && <p className="text-sm text-muted-foreground">{item.label}</p>}
                      <p className="text-sm font-medium">Valor: {item.valor}</p>
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}
          </MapContainer>
        </div>
      </CardContent>
    </Card>
  )
}

