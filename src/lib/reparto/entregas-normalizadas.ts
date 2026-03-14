import {
  calcularMontoPorCobrar,
  esEntregaTerminal,
  getEntregasSinEstadoPago,
  normalizarEstadoEntrega,
} from '@/lib/utils/estado-pago'

export async function obtenerEntregasExpandidasRuta(supabase: any, rutaId: string) {
  const { data, error } = await supabase.rpc('fn_get_detalles_ruta_completos', {
    p_ruta_id: rutaId,
  })

  if (error) {
    throw error
  }

  if (Array.isArray(data)) {
    return data
  }

  return data ? [data] : []
}

export async function obtenerEntregasExpandidasPorRutaIds(supabase: any, rutaIds: string[]) {
  const uniqueRouteIds = Array.from(new Set(rutaIds.filter(Boolean)))

  const entries = await Promise.all(
    uniqueRouteIds.map(async (rutaId) => {
      const entregas = await obtenerEntregasExpandidasRuta(supabase, rutaId)
      return [rutaId, entregas] as const
    }),
  )

  return Object.fromEntries(entries) as Record<string, any[]>
}

export function resumirEntregasRuta(entregas: any[]) {
  const total = entregas.length
  const completadas = entregas.filter((entrega) => esEntregaTerminal(entrega)).length
  const pendientes = entregas.filter((entrega) => !esEntregaTerminal(entrega)).length
  const porCobrar = entregas.reduce(
    (sum, entrega) => sum + calcularMontoPorCobrar(entrega),
    0,
  )
  const recaudado = entregas.reduce(
    (sum, entrega) => sum + Number(entrega.monto_cobrado_registrado || 0),
    0,
  )

  return {
    total,
    completadas,
    pendientes,
    porCobrar,
    recaudado,
    sinEstadoPago: getEntregasSinEstadoPago(entregas),
  }
}

export function getEstadoRutaDesdeEntregas(entregas: any[]) {
  if (entregas.length === 0) return 'pendiente'
  if (entregas.every((entrega) => normalizarEstadoEntrega(entrega.estado_entrega) === 'rechazado')) {
    return 'rechazado'
  }
  if (entregas.every((entrega) => esEntregaTerminal(entrega))) {
    return 'entregado'
  }
  if (entregas.some((entrega) => normalizarEstadoEntrega(entrega.estado_entrega) === 'en_camino')) {
    return 'en_camino'
  }
  return 'pendiente'
}
