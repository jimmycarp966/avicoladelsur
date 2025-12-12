'use server'

import type { SupabaseClient } from '@supabase/supabase-js'

import { config } from '@/lib/config'
import { getGoogleDirections, isGoogleDirectionsAvailable } from '@/lib/rutas/google-directions'
import {
  optimizeRouteLocal,
  generateSimplePolyline,
  type Point,
} from '@/lib/rutas/local-optimizer'
import { optimizeFleetRouting, isFleetRoutingAvailable, type FleetRoutingOptions } from '@/lib/services/google-cloud/fleet-routing'
import { optimizeRoutes, isOptimizationAvailable, type OptimizationOptions } from '@/lib/services/google-cloud/optimization'
import type { Database } from '@/types/database.types'

type GenerateRutaOptions = {
  supabase: SupabaseClient<Database>
  rutaId: string
  usarGoogle?: boolean
}

export async function generateRutaOptimizada({
  supabase,
  rutaId,
  usarGoogle = false,
}: GenerateRutaOptions) {
  // Obtener información de la ruta
  const { data: ruta, error: rutaError } = await supabase
    .from('rutas_reparto')
    .select('id, fecha_ruta, zona_id, vehiculo_id')
    .eq('id', rutaId)
    .single()

  if (rutaError || !ruta) {
    throw new Error('Ruta no encontrada para generar optimización')
  }

  // Obtener detalles de ruta con pedidos y coordenadas
  const { data: detalles, error: detallesError } = await supabase
    .from('detalles_ruta')
    .select(
      `
        id,
        pedido_id,
        orden_entrega,
        pedidos (
          id,
          cliente_id,
          clientes (
            id,
            nombre,
            coordenadas
          )
        )
      `
    )
    .eq('ruta_id', rutaId)
    .order('orden_entrega', { ascending: true })

  if (detallesError) {
    throw new Error('Error al obtener detalles de ruta')
  }

  if (!detalles || detalles.length === 0) {
    throw new Error('La ruta no tiene pedidos asignados para optimizar')
  }
  if (detalles.length === 0) {
    throw new Error('La ruta no tiene pedidos asignados para optimizar')
  }

  const waypoints: Point[] = []

  for (const detalle of detalles as any[]) {
    const pedido = detalle.pedidos
    const clienteId = pedido?.cliente_id

    // Si el pedido tiene cliente_id, usar RPC para obtener coordenadas
    if (clienteId) {
      const { data: clienteRpc, error: clienteError } = await supabase
        .rpc('fn_get_cliente_con_coordenadas', { p_cliente_id: clienteId })
        .single()

      if (!clienteError && clienteRpc) {
        const clienteData = clienteRpc as any
        if (clienteData.lat !== null && clienteData.lng !== null) {
          waypoints.push({
            lat: clienteData.lat,
            lng: clienteData.lng,
            id: detalle.id,
            detalleRutaId: detalle.id,
            pedidoId: detalle.pedido_id,
            clienteId: clienteData.id,
            nombreCliente: clienteData.nombre,
          })
        }
      }
    } else if (pedido?.id) {
      // Si el pedido no tiene cliente directo, buscar en entregas (pedidos agrupados)
      const { data: entregas } = await supabase
        .from('entregas')
        .select('id, cliente_id, orden_entrega')
        .eq('pedido_id', pedido.id)
        .order('orden_entrega', { ascending: true })

      if (entregas && entregas.length > 0) {
        for (const entrega of entregas as any[]) {
          if (!entrega.cliente_id) continue

          // Usar RPC para obtener coordenadas ya procesadas
          const { data: clienteRpc, error: clienteError } = await supabase
            .rpc('fn_get_cliente_con_coordenadas', { p_cliente_id: entrega.cliente_id })
            .single()

          if (clienteError || !clienteRpc) continue

          const clienteData = clienteRpc as any
          if (clienteData.lat === null || clienteData.lng === null) continue

          waypoints.push({
            lat: clienteData.lat,
            lng: clienteData.lng,
            id: entrega.id,
            detalleRutaId: detalle.id,
            pedidoId: detalle.pedido_id,
            clienteId: clienteData.id,
            nombreCliente: clienteData.nombre,
          })
        }
      }
    }
  }

  if (waypoints.length === 0) {
    throw new Error('No hay coordenadas válidas para optimizar la ruta')
  }

  const homeBase = config.rutas.homeBase
  const origin: Point = {
    lat: homeBase.lat,
    lng: homeBase.lng,
    id: 'home-base-origin',
    nombreCliente: homeBase.nombre,
  }
  const destination = config.rutas.returnToBase
    ? {
      lat: homeBase.lat,
      lng: homeBase.lng,
      id: 'home-base-destination',
      nombreCliente: homeBase.nombre,
    }
    : waypoints[waypoints.length - 1]

  let ordenVisita: any[] = []
  let polyline = ''
  let distanciaTotal = 0
  let duracionTotal = 0
  let optimizadaPor: 'google' | 'local' = 'local'

  const puedeUsarGoogle = usarGoogle && isGoogleDirectionsAvailable()

  if (puedeUsarGoogle) {
    const googleResult = await getGoogleDirections({
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      waypoints: waypoints.slice(1, -1),
      optimize: waypoints.length > 2,
    })

    if (googleResult.success && googleResult.orderedStops) {
      ordenVisita = mapOrderedStops(googleResult.orderedStops, waypoints)
      polyline = googleResult.polyline || ''
      distanciaTotal = (googleResult.distance || 0) / 1000
      duracionTotal = Math.round((googleResult.duration || 0) / 60)
      optimizadaPor = 'google'
    } else {
      console.warn('Google Directions no disponible, usando fallback local:', googleResult.error)
    }
  }

  if (optimizadaPor === 'local' || ordenVisita.length === 0) {
    const localResult = optimizeRouteLocal(origin, waypoints, destination)
    ordenVisita = localResult.orderedPoints
      .filter((punto) => punto.detalleRutaId)
      .map((punto, index) => ({
        detalle_ruta_id: punto.detalleRutaId,
        pedido_id: punto.pedidoId,
        cliente_id: punto.clienteId,
        cliente_nombre: punto.nombreCliente,
        lat: punto.lat,
        lng: punto.lng,
        orden: index + 1,
      }))

    polyline = generateSimplePolyline(localResult.orderedPoints)
    distanciaTotal = localResult.totalDistance
    duracionTotal = localResult.estimatedDuration
  }

  // Actualizar ruta_planificada
  const { data: rutaPlanificada, error: saveError } = await (supabase as any)
    .from('rutas_planificadas')
    .upsert(
      {
        ruta_reparto_id: rutaId,
        fecha: (ruta as any).fecha_ruta,
        zona_id: (ruta as any).zona_id,
        vehiculo_id: (ruta as any).vehiculo_id,
        estado: 'optimizada',
        orden_visita: ordenVisita,
        polyline,
        distancia_total_km: distanciaTotal,
        duracion_total_min: duracionTotal,
        optimizada_por: optimizadaPor,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'ruta_reparto_id' }
    )
    .select()
    .single()

  if (saveError) {
    throw saveError
  }

  // Sincronizar tiempo y distancia estimados en rutas_reparto
  const { error: updateRutaError } = await supabase
    .from('rutas_reparto')
    .update({
      tiempo_estimado_min: duracionTotal,
      distancia_estimada_km: distanciaTotal,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rutaId)

  if (updateRutaError) {
    console.warn('Error al actualizar tiempo estimado en ruta:', updateRutaError)
    // No lanzamos error porque la optimización ya se guardó en rutas_planificadas
  }

  return {
    rutaPlanificadaId: rutaPlanificada.id,
    ordenVisita,
    polyline,
    distanciaTotalKm: distanciaTotal,
    duracionTotalMin: duracionTotal,
    optimizadaPor,
  }
}

/**
 * Opciones para optimización avanzada
 */
export interface AdvancedOptimizationOptions {
  objetivos?: {
    minimizarDistancia?: boolean
    minimizarTiempo?: boolean
    minimizarCombustible?: boolean
    respetarHorarios?: boolean
  }
  restricciones?: {
    capacidadVehiculo?: number
    horarioRepartidor?: {
      inicio: string // HH:mm
      fin: string // HH:mm
    }
    clientesUrgentes?: string[] // IDs de clientes que deben ser primeros
  }
}

/**
 * Resultado de optimización avanzada
 */
export interface AdvancedOptimizationResult {
  success: boolean
  ordenVisita: any[]
  polyline: string
  distanciaTotalKm: number
  duracionTotalMin: number
  optimizadaPor: 'fleet-routing' | 'optimization' | 'google' | 'local'
  metricas?: {
    ahorroDistancia?: number // % de ahorro
    ahorroTiempo?: number // % de ahorro
    ahorroCombustible?: number // $ ahorrado
    distanciaOriginal?: number
    tiempoOriginal?: number
  }
  error?: string
}

/**
 * Genera ruta optimizada usando servicios avanzados de Google Cloud
 */
export async function generateRutaOptimizadaAvanzada({
  supabase,
  rutaId,
  options,
}: {
  supabase: SupabaseClient<Database>
  rutaId: string
  options?: AdvancedOptimizationOptions
}): Promise<AdvancedOptimizationResult> {
  // Obtener información de la ruta y vehículo
  const { data: ruta, error: rutaError } = await supabase
    .from('rutas_reparto')
    .select(`
      id,
      fecha_ruta,
      zona_id,
      vehiculo_id,
      distancia_estimada_km,
      tiempo_estimado_min,
      vehiculos (
        id,
        capacidad_kg,
        marca,
        modelo
      )
    `)
    .eq('id', rutaId)
    .single()

  if (rutaError || !ruta) {
    return {
      success: false,
      error: 'Ruta no encontrada',
      ordenVisita: [],
      polyline: '',
      distanciaTotalKm: 0,
      duracionTotalMin: 0,
      optimizadaPor: 'local'
    }
  }

  // Obtener detalles de ruta con pedidos y coordenadas
  const { data: detalles, error: detallesError } = await supabase
    .from('detalles_ruta')
    .select(`
      id,
      pedido_id,
      orden_entrega,
      pedidos (
        cliente_id,
        clientes (
          id,
          nombre,
          coordenadas
        )
      )
    `)
    .eq('ruta_id', rutaId)
    .order('orden_entrega', { ascending: true })

  if (detallesError || !detalles || detalles.length === 0) {
    return {
      success: false,
      error: 'La ruta no tiene pedidos asignados',
      ordenVisita: [],
      polyline: '',
      distanciaTotalKm: 0,
      duracionTotalMin: 0,
      optimizadaPor: 'local'
    }
  }

  const waypoints: Point[] = []
  const clientesUrgentes = options?.restricciones?.clientesUrgentes || []

  for (const detalle of detalles as any[]) {
    const pedido = detalle.pedidos
    const clienteId = pedido?.cliente_id

    // Si el pedido tiene cliente_id, usar RPC para obtener coordenadas
    if (clienteId) {
      const { data: clienteRpc, error: clienteError } = await supabase
        .rpc('fn_get_cliente_con_coordenadas', { p_cliente_id: clienteId })
        .single()

      if (!clienteError && clienteRpc) {
        const clienteData = clienteRpc as any
        if (clienteData.lat !== null && clienteData.lng !== null) {
          waypoints.push({
            lat: clienteData.lat,
            lng: clienteData.lng,
            id: detalle.id,
            detalleRutaId: detalle.id,
            pedidoId: detalle.pedido_id,
            clienteId: clienteData.id,
            nombreCliente: clienteData.nombre,
          })
        }
      }
    } else if (detalle.pedido_id) {
      // Si el pedido no tiene cliente directo, buscar en entregas (pedidos agrupados)
      const { data: entregas } = await supabase
        .from('entregas')
        .select('id, cliente_id, orden_entrega')
        .eq('pedido_id', detalle.pedido_id)
        .order('orden_entrega', { ascending: true })

      if (entregas && entregas.length > 0) {
        for (const entrega of entregas as any[]) {
          if (!entrega.cliente_id) continue

          // Usar RPC para obtener coordenadas ya procesadas
          const { data: clienteRpc, error: clienteError } = await supabase
            .rpc('fn_get_cliente_con_coordenadas', { p_cliente_id: entrega.cliente_id })
            .single()

          if (clienteError || !clienteRpc) continue

          const clienteData = clienteRpc as any
          if (clienteData.lat === null || clienteData.lng === null) continue

          waypoints.push({
            lat: clienteData.lat,
            lng: clienteData.lng,
            id: entrega.id,
            detalleRutaId: detalle.id,
            pedidoId: detalle.pedido_id,
            clienteId: clienteData.id,
            nombreCliente: clienteData.nombre,
          })
        }
      }
    }
  }

  if (waypoints.length === 0) {
    return {
      success: false,
      error: 'No hay coordenadas válidas para optimizar',
      ordenVisita: [],
      polyline: '',
      distanciaTotalKm: 0,
      duracionTotalMin: 0,
      optimizadaPor: 'local'
    }
  }

  const homeBase = config.rutas.homeBase
  const origin: Point = {
    lat: homeBase.lat,
    lng: homeBase.lng,
    id: 'home-base-origin',
    nombreCliente: homeBase.nombre,
  }
  const destination = config.rutas.returnToBase
    ? {
      lat: homeBase.lat,
      lng: homeBase.lng,
      id: 'home-base-destination',
      nombreCliente: homeBase.nombre,
    }
    : waypoints[waypoints.length - 1]

  // Guardar métricas originales para comparación
  const distanciaOriginal = (ruta as any).distancia_estimada_km || 0
  const tiempoOriginal = (ruta as any).tiempo_estimado_min || 0

  // Intentar usar Optimization API primero (más avanzado)
  if (isOptimizationAvailable() && options) {
    const vehiculo = (ruta as any).vehiculos
    const capacidad = vehiculo?.capacidad_kg || options.restricciones?.capacidadVehiculo

    const optimizationOptions: OptimizationOptions = {
      vehicles: [{
        id: vehiculo?.id || (ruta as any).vehiculo_id || 'vehiculo-1',
        startLocation: { lat: origin.lat, lng: origin.lng },
        endLocation: destination ? { lat: destination.lat, lng: destination.lng } : undefined,
        capacity: capacidad,
        maxDistance: undefined, // Sin límite por defecto
        maxTime: undefined, // Sin límite por defecto
      }],
      shipments: waypoints.map((wp, index) => ({
        id: wp.detalleRutaId || `shipment-${index}`,
        pickupLocation: { lat: origin.lat, lng: origin.lng }, // Todos parten del almacén
        deliveryLocation: { lat: wp.lat, lng: wp.lng },
        priority: clientesUrgentes.includes(wp.clienteId || '') ? 10 : 1,
      })),
      objectives: {
        minimizeDistance: options.objetivos?.minimizarDistancia ?? true,
        minimizeTime: options.objetivos?.minimizarTiempo ?? true,
        minimizeCost: options.objetivos?.minimizarCombustible ?? false,
      },
      constraints: {
        respectTimeWindows: options.objetivos?.respetarHorarios ?? false,
        respectCapacity: !!capacidad,
      }
    }

    const optimizationResult = await optimizeRoutes(optimizationOptions)

    if (optimizationResult.success && optimizationResult.routes && optimizationResult.routes.length > 0) {
      const route = optimizationResult.routes[0]

      // Mapear resultados a formato esperado
      const ordenVisita = route.shipments.map((shipment, index) => {
        const waypoint = waypoints.find(wp => wp.detalleRutaId === shipment.shipmentId)
        return {
          detalle_ruta_id: shipment.shipmentId,
          pedido_id: waypoint?.pedidoId,
          cliente_id: waypoint?.clienteId,
          cliente_nombre: waypoint?.nombreCliente,
          lat: waypoint?.lat || 0,
          lng: waypoint?.lng || 0,
          orden: index + 1,
        }
      })

      // Generar polyline básico (en producción, usar la respuesta de la API)
      const orderedPoints = [origin, ...ordenVisita.map(ov => ({
        lat: ov.lat,
        lng: ov.lng
      } as Point)), destination as Point]
      const polyline = generateSimplePolyline(orderedPoints)

      const distanciaTotal = route.totalDistance || 0
      const duracionTotal = route.totalTime || 0

      // Calcular ahorros
      const ahorroDistancia = distanciaOriginal > 0
        ? ((distanciaOriginal - distanciaTotal) / distanciaOriginal) * 100
        : 0
      const ahorroTiempo = tiempoOriginal > 0
        ? ((tiempoOriginal - duracionTotal) / tiempoOriginal) * 100
        : 0
      const ahorroCombustible = distanciaTotal > 0 && distanciaOriginal > 0
        ? (distanciaOriginal - distanciaTotal) * 0.15 * 450 // Estimación: 0.15L/km * $450/L
        : 0

      return {
        success: true,
        ordenVisita,
        polyline,
        distanciaTotalKm: distanciaTotal,
        duracionTotalMin: duracionTotal,
        optimizadaPor: 'optimization',
        metricas: {
          ahorroDistancia,
          ahorroTiempo,
          ahorroCombustible,
          distanciaOriginal,
          tiempoOriginal
        }
      }
    }
  }

  // Fallback a Fleet Routing si Optimization no está disponible
  if (isFleetRoutingAvailable() && options) {
    const vehiculo = (ruta as any).vehiculos
    const capacidad = vehiculo?.capacidad_kg || options.restricciones?.capacidadVehiculo

    const fleetOptions: FleetRoutingOptions = {
      vehicles: [{
        id: vehiculo?.id || (ruta as any).vehiculo_id || 'vehiculo-1',
        startLocation: { lat: origin.lat, lng: origin.lng },
        endLocation: destination ? { lat: destination.lat, lng: destination.lng } : undefined,
        capacity: capacidad,
        type: vehiculo?.marca || 'Unknown'
      }],
      shipments: waypoints.map((wp, index) => ({
        id: wp.detalleRutaId || `shipment-${index}`,
        pickupLocation: { lat: origin.lat, lng: origin.lng },
        deliveryLocation: { lat: wp.lat, lng: wp.lng },
        priority: clientesUrgentes.includes(wp.clienteId || '') ? 10 : 1,
      })),
      objectives: {
        minimizeDistance: options.objetivos?.minimizarDistancia ?? true,
        minimizeTime: options.objetivos?.minimizarTiempo ?? true,
        minimizeFuel: options.objetivos?.minimizarCombustible ?? false,
      }
    }

    const fleetResult = await optimizeFleetRouting(fleetOptions)

    if (fleetResult.success && fleetResult.routes && fleetResult.routes.length > 0) {
      const route = fleetResult.routes[0]

      // Mapear resultados
      const ordenVisita = route.route
        .filter(r => r.type === 'delivery')
        .map((r, index) => {
          const waypoint = waypoints.find(wp => wp.detalleRutaId === r.shipmentId)
          return {
            detalle_ruta_id: r.shipmentId,
            pedido_id: waypoint?.pedidoId,
            cliente_id: waypoint?.clienteId,
            cliente_nombre: waypoint?.nombreCliente,
            lat: r.location.lat,
            lng: r.location.lng,
            orden: index + 1,
          }
        })

      const orderedPoints = [origin, ...ordenVisita.map(ov => ({
        lat: ov.lat,
        lng: ov.lng
      } as Point)), destination as Point]
      const polyline = generateSimplePolyline(orderedPoints)

      const distanciaTotal = route.totalDistance || 0
      const duracionTotal = route.totalTime || 0

      const ahorroDistancia = distanciaOriginal > 0
        ? ((distanciaOriginal - distanciaTotal) / distanciaOriginal) * 100
        : 0
      const ahorroTiempo = tiempoOriginal > 0
        ? ((tiempoOriginal - duracionTotal) / tiempoOriginal) * 100
        : 0
      const ahorroCombustible = distanciaTotal > 0 && distanciaOriginal > 0
        ? (distanciaOriginal - distanciaTotal) * 0.15 * 450
        : 0

      return {
        success: true,
        ordenVisita,
        polyline,
        distanciaTotalKm: distanciaTotal,
        duracionTotalMin: duracionTotal,
        optimizadaPor: 'fleet-routing',
        metricas: {
          ahorroDistancia,
          ahorroTiempo,
          ahorroCombustible,
          distanciaOriginal,
          tiempoOriginal
        }
      }
    }
  }

  // Fallback a Google Directions o local
  const basicResult = await generateRutaOptimizada({
    supabase,
    rutaId,
    usarGoogle: true
  })

  const ahorroDistancia = distanciaOriginal > 0
    ? ((distanciaOriginal - basicResult.distanciaTotalKm) / distanciaOriginal) * 100
    : 0
  const ahorroTiempo = tiempoOriginal > 0
    ? ((tiempoOriginal - basicResult.duracionTotalMin) / tiempoOriginal) * 100
    : 0
  const ahorroCombustible = basicResult.distanciaTotalKm > 0 && distanciaOriginal > 0
    ? (distanciaOriginal - basicResult.distanciaTotalKm) * 0.15 * 450
    : 0

  return {
    success: true,
    ordenVisita: basicResult.ordenVisita,
    polyline: basicResult.polyline,
    distanciaTotalKm: basicResult.distanciaTotalKm,
    duracionTotalMin: basicResult.duracionTotalMin,
    optimizadaPor: basicResult.optimizadaPor,
    metricas: {
      ahorroDistancia,
      ahorroTiempo,
      ahorroCombustible,
      distanciaOriginal,
      tiempoOriginal
    }
  }
}

function parseCoordinates(coords: any) {
  if (!coords) return { lat: null, lng: null }

  if (typeof coords === 'object' && 'lat' in coords && 'lng' in coords) {
    return {
      lat: typeof coords.lat === 'string' ? parseFloat(coords.lat) : coords.lat,
      lng: typeof coords.lng === 'string' ? parseFloat(coords.lng) : coords.lng,
    }
  }

  if (typeof coords === 'string' && coords.includes(',')) {
    const [latStr, lngStr] = coords.split(',')
    const lat = parseFloat(latStr)
    const lng = parseFloat(lngStr)
    return {
      lat: Number.isNaN(lat) ? null : lat,
      lng: Number.isNaN(lng) ? null : lng,
    }
  }

  return { lat: null, lng: null }
}

function mapOrderedStops(
  orderedStops: Array<{ lat: number; lng: number; waypointIndex?: number }>,
  waypoints: Point[],
) {
  return orderedStops.map((stop, index) => {
    const punto =
      waypoints.find(
        (wp) => Math.abs(wp.lat - stop.lat) < 0.001 && Math.abs(wp.lng - stop.lng) < 0.001,
      ) || waypoints[index]

    return {
      detalle_ruta_id: punto?.detalleRutaId,
      pedido_id: punto?.pedidoId,
      cliente_id: punto?.clienteId,
      cliente_nombre: punto?.nombreCliente,
      lat: punto?.lat,
      lng: punto?.lng,
      orden: index + 1,
    }
  })
}

