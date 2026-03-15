'use server'

import type { SupabaseClient } from '@supabase/supabase-js'

import { config } from '@/lib/config'
import { getGoogleDirections, isGoogleDirectionsAvailable } from '@/lib/rutas/google-directions'
import { getOptimizedRoute } from '@/lib/rutas/ors-directions'
import type { Point } from '@/lib/rutas/local-optimizer' // Solo el tipo Point
import { optimizeFleetRouting, isFleetRoutingAvailable, type FleetRoutingOptions } from '@/lib/services/google-cloud/fleet-routing'
import { optimizeRoutes, isOptimizationAvailable, type OptimizationOptions } from '@/lib/services/google-cloud/optimization'
import { calcularTiempoDescarga, verificarEnHorario, obtenerHorarioDelDia } from '@/lib/utils/eta-calculator'
import type { Database } from '@/types/database.types'

type GenerateRutaOptions = {
  supabase: SupabaseClient<Database>
  rutaId: string
  usarGoogle?: boolean
}

function normalizeOptimizadaPorForRutaPlanificada(
  optimizadaPor: 'fleet-routing' | 'optimization' | 'google' | 'ors' | 'local'
): 'google' | 'local' {
  return optimizadaPor === 'local' ? 'local' : 'google'
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
            // Horarios del cliente para calcular ETA
            horario_lunes: clienteData.horario_lunes,
            horario_martes: clienteData.horario_martes,
            horario_miercoles: clienteData.horario_miercoles,
            horario_jueves: clienteData.horario_jueves,
            horario_viernes: clienteData.horario_viernes,
            horario_sabado: clienteData.horario_sabado,
            horario_domingo: clienteData.horario_domingo,
          })
        }
      }
    }
  }

  // Deduplicar waypoints por clienteId para evitar clientes repetidos
  const waypointsUnicos: Point[] = []
  const clientesVistos = new Set<string>()

  for (const wp of waypoints) {
    if (wp.clienteId && !clientesVistos.has(wp.clienteId)) {
      clientesVistos.add(wp.clienteId)
      waypointsUnicos.push(wp)
    } else if (!wp.clienteId) {
      // Si no tiene clienteId, agregarlo de todas formas
      waypointsUnicos.push(wp)
    }
  }

  if (waypointsUnicos.length === 0) {
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
    : waypointsUnicos[waypointsUnicos.length - 1]

  let ordenVisita: any[] = []
  let polyline = ''
  let distanciaTotal = 0
  let duracionTotal = 0
  let optimizadaPor: 'ors' | 'google' = 'ors'

  // Intentar primero con ORS Optimization (usa datos de OpenStreetMap)
  console.log('[Optimizer] Intentando ORS Optimization con', waypointsUnicos.length, 'clientes...')

  // Convertir waypoints al formato de ORS
  const stopsORS = waypointsUnicos.map(wp => ({
    id: wp.clienteId || wp.id,
    lat: wp.lat,
    lng: wp.lng
  }))

  const orsResult = await getOptimizedRoute({
    depot: { lat: origin.lat, lng: origin.lng },
    stops: stopsORS,
    returnToDepot: config.rutas.returnToBase,
    vehicle: 'driving-car'
  })

  if (orsResult.response.success && orsResult.orderedStops && orsResult.orderedStops.length > 0) {
    console.log('[Optimizer] ✅ ORS Optimization exitoso:', orsResult.provider)

    // Mapear orderedStops de ORS al formato esperado
    ordenVisita = orsResult.orderedStops.map((stop, index) => {
      // Buscar el waypoint original para obtener datos completos
      const wpOriginal = waypointsUnicos.find(wp =>
        (wp.clienteId || wp.id) === stop.id
      )
      return {
        detalle_ruta_id: wpOriginal?.detalleRutaId,
        pedido_id: wpOriginal?.pedidoId,
        cliente_id: wpOriginal?.clienteId || stop.id,
        cliente_nombre: wpOriginal?.nombreCliente,
        lat: stop.lat,
        lng: stop.lng,
        orden: index + 1,
        // Agregar horarios para calcular ETA
        horario_lunes: (wpOriginal as any)?.horario_lunes,
        horario_martes: (wpOriginal as any)?.horario_martes,
        horario_miercoles: (wpOriginal as any)?.horario_miercoles,
        horario_jueves: (wpOriginal as any)?.horario_jueves,
        horario_viernes: (wpOriginal as any)?.horario_viernes,
        horario_sabado: (wpOriginal as any)?.horario_sabado,
        horario_domingo: (wpOriginal as any)?.horario_domingo,
      }
    })

    polyline = orsResult.response.polyline || ''
    distanciaTotal = (orsResult.response.distance || 0) / 1000
    duracionTotal = Math.round((orsResult.response.duration || 0) / 60)
    optimizadaPor = 'ors'

    console.log('[Optimizer] ✅ Ruta optimizada con ORS - distancia:', distanciaTotal.toFixed(2), 'km, duración:', duracionTotal, 'min')
  } else {
    // Fallback a Google Directions
    console.warn('[Optimizer] ORS falló, usando Google Directions como fallback:', orsResult.response.error)
    optimizadaPor = 'google'

    if (!isGoogleDirectionsAvailable()) {
      throw new Error('Ni ORS ni Google Directions están disponibles. Verifica las claves de API.')
    }

    console.log('[Optimizer] Llamando a Google Directions con', waypointsUnicos.length, 'clientes...')
    const googleResult = await getGoogleDirections({
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      waypoints: waypointsUnicos,
      optimize: waypointsUnicos.length > 1,
    })

    console.log('[Optimizer] Resultado Google:', googleResult.success ? 'OK' : 'ERROR', googleResult.error || '')

    if (!googleResult.success || !googleResult.orderedStops) {
      throw new Error(`Error al optimizar ruta: ${googleResult.error || 'Sin detalle'}`)
    }

    ordenVisita = mapOrderedStops(googleResult.orderedStops, waypointsUnicos)
    polyline = googleResult.polyline || ''
    distanciaTotal = (googleResult.distance || 0) / 1000
    duracionTotal = Math.round((googleResult.duration || 0) / 60)
    console.log('[Optimizer] ✅ Ruta optimizada con Google Directions - polyline length:', polyline.length)
  }

  // Actualizar ruta_planificada
  const optimizadaPorRutaPlanificada = normalizeOptimizadaPorForRutaPlanificada(optimizadaPor)

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
        optimizada_por: optimizadaPorRutaPlanificada,
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

  // Sincronizar orden optimizado en la tabla entregas para que el repartidor vea el mismo orden
  // Esto es importante para pedidos agrupados donde cada cliente tiene un registro en entregas
  console.log('[Optimizer] Sincronizando orden y calculando ETAs para', ordenVisita.length, 'puntos...')

  // Obtener los pedido_ids de esta ruta para filtrar correctamente
  const pedidoIds = [...new Set(ordenVisita.map(p => p.pedido_id).filter(Boolean))]
  console.log('[Optimizer] Pedidos en la ruta:', pedidoIds)

  // Obtener hora_inicio_reparto de la ruta para calcular ETAs
  const { data: rutaData } = await supabase
    .from('rutas_reparto')
    .select('hora_inicio_reparto, fecha_ruta')
    .eq('id', rutaId)
    .single()

  const horaInicioReparto = rutaData?.hora_inicio_reparto
    ? new Date(rutaData.hora_inicio_reparto)
    : new Date() // Si no hay hora de inicio, usar hora actual

  const fechaRuta = rutaData?.fecha_ruta ? new Date(rutaData.fecha_ruta) : new Date()

  // Calcular tiempo acumulado en minutos desde hora_inicio_reparto
  let tiempoAcumuladoMin = 0

  for (let i = 0; i < ordenVisita.length; i++) {
    const punto = ordenVisita[i]

    if (punto.cliente_id && punto.pedido_id) {
      // Buscar la entrega por pedido_id + cliente_id
      const { data: entrega, error: entregaFetchError } = await (supabase as any)
        .from('entregas')
        .select('id, pedido_id, cliente_id, orden_entrega')
        .eq('cliente_id', punto.cliente_id)
        .eq('pedido_id', punto.pedido_id)
        .maybeSingle()

      console.log('[Optimizer] Buscando entrega para cliente', punto.cliente_nombre, '(', punto.cliente_id, ') pedido', punto.pedido_id, '->', entrega ? 'encontrada' : 'no encontrada')

      if (!entregaFetchError && entrega) {
        // Calcular tiempo de viaje (usar duración del tramo o estimación basada en distancia)
        // Asumimos ~3 min por km como estimación si no tenemos datos precisos
        const distanciaKm = distanciaTotal / ordenVisita.length // Distribución aproximada
        const tiempoViajeMin = i === 0 ? 15 : Math.ceil(distanciaKm * 3) // 15 min al primer cliente
        tiempoAcumuladoMin += tiempoViajeMin

        // Calcular ETA
        const eta = new Date(horaInicioReparto.getTime() + tiempoAcumuladoMin * 60 * 1000)

        // Obtener peso de la entrega (si existe) para calcular tiempo de descarga
        const { data: pesoData } = await (supabase as any)
          .from('entregas')
          .select('peso_total_kg')
          .eq('id', (entrega as any).id)
          .single()

        const pesoKg = pesoData?.peso_total_kg || 20 // Default 20kg si no hay dato
        const tiempoDescargaMin = calcularTiempoDescarga(pesoKg)

        // Obtener horario del cliente según el día de la semana
        const horarioCliente = obtenerHorarioDelDia({
          horario_lunes: (punto as any).horario_lunes,
          horario_martes: (punto as any).horario_martes,
          horario_miercoles: (punto as any).horario_miercoles,
          horario_jueves: (punto as any).horario_jueves,
          horario_viernes: (punto as any).horario_viernes,
          horario_sabado: (punto as any).horario_sabado,
          horario_domingo: (punto as any).horario_domingo,
        }, fechaRuta)

        // Verificar si está en horario
        const enHorario = verificarEnHorario(horarioCliente, eta)

        // Actualizar entrega con orden, ETA, tiempo de descarga y estado de horario
        const { error: entregaUpdateError } = await (supabase as any)
          .from('entregas')
          .update({
            orden_entrega: punto.orden,
            eta: eta.toISOString(),
            tiempo_descarga_min: tiempoDescargaMin,
            peso_entrega_kg: pesoKg,
            en_horario: enHorario,
          })
          .eq('id', (entrega as any).id)

        if (entregaUpdateError) {
          console.warn(`[Optimizer] Error al actualizar entrega ${(entrega as any).id}:`, entregaUpdateError)
        } else {
          console.log(`[Optimizer] ✅ Entrega ${(entrega as any).id} (${punto.cliente_nombre}) → orden ${punto.orden}, ETA ${eta.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}, ${enHorario ? '🟢 en horario' : '🔴 fuera de horario'}`)
        }

        // Sumar tiempo de descarga al acumulado para el siguiente cliente
        tiempoAcumuladoMin += tiempoDescargaMin
      } else if (entregaFetchError) {
        console.warn(`[Optimizer] Error buscando entrega:`, entregaFetchError)
      }
    } else {
      console.log('[Optimizer] Punto sin cliente_id o pedido_id:', punto.cliente_nombre)
    }
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
  optimizadaPor: 'fleet-routing' | 'optimization' | 'google' | 'ors' | 'local'
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
  console.log('[mapOrderedStops] Mapeando', orderedStops.length, 'paradas con', waypoints.length, 'waypoints originales')

  return orderedStops.map((stop, index) => {
    // Usar waypointIndex si está disponible (viene de la optimización de Google)
    // waypointIndex indica el índice del waypoint ORIGINAL que corresponde a esta parada
    let punto: Point | undefined

    if (stop.waypointIndex !== undefined && waypoints[stop.waypointIndex]) {
      punto = waypoints[stop.waypointIndex]
      console.log(`[mapOrderedStops] Posición ${index + 1}: usando waypointIndex ${stop.waypointIndex} -> ${punto?.nombreCliente}`)
    } else {
      // Fallback: buscar por coordenadas cercanas
      punto = waypoints.find(
        (wp) => Math.abs(wp.lat - stop.lat) < 0.001 && Math.abs(wp.lng - stop.lng) < 0.001,
      )
      if (punto) {
        console.log(`[mapOrderedStops] Posición ${index + 1}: encontrado por coords -> ${punto?.nombreCliente}`)
      } else {
        // Último fallback: usar índice secuencial
        punto = waypoints[index]
        console.warn(`[mapOrderedStops] Posición ${index + 1}: fallback a índice ${index} -> ${punto?.nombreCliente}`)
      }
    }

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

