/**
 * POST /api/reparto/ubicacion
 * 
 * Registra ubicación GPS de un repartidor
 * Auth: repartidor (solo puede insertar sus propias ubicaciones)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ubicacionRepartidorSchema } from '@/lib/schemas/reparto'

// Umbrales para alertas (en metros)
const DESVIO_UMBRAL = 200 // metros
const UMBRAL_CLIENTE = 100 // metros

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }
    
    // Verificar que sea repartidor
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()
    
    if (!usuario || usuario.rol !== 'repartidor') {
      return NextResponse.json(
        { success: false, error: 'Solo repartidores pueden registrar ubicaciones' },
        { status: 403 }
      )
    }
    
    // Validar body
    const body = await request.json()
    const validated = ubicacionRepartidorSchema.parse({
      ...body,
      repartidorId: user.id // Forzar que sea el usuario autenticado
    })
    
    // Insertar ubicación
    const { data: ubicacion, error: insertError } = await supabase
      .from('ubicaciones_repartidores')
      .insert({
        repartidor_id: validated.repartidorId,
        vehiculo_id: validated.vehiculoId,
        lat: validated.lat,
        lng: validated.lng
      })
      .select()
      .single()
    
    if (insertError) throw insertError
    
    // Verificar desvíos y cliente saltado (en background, no bloquear respuesta)
    checkAlerts(supabase, validated).catch(err => {
      console.error('Error al verificar alertas:', err)
    })
    
    return NextResponse.json({
      success: true,
      data: { ubicacionId: ubicacion.id }
    })
  } catch (error: any) {
    console.error('Error al registrar ubicación:', error)
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { success: false, error: error.message || 'Error al registrar ubicación' },
      { status: 500 }
    )
  }
}

/**
 * Verifica alertas de desvío y cliente saltado
 */
async function checkAlerts(supabase: any, ubicacion: any) {
  // Obtener ruta activa del vehículo
  const { data: rutaActiva } = await supabase
    .from('rutas_reparto')
    .select('id, zona_id')
    .eq('vehiculo_id', ubicacion.vehiculoId)
    .in('estado', ['planificada', 'en_curso'])
    .order('fecha_ruta', { ascending: false })
    .limit(1)
    .single()
  
  if (!rutaActiva) return
  
  // Obtener ruta planificada
  const { data: rutaPlanificada } = await supabase
    .from('rutas_planificadas')
    .select('id, polyline, orden_visita')
    .eq('ruta_reparto_id', rutaActiva.id)
    .eq('estado', 'optimizada')
    .single()
  
  if (!rutaPlanificada || !rutaPlanificada.polyline) return
  
  // Calcular distancia a la polilínea (simplificado: distancia al punto más cercano)
  // En producción, usar una función más robusta de distancia punto-polilínea
  const distanciaDesvio = await calculateDistanceToPolyline(
    ubicacion.lat,
    ubicacion.lng,
    rutaPlanificada.polyline
  )
  
  // Verificar desvío
  if (distanciaDesvio > DESVIO_UMBRAL) {
    await supabase.rpc('fn_marcar_alerta_desvio', {
      p_ruta_id: rutaPlanificada.id,
      p_vehiculo_id: ubicacion.vehiculoId,
      p_repartidor_id: ubicacion.repartidorId,
      p_lat: ubicacion.lat,
      p_lng: ubicacion.lng,
      p_distancia_desvio_m: distanciaDesvio
    })
  }
  
  // Verificar cliente saltado
  if (rutaPlanificada.orden_visita) {
    const ordenVisita = Array.isArray(rutaPlanificada.orden_visita)
      ? rutaPlanificada.orden_visita
      : []
    
    for (const punto of ordenVisita) {
      if (!punto.lat || !punto.lng || !punto.pedido_id) continue
      
      // Verificar si el pedido ya fue entregado
      const { data: detalleRuta } = await supabase
        .from('detalles_ruta')
        .select('estado_entrega')
        .eq('pedido_id', punto.pedido_id)
        .eq('ruta_id', rutaActiva.id)
        .single()
      
      if (detalleRuta?.estado_entrega === 'entregado') continue
      
      // Calcular distancia al cliente
      const distanciaCliente = haversineDistance(
        { lat: ubicacion.lat, lng: ubicacion.lng },
        { lat: punto.lat, lng: punto.lng }
      ) * 1000 // convertir a metros
      
      if (distanciaCliente < UMBRAL_CLIENTE) {
        await supabase.rpc('fn_marcar_alerta_cliente_saltado', {
          p_ruta_id: rutaPlanificada.id,
          p_vehiculo_id: ubicacion.vehiculoId,
          p_repartidor_id: ubicacion.repartidorId,
          p_cliente_id: punto.cliente_id,
          p_pedido_id: punto.pedido_id,
          p_lat: ubicacion.lat,
          p_lng: ubicacion.lng,
          p_distancia_m: distanciaCliente
        })
        break // Solo una alerta por ubicación
      }
    }
  }
}

/**
 * Calcula distancia aproximada a una polilínea (simplificado)
 * En producción, usar una función más robusta
 */
async function calculateDistanceToPolyline(
  lat: number,
  lng: number,
  polyline: string
): Promise<number> {
  // Parsear polyline (formato simple: "lat1,lng1;lat2,lng2;...")
  const points = polyline.split(';').map(p => {
    const [latStr, lngStr] = p.split(',')
    return { lat: parseFloat(latStr), lng: parseFloat(lngStr) }
  })
  
  if (points.length === 0) return Infinity
  
  // Encontrar el punto más cercano en la polilínea
  let minDistance = Infinity
  for (const point of points) {
    const distance = haversineDistance(
      { lat, lng },
      point
    ) * 1000 // convertir a metros
    if (distance < minDistance) {
      minDistance = distance
    }
  }
  
  return minDistance
}

/**
 * Función Haversine simplificada (misma que en local-optimizer)
 */
function haversineDistance(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }): number {
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

