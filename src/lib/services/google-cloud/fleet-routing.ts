/**
 * Google Maps Fleet Routing API Integration
 * 
 * Integración con Google Maps Fleet Routing API para optimización avanzada de rutas
 * considerando múltiples vehículos, capacidades y restricciones.
 */

import { getAccessToken, isGoogleCloudConfigured } from './auth'
import { config } from '@/lib/config'

export interface FleetRoutingVehicle {
  id: string
  startLocation: { lat: number; lng: number }
  endLocation?: { lat: number; lng: number }
  capacity?: number // Capacidad en kg
  type?: string // Tipo de vehículo (Fiorino, Hilux, F-4000)
}

export interface FleetRoutingShipment {
  id: string
  pickupLocation: { lat: number; lng: number }
  deliveryLocation: { lat: number; lng: number }
  weight?: number // Peso en kg
  duration?: number // Duración estimada en minutos
  timeWindows?: {
    start: string // ISO 8601
    end: string // ISO 8601
  }
}

export interface FleetRoutingOptions {
  vehicles: FleetRoutingVehicle[]
  shipments: FleetRoutingShipment[]
  objectives?: {
    minimizeDistance?: boolean
    minimizeTime?: boolean
    minimizeFuel?: boolean
  }
}

export interface FleetRoutingResponse {
  success: boolean
  routes?: Array<{
    vehicleId: string
    route: Array<{
      shipmentId: string
      type: 'pickup' | 'delivery'
      location: { lat: number; lng: number }
      estimatedArrival?: string
    }>
    totalDistance?: number // en km
    totalTime?: number // en minutos
    totalWeight?: number // en kg
  }>
  metrics?: {
    totalDistance: number
    totalTime: number
    totalFuel?: number
    savings?: {
      distance?: number // % de ahorro
      time?: number // % de ahorro
      fuel?: number // % de ahorro
    }
  }
  error?: string
}

const FLEET_ROUTING_API_URL = 'https://fleetrouting.googleapis.com/v1'

/**
 * Verifica si Fleet Routing API está disponible
 */
export function isFleetRoutingAvailable(): boolean {
  return (
    isGoogleCloudConfigured() &&
    !!config.googleCloud.maps.fleetRoutingApiKey &&
    !!config.googleCloud.projectId
  )
}

/**
 * Optimiza rutas usando Google Maps Fleet Routing API
 */
export async function optimizeFleetRouting(
  options: FleetRoutingOptions
): Promise<FleetRoutingResponse> {
  if (!isFleetRoutingAvailable()) {
    return {
      success: false,
      error: 'Fleet Routing API no está configurada. Verifica GOOGLE_MAPS_FLEET_ROUTING_API_KEY y GOOGLE_CLOUD_PROJECT_ID'
    }
  }

  try {
    const accessToken = await getAccessToken()
    const projectId = config.googleCloud.projectId

    // Construir request body según la API de Fleet Routing
    const requestBody = {
      parent: `projects/${projectId}`,
      vehicles: options.vehicles.map(v => ({
        id: v.id,
        startLocation: {
          latitude: v.startLocation.lat,
          longitude: v.startLocation.lng
        },
        endLocation: v.endLocation ? {
          latitude: v.endLocation.lat,
          longitude: v.endLocation.lng
        } : undefined,
        capacity: v.capacity ? [v.capacity] : undefined, // Array de capacidades por dimensión
        type: v.type
      })),
      shipments: options.shipments.map(s => ({
        id: s.id,
        pickupLocation: {
          latitude: s.pickupLocation.lat,
          longitude: s.pickupLocation.lng
        },
        deliveryLocation: {
          latitude: s.deliveryLocation.lat,
          longitude: s.deliveryLocation.lng
        },
        weight: s.weight ? [s.weight] : undefined,
        duration: s.duration ? `${s.duration * 60}s` : undefined, // Convertir a segundos
        timeWindows: s.timeWindows ? [{
          startTime: s.timeWindows.start,
          endTime: s.timeWindows.end
        }] : undefined
      })),
      objectives: options.objectives ? {
        minimizeDistance: options.objectives.minimizeDistance,
        minimizeTime: options.objectives.minimizeTime,
        minimizeFuel: options.objectives.minimizeFuel
      } : undefined
    }

    const response = await fetch(`${FLEET_ROUTING_API_URL}/optimizeRoutes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: `Fleet Routing API error: ${response.status} - ${errorData.error?.message || response.statusText}`
      }
    }

    const data = await response.json()

    // Parsear respuesta
    const routes = data.routes?.map((route: any) => ({
      vehicleId: route.vehicleId,
      route: route.visits?.map((visit: any) => ({
        shipmentId: visit.shipmentId,
        type: visit.type || 'delivery',
        location: {
          lat: visit.location?.latitude || 0,
          lng: visit.location?.longitude || 0
        },
        estimatedArrival: visit.estimatedArrival
      })) || [],
      totalDistance: route.totalDistance ? route.totalDistance / 1000 : undefined, // Convertir a km
      totalTime: route.totalTime ? route.totalTime / 60 : undefined, // Convertir a minutos
      totalWeight: route.totalWeight?.[0] || undefined
    })) || []

    const metrics = {
      totalDistance: data.metrics?.totalDistance ? data.metrics.totalDistance / 1000 : 0,
      totalTime: data.metrics?.totalTime ? data.metrics.totalTime / 60 : 0,
      totalFuel: data.metrics?.totalFuel,
      savings: data.metrics?.savings ? {
        distance: data.metrics.savings.distance,
        time: data.metrics.savings.time,
        fuel: data.metrics.savings.fuel
      } : undefined
    }

    return {
      success: true,
      routes,
      metrics
    }
  } catch (error: any) {
    console.error('Error al consultar Fleet Routing API:', error)
    return {
      success: false,
      error: error.message || 'Error desconocido al consultar Fleet Routing API'
    }
  }
}

