/**
 * Cloud Optimization API Integration
 * 
 * Integración con Google Cloud Optimization API para resolver problemas
 * de optimización complejos con múltiples objetivos y restricciones.
 */

import { getAccessToken, isGoogleCloudConfigured } from './auth'
import { config } from '@/lib/config'

export interface OptimizationShipment {
  id: string
  pickupLocation: { lat: number; lng: number }
  deliveryLocation: { lat: number; lng: number }
  weight?: number // Peso en kg
  duration?: number // Duración estimada en minutos
  timeWindows?: {
    start: string // ISO 8601
    end: string // ISO 8601
  }
  priority?: number // Prioridad (mayor = más importante)
}

export interface OptimizationVehicle {
  id: string
  startLocation: { lat: number; lng: number }
  endLocation?: { lat: number; lng: number }
  capacity?: number // Capacidad en kg
  costPerKm?: number // Costo por km
  costPerHour?: number // Costo por hora
  maxDistance?: number // Distancia máxima en km
  maxTime?: number // Tiempo máximo en minutos
}

export interface OptimizationOptions {
  vehicles: OptimizationVehicle[]
  shipments: OptimizationShipment[]
  objectives?: {
    minimizeDistance?: boolean
    minimizeTime?: boolean
    minimizeCost?: boolean
    maximizeUtilization?: boolean
  }
  constraints?: {
    respectTimeWindows?: boolean
    respectCapacity?: boolean
    respectMaxDistance?: boolean
    respectMaxTime?: boolean
  }
}

export interface OptimizationResponse {
  success: boolean
  routes?: Array<{
    vehicleId: string
    shipments: Array<{
      shipmentId: string
      pickupOrder: number
      deliveryOrder: number
      estimatedArrival?: string
    }>
    totalDistance?: number // en km
    totalTime?: number // en minutos
    totalCost?: number
    utilization?: number // % de utilización
  }>
  metrics?: {
    totalDistance: number
    totalTime: number
    totalCost?: number
    averageUtilization?: number
    savings?: {
      distance?: number // % de ahorro vs solución inicial
      time?: number
      cost?: number
    }
  }
  error?: string
}

const OPTIMIZATION_API_URL = 'https://cloudoptimization.googleapis.com/v1'

/**
 * Verifica si Optimization API está disponible
 */
export function isOptimizationAvailable(): boolean {
  return (
    isGoogleCloudConfigured() &&
    config.googleCloud.optimization.enabled &&
    !!config.googleCloud.projectId
  )
}

/**
 * Optimiza rutas usando Cloud Optimization API
 */
export async function optimizeRoutes(
  options: OptimizationOptions
): Promise<OptimizationResponse> {
  if (!isOptimizationAvailable()) {
    return {
      success: false,
      error: 'Optimization API no está configurada o habilitada. Verifica GOOGLE_OPTIMIZATION_API_ENABLED'
    }
  }

  try {
    const accessToken = await getAccessToken()
    const projectId = config.googleCloud.projectId
    const location = config.googleCloud.region || 'southamerica-east1'

    // Construir request body según la API de Optimization
    const requestBody = {
      parent: `projects/${projectId}/locations/${location}`,
      model: {
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
          loadDemands: s.weight ? [{ amount: s.weight.toString(), type: 'weight' }] : undefined,
          deliveryDuration: s.duration ? `${s.duration * 60}s` : undefined,
          deliveryTimeWindows: s.timeWindows ? [{
            startTime: s.timeWindows.start,
            endTime: s.timeWindows.end
          }] : undefined,
          priority: s.priority
        })),
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
          capacity: v.capacity ? [{ amount: v.capacity.toString(), type: 'weight' }] : undefined,
          costPerKm: v.costPerKm,
          costPerHour: v.costPerHour,
          maxDistance: v.maxDistance ? `${v.maxDistance * 1000}m` : undefined, // Convertir a metros
          maxTime: v.maxTime ? `${v.maxTime * 60}s` : undefined // Convertir a segundos
        })),
        objectives: options.objectives ? {
          minimizeDistance: options.objectives.minimizeDistance,
          minimizeTime: options.objectives.minimizeTime,
          minimizeCost: options.objectives.minimizeCost,
          maximizeUtilization: options.objectives.maximizeUtilization
        } : undefined,
        constraints: options.constraints ? {
          respectTimeWindows: options.constraints.respectTimeWindows,
          respectCapacity: options.constraints.respectCapacity,
          respectMaxDistance: options.constraints.respectMaxDistance,
          respectMaxTime: options.constraints.respectMaxTime
        } : undefined
      }
    }

    const response = await fetch(`${OPTIMIZATION_API_URL}/projects/${projectId}/locations/${location}:optimizeRoutes`, {
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
        error: `Optimization API error: ${response.status} - ${errorData.error?.message || response.statusText}`
      }
    }

    const data = await response.json()

    // Parsear respuesta
    const routes = data.routes?.map((route: any) => ({
      vehicleId: route.vehicleId,
      shipments: route.visits?.map((visit: any, index: number) => ({
        shipmentId: visit.shipmentId,
        pickupOrder: visit.type === 'pickup' ? index + 1 : undefined,
        deliveryOrder: visit.type === 'delivery' ? index + 1 : undefined,
        estimatedArrival: visit.estimatedArrival
      })) || [],
      totalDistance: route.totalDistance ? route.totalDistance / 1000 : undefined, // Convertir a km
      totalTime: route.totalTime ? route.totalTime / 60 : undefined, // Convertir a minutos
      totalCost: route.totalCost,
      utilization: route.utilization
    })) || []

    const metrics = {
      totalDistance: data.metrics?.totalDistance ? data.metrics.totalDistance / 1000 : 0,
      totalTime: data.metrics?.totalTime ? data.metrics.totalTime / 60 : 0,
      totalCost: data.metrics?.totalCost,
      averageUtilization: data.metrics?.averageUtilization,
      savings: data.metrics?.savings ? {
        distance: data.metrics.savings.distance,
        time: data.metrics.savings.time,
        cost: data.metrics.savings.cost
      } : undefined
    }

    return {
      success: true,
      routes,
      metrics
    }
  } catch (error: any) {
    console.error('Error al consultar Optimization API:', error)
    return {
      success: false,
      error: error.message || 'Error desconocido al consultar Optimization API'
    }
  }
}

