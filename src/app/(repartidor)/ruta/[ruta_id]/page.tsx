import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { RutaHojaContent } from './ruta-hoja-content'
import { Card, CardContent } from '@/components/ui/card'
import { Truck } from 'lucide-react'
import { config } from '@/lib/config'
import { getGoogleDirections } from '@/lib/rutas/google-directions'

export const dynamic = 'force-dynamic'

async function RutaHojaPage({ params }: { params: Promise<{ ruta_id: string }> }) {
  const supabase = await createClient()
  const { ruta_id } = await params

  // Obtener usuario actual
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div>No autorizado</div>

  // Obtener ruta básica
  const { data: rutaBasica, error: rutaError } = await supabase
    .from('rutas_reparto')
    .select(`
      *,
      repartidor:usuarios!rutas_reparto_repartidor_id_fkey(id, nombre, apellido),
      vehiculo:vehiculos(patente, marca, modelo, capacidad_kg),
      zona:zonas(nombre)
    `)
    .eq('id', ruta_id)
    .single()

  if (rutaError || !rutaBasica) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <Truck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Ruta no encontrada</h3>
            <p className="text-muted-foreground">
              La ruta solicitada no existe o no tienes acceso
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Verificar que el repartidor sea el dueño de la ruta
  if (rutaBasica.repartidor_id !== user.id) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <Truck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Acceso denegado</h3>
            <p className="text-muted-foreground">
              Esta ruta no está asignada a tu usuario
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // OPTIMIZACIÓN: Usar RPC batch para obtener todos los detalles en una sola query
  // Reduce ~20 queries N+1 a una sola llamada
  const { data: detallesCompletos, error: detallesError } = await supabase
    .rpc('fn_get_detalles_ruta_completos', { p_ruta_id: ruta_id })

  if (detallesError) {
    console.error('Error obteniendo detalles de ruta:', detallesError)
  }

  // Convertir el resultado JSONB a array de detalles
  // La RPC ya viene con clientes expandidos y coordenadas convertidas
  const detallesConCliente = Array.isArray(detallesCompletos)
    ? detallesCompletos
    : (detallesCompletos ? [detallesCompletos] : [])

  console.log('🔍 [DEBUG] detallesConCliente:', detallesConCliente.length, 'entregas')

  // Obtener ruta planificada para obtener polyline y orden optimizado
  const { data: rutaPlanificada, error: rutaPlanificadaError } = await supabase
    .from('rutas_planificadas')
    .select('polyline, orden_visita, ruta_reparto_id, distancia_total_km, duracion_total_min')
    .eq('ruta_reparto_id', ruta_id)
    .maybeSingle()

  console.log('🔍 [DEBUG] rutaPlanificada:', rutaPlanificada)

  // Usar directamente orden_visita de rutas_planificadas como fuente de verdad para el orden
  // Si no hay ruta planificada, generar orden optimizado en tiempo real
  let ordenVisitaOptimizado = rutaPlanificada?.orden_visita || []
  let polylineOptimizada = rutaPlanificada?.polyline || null

  // Si no hay ruta planificada, generar orden optimizado en tiempo real (igual que el Monitor)
  if (!rutaPlanificada && detallesConCliente && detallesConCliente.length > 0) {
    console.log('🔍 [DEBUG] No hay ruta planificada, generando orden optimizado en tiempo real...')
    
    try {
      // Obtener coordenadas de los clientes
      const unwrap = (v: any) => (Array.isArray(v) ? v[0] : v)
      const stops = detallesConCliente
        .map((d: any) => {
          const pedido = unwrap(d?.pedido)
          const cliente = unwrap(pedido?.cliente)
          const coords = cliente?.coordenadas
          if (!coords) return null
          
          // Soportar diferentes formatos de coordenadas
          if (typeof coords === 'object' && 'lat' in coords && 'lng' in coords) {
            return { id: d.id, lat: coords.lat, lng: coords.lng }
          }
          if (typeof coords === 'object' && 'coordinates' in coords && Array.isArray(coords.coordinates)) {
            return { id: d.id, lat: coords.coordinates[1], lng: coords.coordinates[0] }
          }
          return null
        })
        .filter((w): w is { id: string; lat: number; lng: number } => w !== null)
      
      console.log('🔍 [DEBUG] stops para optimización:', stops)
      
      if (stops.length > 0) {
        const homeBase = config.rutas.homeBase

        const optimized = await getGoogleDirections({
          origin: homeBase,
          destination: homeBase,
          waypoints: stops,
          optimize: true,
        })
        
        if (optimized.success && optimized.orderedStops && optimized.orderedStops.length > 0) {
          const orderedStopIds = optimized.orderedStops
            .map((stop) => typeof stop.waypointIndex === 'number' ? stops[stop.waypointIndex]?.id : null)
            .filter((id): id is string => typeof id === 'string')

          console.log('🔍 [DEBUG] Orden optimizado generado:', orderedStopIds)

          ordenVisitaOptimizado = orderedStopIds.map((stopId, order) => {
            const detalle = detallesConCliente.find((d: any) => d.id === stopId)
            const pedido = unwrap(detalle?.pedido)
            const cliente = unwrap(pedido?.cliente)
            return {
              id: detalle?.id,
              detalle_ruta_id: detalle?.id,
              pedido_id: pedido?.id,
              cliente_id: cliente?.id,
              cliente_nombre: cliente?.nombre,
              orden: order + 1
            }
          })
          
          polylineOptimizada = optimized.polyline || null
        }
      }
    } catch (error) {
      console.error('Error generando orden optimizado en tiempo real:', error)
    }
  }

  console.log('🔍 [DEBUG] ordenVisitaOptimizado:', ordenVisitaOptimizado)

  // Crear un mapa id -> orden para lookup rápido
  const ordenMap = new Map<string, number>()
  for (const punto of ordenVisitaOptimizado) {
    const orden = typeof punto?.orden === 'number' ? punto.orden : null
    if (orden === null) continue
    
    // Prioridad de matching:
    // 1. id (entrega.id)
    // 2. detalle_ruta_id
    // 3. pedido_id + cliente_id
    // 4. cliente_id
    if (punto.id) ordenMap.set(punto.id, orden)
    if (punto.detalle_ruta_id) ordenMap.set(punto.detalle_ruta_id, orden)
    if (punto.pedido_id && punto.cliente_id) {
      ordenMap.set(`${punto.pedido_id}:${punto.cliente_id}`, orden)
    }
    if (punto.cliente_id) ordenMap.set(punto.cliente_id, orden)
  }

  console.log('🔍 [DEBUG] ordenMap:', Array.from(ordenMap.entries()))

  console.log('🔍 [DEBUG] detallesConCliente (antes de ordenar):', detallesConCliente.map((d: any) => ({
    id: d.id,
    orden_entrega: d.orden_entrega,
    pedido_id: d.pedido_id,
    cliente_id: d.cliente_id,
    cliente_nombre: d.pedido?.cliente?.nombre || 'N/A'
  })))

  // Ordenar detalles usando el mapa de orden optimizado
  const detallesOrdenados = [...detallesConCliente].sort((a, b) => {
    const unwrap = (v: any) => (Array.isArray(v) ? v[0] : v)
    
    const getOrden = (d: any): number | null => {
      const id = typeof d?.id === 'string' ? d.id : null
      const detalleRutaId = typeof d?.detalle_ruta_id === 'string' ? d.detalle_ruta_id : null
      const pedido = unwrap(d?.pedido)
      const cliente = unwrap(pedido?.cliente)
      const pedidoId = typeof d?.pedido_id === 'string' ? d.pedido_id : (typeof pedido?.id === 'string' ? pedido.id : null)
      const clienteId = typeof d?.cliente_id === 'string' ? d.cliente_id : (typeof cliente?.id === 'string' ? cliente.id : null)
      
      if (id && ordenMap.has(id)) return ordenMap.get(id) as number
      if (detalleRutaId && ordenMap.has(detalleRutaId)) return ordenMap.get(detalleRutaId) as number
      if (pedidoId && clienteId) {
        const k = `${pedidoId}:${clienteId}`
        if (ordenMap.has(k)) return ordenMap.get(k) as number
      }
      if (clienteId && ordenMap.has(clienteId)) return ordenMap.get(clienteId) as number
      
      return null
    }
    
    const ordenA = getOrden(a)
    const ordenB = getOrden(b)
    
    if (ordenA !== null || ordenB !== null) {
      return (ordenA ?? Number.MAX_SAFE_INTEGER) - (ordenB ?? Number.MAX_SAFE_INTEGER)
    }
    
    // Fallback: usar orden_entrega local
    const localOrdenA = a.entrega_orden ?? a.orden_entrega ?? 0
    const localOrdenB = b.entrega_orden ?? b.orden_entrega ?? 0
    return localOrdenA - localOrdenB
  }).map((d, index) => ({
    ...d,
    orden_entrega: index + 1,
    entrega_orden: index + 1,
  }))

  console.log('🔍 [DEBUG] detallesOrdenados (después de ordenar):', detallesOrdenados.map((d: any) => ({
    id: d.id,
    orden_entrega: d.orden_entrega,
    pedido_id: d.pedido_id,
    cliente_id: d.cliente_id,
    cliente_nombre: d.pedido?.cliente?.nombre || 'N/A'
  })))

  const ruta = {
    ...rutaBasica,
    detalles_ruta: detallesOrdenados,
    polyline: polylineOptimizada,
    orden_visita: ordenVisitaOptimizado,
    distancia_total_km: rutaPlanificada?.distancia_total_km || null,
    duracion_total_min: rutaPlanificada?.duracion_total_min || null,
  }

  return <RutaHojaContent ruta={ruta} />
}


export default async function RutaHojaPageWrapper({
  params,
}: {
  params: Promise<{ ruta_id: string }>
}) {
  return <RutaHojaPage params={params} />
}

