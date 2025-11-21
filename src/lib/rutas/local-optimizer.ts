/**
 * Local Route Optimizer (Fallback)
 * 
 * Implementa algoritmo Nearest Neighbor + 2-opt para optimización de rutas
 * cuando Google Directions no está disponible.
 * 
 * Complejidad: O(n^2) para n clientes (adecuado para 5-50 paradas)
 */

export interface Point {
  lat: number
  lng: number
  id?: string
  [key: string]: any
}

export interface OptimizedRoute {
  orderedPoints: Point[]
  totalDistance: number // en kilómetros
  estimatedDuration: number // en minutos
  polyline?: string // encoded polyline (se genera en el frontend con Leaflet)
}

/**
 * Calcula distancia Haversine entre dos puntos (en kilómetros)
 */
export function haversineDistance(p1: Point, p2: Point): number {
  const R = 6371 // Radio de la Tierra en kilómetros
  const dLat = toRadians(p2.lat - p1.lat)
  const dLng = toRadians(p2.lng - p1.lng)
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(p1.lat)) *
      Math.cos(toRadians(p2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * Algoritmo Nearest Neighbor (vecino más cercano)
 * Encuentra un orden inicial de puntos visitando siempre el más cercano no visitado
 */
function nearestNeighbor(origin: Point, points: Point[]): Point[] {
  if (points.length === 0) return []
  
  const visited = new Set<string>()
  const ordered: Point[] = []
  let current = origin
  
  while (ordered.length < points.length) {
    let nearest: Point | null = null
    let minDistance = Infinity
    
    for (const point of points) {
      const pointKey = point.id || `${point.lat},${point.lng}`
      if (visited.has(pointKey)) continue
      
      const distance = haversineDistance(current, point)
      if (distance < minDistance) {
        minDistance = distance
        nearest = point
      }
    }
    
    if (nearest) {
      const nearestKey = nearest.id || `${nearest.lat},${nearest.lng}`
      visited.add(nearestKey)
      ordered.push(nearest)
      current = nearest
    } else {
      break
    }
  }
  
  return ordered
}

/**
 * Algoritmo 2-opt: mejora una ruta intercambiando aristas
 * Intenta mejorar el orden encontrado por Nearest Neighbor
 */
function twoOptImprovement(route: Point[]): Point[] {
  if (route.length < 4) return route // 2-opt requiere al menos 4 puntos
  
  let improved = true
  let bestRoute = [...route]
  let bestDistance = calculateTotalDistance(bestRoute)
  
  while (improved) {
    improved = false
    
    for (let i = 1; i < bestRoute.length - 2; i++) {
      for (let j = i + 1; j < bestRoute.length; j++) {
        if (j - i === 1) continue // No invertir aristas adyacentes
        
        // Crear nueva ruta invirtiendo el segmento entre i y j
        const newRoute = [
          ...bestRoute.slice(0, i),
          ...bestRoute.slice(i, j + 1).reverse(),
          ...bestRoute.slice(j + 1)
        ]
        
        const newDistance = calculateTotalDistance(newRoute)
        
        if (newDistance < bestDistance) {
          bestRoute = newRoute
          bestDistance = newDistance
          improved = true
        }
      }
    }
  }
  
  return bestRoute
}

/**
 * Calcula la distancia total de una ruta
 */
function calculateTotalDistance(route: Point[]): number {
  if (route.length < 2) return 0
  
  let total = 0
  for (let i = 0; i < route.length - 1; i++) {
    total += haversineDistance(route[i], route[i + 1])
  }
  return total
}

/**
 * Optimiza una ruta usando Nearest Neighbor + 2-opt
 * 
 * @param origin Punto de origen (almacén/sucursal)
 * @param destination Punto de destino (opcional, si no se proporciona, vuelve al origen)
 * @param waypoints Puntos intermedios a visitar
 * @returns Ruta optimizada con orden de visita, distancia total y duración estimada
 */
export function optimizeRouteLocal(
  origin: Point,
  waypoints: Point[],
  destination?: Point
): OptimizedRoute {
  if (waypoints.length === 0) {
    return {
      orderedPoints: destination ? [origin, destination] : [origin],
      totalDistance: destination ? haversineDistance(origin, destination) : 0,
      estimatedDuration: 0
    }
  }
  
  // Si solo hay un waypoint, no hay optimización que hacer
  if (waypoints.length === 1) {
    const points = destination ? [origin, ...waypoints, destination] : [origin, ...waypoints]
    const distance = calculateTotalDistance(points)
    return {
      orderedPoints: points,
      totalDistance: distance,
      estimatedDuration: Math.round((distance / 30) * 60) // 30 km/h promedio en ciudad
    }
  }
  
  // Aplicar Nearest Neighbor
  const nnRoute = nearestNeighbor(origin, waypoints)
  
  // Aplicar 2-opt para mejorar
  const optimizedRoute = twoOptImprovement([origin, ...nnRoute])
  
  // Agregar destino si se proporciona
  const finalRoute = destination 
    ? [...optimizedRoute, destination]
    : optimizedRoute
  
  // Calcular distancia total
  const totalDistance = calculateTotalDistance(finalRoute)
  
  // Estimar duración (promedio 30 km/h en ciudad, más tiempo por parada)
  const baseTime = (totalDistance / 30) * 60 // minutos
  const stopTime = waypoints.length * 5 // 5 minutos por parada
  const estimatedDuration = Math.round(baseTime + stopTime)
  
  return {
    orderedPoints: finalRoute,
    totalDistance: Math.round(totalDistance * 100) / 100, // Redondear a 2 decimales
    estimatedDuration
  }
}

/**
 * Genera un polyline simple para Leaflet (formato básico)
 * Nota: Para producción, usar una librería como @mapbox/polyline
 */
export function generateSimplePolyline(points: Point[]): string {
  // Formato simple: "lat1,lng1;lat2,lng2;..."
  return points.map(p => `${p.lat},${p.lng}`).join(';')
}

