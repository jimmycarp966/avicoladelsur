'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { MapPin, Search, Crosshair, Loader2 } from 'lucide-react'

interface Coordenadas {
  lat: number
  lng: number
}

interface GoogleMapSelectorProps {
  coordenadas?: Coordenadas | null
  onCoordenadasChange: (coordenadas: Coordenadas | null) => void
  direccion?: string
  onDireccionChange?: (direccion: string) => void
  placeholder?: string
  className?: string
}

declare global {
  interface Window {
    google: any
  }
}

// Tipos para Google Maps (usando any ya que se carga dinámicamente)
type GoogleMap = any
type GoogleMarker = any
type GoogleAutocomplete = any

export function GoogleMapSelector({
  coordenadas,
  onCoordenadasChange,
  direccion = '',
  onDireccionChange,
  placeholder = 'Buscar dirección...',
  className = ''
}: GoogleMapSelectorProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<GoogleAutocomplete | null>(null)
  const markerRef = useRef<GoogleMarker | null>(null)
  const mapInstanceRef = useRef<GoogleMap | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchValue, setSearchValue] = useState(direccion)

  // Inicializar mapa
  const initializeMap = useCallback(() => {
    if (!window.google || !mapRef.current) return

    try {
      const defaultCenter = coordenadas || { lat: -27.1671, lng: -65.4995 } // Monteros, Tucumán

      const mapOptions = {
        center: defaultCenter,
        zoom: coordenadas ? 15 : 10,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
      }

      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, mapOptions)

      // Agregar marcador si hay coordenadas iniciales
      if (coordenadas) {
        markerRef.current = new window.google.maps.Marker({
          position: coordenadas,
          map: mapInstanceRef.current,
          draggable: true,
          title: 'Ubicación del cliente'
        })

        // Evento cuando se arrastra el marcador
        markerRef.current.addListener('dragend', (event: any) => {
          const newCoords = {
            lat: event.latLng.lat(),
            lng: event.latLng.lng()
          }
          onCoordenadasChange(newCoords)

          // Obtener dirección desde coordenadas (reverse geocoding)
          const geocoder = new window.google.maps.Geocoder()
          geocoder.geocode({ location: newCoords }, (results: any, status: any) => {
            if (status === 'OK' && results[0]) {
              const address = results[0].formatted_address
              setSearchValue(address)
              onDireccionChange?.(address)
            }
          })
        })
      }

      // Evento de clic en el mapa
      mapInstanceRef.current.addListener('click', (event: any) => {
        const clickedCoords = {
          lat: event.latLng.lat(),
          lng: event.latLng.lng()
        }

        // Actualizar o crear marcador
        if (markerRef.current) {
          markerRef.current.setPosition(clickedCoords)
        } else {
          markerRef.current = new window.google.maps.Marker({
            position: clickedCoords,
            map: mapInstanceRef.current,
            draggable: true,
            title: 'Ubicación del cliente'
          })

          // Configurar evento drag para nuevo marcador
          markerRef.current.addListener('dragend', (event: any) => {
            const newCoords = {
              lat: event.latLng.lat(),
              lng: event.latLng.lng()
            }
            onCoordenadasChange(newCoords)
          })
        }

        onCoordenadasChange(clickedCoords)

        // Reverse geocoding
        const geocoder = new window.google.maps.Geocoder()
        geocoder.geocode({ location: clickedCoords }, (results: any, status: any) => {
          if (status === 'OK' && results[0]) {
            const address = results[0].formatted_address
            setSearchValue(address)
            onDireccionChange?.(address)
          }
        })
      })

      setIsLoading(false)
    } catch (err) {
      console.error('Error initializing Google Maps:', err)
      setError('Error al cargar el mapa')
      setIsLoading(false)
    }
  }, [coordenadas, onCoordenadasChange, onDireccionChange])

  // Inicializar autocomplete
  const initializeAutocomplete = useCallback(() => {
    if (!window.google || !inputRef.current) {
      console.warn('[GoogleMapSelector] No se puede inicializar autocomplete: Google Maps o input no disponible')
      return
    }

    // Si ya existe un autocomplete, no reinicializar
    if (autocompleteRef.current) {
      console.log('[GoogleMapSelector] Autocomplete ya existe, no reinicializando')
      return
    }

    try {
      // Crear nuevo autocomplete
      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'ar' }, // Restringir a Argentina
        fields: ['formatted_address', 'geometry', 'place_id'],
        types: ['address']
      })

      console.log('[GoogleMapSelector] Autocomplete inicializado correctamente')

      // Agregar listener para cuando se selecciona un lugar
      autocompleteRef.current.addListener('place_changed', () => {
        console.log('[GoogleMapSelector] Evento place_changed disparado')
        const place = autocompleteRef.current?.getPlace()

        // Validar que place existe y tiene geometry válida
        if (!place || !place.geometry || !place.geometry.location) {
          console.warn('Place seleccionado no tiene geometría válida:', place)
          return
        }

        try {
          const coords = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng()
          }

          console.log('[GoogleMapSelector] Lugar seleccionado:', {
            direccion: place.formatted_address,
            coordenadas: coords
          })

          // Función para actualizar mapa y marcador
          const updateMapAndMarker = () => {
            if (!mapInstanceRef.current) {
              console.warn('[GoogleMapSelector] Mapa no está inicializado, reintentando...')
              // Reintentar después de un pequeño delay
              setTimeout(updateMapAndMarker, 100)
              return
            }

            console.log('[GoogleMapSelector] Actualizando mapa con coordenadas:', coords)
            mapInstanceRef.current.setCenter(coords)
            mapInstanceRef.current.setZoom(15)

            if (markerRef.current) {
              // Actualizar posición del marcador existente
              markerRef.current.setPosition(coords)
              console.log('[GoogleMapSelector] Marcador actualizado')
            } else {
              // Crear nuevo marcador
              markerRef.current = new window.google.maps.Marker({
                position: coords,
                map: mapInstanceRef.current,
                draggable: true,
                title: 'Ubicación del cliente',
                animation: window.google.maps.Animation.DROP
              })
              console.log('[GoogleMapSelector] Marcador creado')

              markerRef.current.addListener('dragend', (event: any) => {
                const newCoords = {
                  lat: event.latLng.lat(),
                  lng: event.latLng.lng()
                }
                console.log('[GoogleMapSelector] Marcador arrastrado a:', newCoords)
                onCoordenadasChange(newCoords)
              })
            }
          }

          // Actualizar estado del formulario primero
          onCoordenadasChange(coords)
          setSearchValue(place.formatted_address || '')
          onDireccionChange?.(place.formatted_address || '')

          // Actualizar mapa y marcador (con reintento si es necesario)
          updateMapAndMarker()
        } catch (err) {
          console.error('Error procesando lugar seleccionado:', err)
        }
      })
    } catch (err) {
      console.error('Error initializing autocomplete:', err)
    }
  }, [onCoordenadasChange, onDireccionChange])

  // Efecto para inicializar mapa cuando Google Maps está disponible
  useEffect(() => {
    let timeoutId: NodeJS.Timeout
    let retryCount = 0
    const maxRetries = 30 // 15 segundos máximo
    let mapsLoaded = false

    const checkGoogleMaps = () => {
      console.log(`[GoogleMapSelector] Checking Google Maps... (${retryCount}/${maxRetries})`)
      console.log('[GoogleMapSelector] Available APIs:', {
        windowGoogle: !!window.google,
        windowGoogleMaps: !!(window.google && window.google.maps),
        windowGoogleMapsMap: !!(window.google && window.google.maps && window.google.maps.Map),
        windowGoogleMapsPlaces: !!(window.google && window.google.maps && window.google.maps.places),
        windowGoogleMapsPlacesAutocomplete: !!(window.google && window.google.maps && window.google.maps.places && window.google.maps.places.Autocomplete)
      })

      // Verificar que todas las APIs necesarias estén disponibles
      if (window.google && window.google.maps && window.google.maps.Map && window.google.maps.places && window.google.maps.places.Autocomplete) {
        if (!mapsLoaded) {
          mapsLoaded = true
          console.log('[GoogleMapSelector] ✅ All Google Maps APIs loaded successfully')
          setError(null) // Limpiar cualquier error anterior
          
          // Inicializar mapa primero
          initializeMap()
          
          // Inicializar autocomplete después de un pequeño delay para asegurar que el mapa esté listo
          setTimeout(() => {
            if (inputRef.current && !autocompleteRef.current) {
              initializeAutocomplete()
            }
          }, 200)
        }
        return true // Indicar que ya está listo
      }
      return false
    }

    const checkGoogleMapsLoop = () => {
      if (checkGoogleMaps()) return // Ya está listo

      if (retryCount < maxRetries) {
        retryCount++
        console.log(`[GoogleMapSelector] Waiting for Google Maps API... (${retryCount}/${maxRetries})`)
        timeoutId = setTimeout(checkGoogleMapsLoop, 500)
      } else {
        console.error('[GoogleMapSelector] Google Maps API failed to load after maximum retries')
        console.error('[GoogleMapSelector] Final state:', {
          windowGoogle: !!window.google,
          windowGoogleMaps: !!(window.google && window.google.maps),
          windowGoogleMapsMap: !!(window.google && window.google.maps && window.google.maps.Map),
          windowGoogleMapsPlaces: !!(window.google && window.google.maps && window.google.maps.places),
          windowGoogleMapsPlacesAutocomplete: !!(window.google && window.google.maps && window.google.maps.places && window.google.maps.places.Autocomplete),
          apiKeyConfigured: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
          scriptElements: Array.from(document.querySelectorAll('script')).filter(s => s.src.includes('maps.googleapis.com')).length,
          currentUrl: window.location.href
        })
        setError('Google Maps no se pudo cargar completamente. Las APIs necesarias (Map, Places, Autocomplete) no están disponibles.')
        setIsLoading(false)
      }
    }

    // Listener para el evento personalizado de carga de Google Maps
    const handleGoogleMapsLoaded = (event: any) => {
      console.log('[GoogleMapSelector] Received google-maps-loaded event:', event.detail)
      if (!mapsLoaded) {
        mapsLoaded = true
        setError(null)
        
        // Inicializar mapa primero
        initializeMap()
        
        // Inicializar autocomplete después de un pequeño delay para asegurar que el mapa esté listo
        setTimeout(() => {
          if (inputRef.current && !autocompleteRef.current) {
            initializeAutocomplete()
          }
        }, 200)
      }
    }

    // Agregar listener para evento personalizado
    window.addEventListener('google-maps-loaded', handleGoogleMapsLoaded)

    // Pequeño delay inicial para asegurar que el DOM esté listo
    const initialDelay = setTimeout(() => {
      if (!window.google) {
        console.warn('[GoogleMapSelector] Google Maps script not loaded - check API key configuration')
        setError('Google Maps script no se cargó. Verifica la configuración de la API key.')
        setIsLoading(false)
        return
      }

      checkGoogleMapsLoop()
    }, 1000)

    return () => {
      clearTimeout(initialDelay)
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      window.removeEventListener('google-maps-loaded', handleGoogleMapsLoaded)
    }
  }, [initializeMap, initializeAutocomplete])

  // Actualizar búsqueda cuando cambia la dirección externa
  useEffect(() => {
    if (direccion !== searchValue) {
      setSearchValue(direccion)
    }
  }, [direccion])

  // Centrar mapa cuando cambian las coordenadas externamente
  useEffect(() => {
    if (mapInstanceRef.current && coordenadas) {
      console.log('[GoogleMapSelector] Coordenadas cambiaron externamente:', coordenadas)
      mapInstanceRef.current.setCenter(coordenadas)
      mapInstanceRef.current.setZoom(15)

      if (markerRef.current) {
        // Actualizar posición del marcador existente
        markerRef.current.setPosition(coordenadas)
        console.log('[GoogleMapSelector] Marcador actualizado desde coordenadas externas')
      } else {
        // Crear marcador si no existe
        markerRef.current = new window.google.maps.Marker({
          position: coordenadas,
          map: mapInstanceRef.current,
          draggable: true,
          title: 'Ubicación del cliente',
          animation: window.google.maps.Animation.DROP
        })
        console.log('[GoogleMapSelector] Marcador creado desde coordenadas externas')

        // Agregar listener para cuando se arrastra el marcador
        markerRef.current.addListener('dragend', (event: any) => {
          const newCoords = {
            lat: event.latLng.lat(),
            lng: event.latLng.lng()
          }
          console.log('[GoogleMapSelector] Marcador arrastrado a:', newCoords)
          onCoordenadasChange(newCoords)
        })
      }
    }
  }, [coordenadas, onCoordenadasChange])

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocalización no está disponible en este navegador')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        }

        onCoordenadasChange(coords)

        // Centrar mapa
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setCenter(coords)
          mapInstanceRef.current.setZoom(15)

          if (markerRef.current) {
            markerRef.current.setPosition(coords)
          }
        }

        // Reverse geocoding
        if (window.google && window.google.maps) {
          const geocoder = new window.google.maps.Geocoder()
          geocoder.geocode({ location: coords }, (results: any, status: any) => {
            if (status === 'OK' && results[0]) {
              const address = results[0].formatted_address
              setSearchValue(address)
              onDireccionChange?.(address)
            }
          })
        }
      },
      (err) => {
        // Manejar diferentes tipos de errores de geolocalización
        let errorMessage = 'Error al obtener la ubicación actual'
        
        // Validar que err existe y tiene propiedades útiles
        if (err && typeof err === 'object' && Object.keys(err).length > 0) {
          // Verificar si tiene código de error de geolocalización
          if (typeof err.code === 'number') {
            switch (err.code) {
              case 1: // PERMISSION_DENIED
                errorMessage = 'Permiso de ubicación denegado. Por favor, permite el acceso a tu ubicación.'
                break
              case 2: // POSITION_UNAVAILABLE
                errorMessage = 'Ubicación no disponible'
                break
              case 3: // TIMEOUT
                errorMessage = 'Tiempo de espera agotado al obtener la ubicación'
                break
              default:
                errorMessage = 'Error al obtener la ubicación actual'
            }
          }
          
          // Solo loggear si hay información útil
          if (err.message || (typeof err.code === 'number')) {
            console.error('Error getting location:', {
              code: err.code,
              message: err.message || errorMessage
            })
          }
        } else {
          // Si el error está vacío o no tiene información, no loggear nada
          // Solo mostrar un mensaje genérico al usuario
          console.warn('Error de geolocalización sin información detallada')
        }
        
        setError(errorMessage)
      }
    )
  }

  if (error) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-800">
              <MapPin className="h-4 w-4" />
              <span className="text-sm font-medium">Mapa no disponible</span>
            </div>
            <p className="text-sm text-amber-700 mt-2">
              {error}
            </p>
            <p className="text-xs text-amber-600 mt-2">
              Puedes continuar ingresando la dirección manualmente abajo.
            </p>
          </CardContent>
        </Card>

        {/* Campo de dirección manual como fallback */}
        <div className="space-y-2">
          <Label htmlFor="manual-address">Dirección *</Label>
          <Input
            id="manual-address"
            type="text"
            placeholder="Ej: Av. Sarmiento 1234, Monteros"
            value={searchValue}
            onChange={(e) => {
              setSearchValue(e.target.value)
              onDireccionChange?.(e.target.value)
            }}
          />
          <p className="text-xs text-muted-foreground">
            Ingresa la dirección completa del cliente. El mapa se habilitará automáticamente cuando se resuelva el problema de configuración.
          </p>
        </div>

        {/* Mostrar coordenadas si están disponibles */}
        {coordenadas && (
          <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span>
                Coordenadas guardadas: Lat {coordenadas.lat.toFixed(6)}, Lng {coordenadas.lng.toFixed(6)}
              </span>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Campo de búsqueda */}
      <div className="space-y-2">
        <Label htmlFor="map-search">Buscar dirección</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              id="map-search"
              type="text"
              placeholder={placeholder}
              value={searchValue}
              onChange={(e) => {
                setSearchValue(e.target.value)
                onDireccionChange?.(e.target.value)
              }}
              className="pl-9"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCurrentLocation}
            title="Usar ubicación actual"
          >
            <Crosshair className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mapa */}
      <Card>
        <CardContent className="p-0">
          <div className="relative">
            {isLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-sm rounded-lg">
                <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Cargando mapa...
                </div>
              </div>
            )}
            <div
              ref={mapRef}
              className="w-full h-[300px] rounded-lg"
              style={{ minHeight: '300px' }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Coordenadas actuales */}
      {coordenadas && (
        <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span>
              Lat: {coordenadas.lat.toFixed(6)}, Lng: {coordenadas.lng.toFixed(6)}
            </span>
          </div>
        </div>
      )}

      {/* Instrucciones */}
      <div className="text-xs text-muted-foreground">
        <p>• Escribe una dirección para buscar o haz clic en el mapa para seleccionar la ubicación</p>
        <p>• Arrastra el marcador para ajustar la posición exacta</p>
      </div>
    </div>
  )
}
