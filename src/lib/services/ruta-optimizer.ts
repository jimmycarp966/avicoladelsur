'use server'

import type { SupabaseClient } from '@supabase/supabase-js'

import { getGoogleDirections, isGoogleDirectionsAvailable } from '@/lib/rutas/google-directions'
import {
  optimizeRouteLocal,
  generateSimplePolyline,
  type Point,
} from '@/lib/rutas/local-optimizer'
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
    const cliente = pedido?.clientes
    const coords = cliente?.coordenadas

    if (!cliente || !coords) continue

    const { lat, lng } = parseCoordinates(coords)
    if (lat === null || lng === null) continue

    waypoints.push({
      lat,
      lng,
      id: detalle.id,
      detalleRutaId: detalle.id,
      pedidoId: detalle.pedido_id,
      clienteId: cliente.id,
      nombreCliente: cliente.nombre,
    })
  }

  if (waypoints.length === 0) {
    throw new Error('No hay coordenadas válidas para optimizar la ruta')
  }

  const origin = waypoints[0]
  const destination = waypoints[waypoints.length - 1]

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

  return {
    rutaPlanificadaId: rutaPlanificada.id,
    ordenVisita,
    polyline,
    distanciaTotalKm: distanciaTotal,
    duracionTotalMin: duracionTotal,
    optimizadaPor,
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

