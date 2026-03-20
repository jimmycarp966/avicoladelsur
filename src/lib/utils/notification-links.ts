export interface NotificationLinkSource {
  tipo?: string | null
  categoria?: string | null
  titulo?: string | null
  mensaje?: string | null
  metadata?: Record<string, unknown> | null
  datos?: Record<string, unknown> | null
}

export interface NotificationLinkTarget {
  href: string
  label: string
}

const CATEGORY_FALLBACKS: Record<string, NotificationLinkTarget> = {
  ventas: { href: '/ventas/presupuestos', label: 'Ver ventas' },
  almacen: { href: '/almacen/presupuestos-dia', label: 'Ver almacen' },
  reparto: { href: '/reparto/rutas', label: 'Ver reparto' },
  tesoreria: { href: '/tesoreria/movimientos', label: 'Ver tesoreria' },
  rrhh: { href: '/rrhh/empleados', label: 'Ver rrhh' },
  sucursales: { href: '/sucursales', label: 'Ver sucursales' },
  sistema: { href: '/notificaciones', label: 'Ver notificaciones' },
  ia: { href: '/notificaciones', label: 'Ver notificaciones' },
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function getPayload(notification: NotificationLinkSource): Record<string, unknown> {
  const metadata = isPlainObject(notification.metadata) ? notification.metadata : {}
  const datos = isPlainObject(notification.datos) ? notification.datos : {}

  return { ...datos, ...metadata }
}

function getStringValue(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

function getStringArray(payload: Record<string, unknown>, keys: string[]): string[] | null {
  for (const key of keys) {
    const value = payload[key]
    if (!Array.isArray(value)) continue

    const items: string[] = []
    for (const item of value) {
      if (typeof item !== 'string') continue

      const trimmed = item.trim()
      if (trimmed) {
        items.push(trimmed)
      }
    }

    if (items.length > 0) {
      return items
    }
  }

  return null
}

function getTextHint(notification: NotificationLinkSource): string {
  const parts: string[] = []

  for (const value of [notification.tipo, notification.titulo, notification.mensaje]) {
    if (typeof value !== 'string') continue

    const trimmed = value.trim()
    if (trimmed) {
      parts.push(trimmed)
    }
  }

  return parts.join(' ').toLowerCase()
}

export function resolveNotificationLink(
  notification: NotificationLinkSource,
): NotificationLinkTarget | null {
  const payload = getPayload(notification)
  const textHint = getTextHint(notification)

  const presupuestoId = getStringValue(payload, ['presupuesto_id', 'presupuestoId'])
  const pedidoId = getStringValue(payload, ['pedido_id', 'pedidoId'])
  const rutaId = getStringValue(payload, ['ruta_id', 'rutaId'])
  const vehiculoId = getStringValue(payload, ['vehiculo_id', 'vehiculoId'])
  const transferenciaId = getStringValue(payload, ['transferencia_id', 'transferenciaId'])
  const empleadoId = getStringValue(payload, ['empleado_id', 'empleadoId'])
  const liquidacionId = getStringValue(payload, ['liquidacion_id', 'liquidacionId'])
  const clienteId = getStringValue(payload, ['cliente_id', 'clienteId'])
  const sucursalId = getStringValue(payload, ['sucursal_id', 'sucursalId'])
  const cobroId = getStringValue(payload, ['cobroId', 'cobro_id'])

  const pedidosAfectados = getStringArray(payload, ['pedidos_afectados'])
  if (pedidosAfectados) {
    if (pedidosAfectados.length === 1) {
      return { href: `/almacen/pedidos/${pedidosAfectados[0]}`, label: 'Ver pedido' }
    }

    return { href: '/almacen/pedidos', label: 'Ver pedidos' }
  }

  const presupuestosAfectados = getStringArray(payload, ['presupuestos_afectados', 'presupuestos_ids'])
  if (presupuestosAfectados) {
    if (presupuestosAfectados.length === 1) {
      return { href: `/ventas/presupuestos/${presupuestosAfectados[0]}`, label: 'Ver presupuesto' }
    }

    return { href: '/ventas/presupuestos', label: 'Ver presupuestos' }
  }

  if (presupuestoId && pedidoId) {
    if (
      textHint.includes('convert') ||
      textHint.includes('pedido') ||
      textHint.includes('ruta') ||
      textHint.includes('entreg')
    ) {
      return { href: `/almacen/pedidos/${pedidoId}`, label: 'Ver pedido' }
    }

    return { href: `/ventas/presupuestos/${presupuestoId}`, label: 'Ver presupuesto' }
  }

  if (presupuestoId) {
    return { href: `/ventas/presupuestos/${presupuestoId}`, label: 'Ver presupuesto' }
  }

  if (pedidoId) {
    return { href: `/almacen/pedidos/${pedidoId}`, label: 'Ver pedido' }
  }

  if (rutaId) {
    return { href: `/reparto/rutas/${rutaId}`, label: 'Ver ruta' }
  }

  if (vehiculoId) {
    return { href: `/reparto/vehiculos/${vehiculoId}`, label: 'Ver vehiculo' }
  }

  if (transferenciaId) {
    return { href: `/sucursales/transferencias/${transferenciaId}`, label: 'Ver transferencia' }
  }

  if (liquidacionId) {
    return { href: `/rrhh/liquidaciones/${liquidacionId}`, label: 'Ver liquidacion' }
  }

  if (empleadoId) {
    return { href: `/rrhh/empleados/${empleadoId}`, label: 'Ver empleado' }
  }

  if (clienteId) {
    return { href: `/ventas/clientes/${clienteId}`, label: 'Ver cliente' }
  }

  if (cobroId) {
    return { href: '/tesoreria/movimientos', label: 'Ver tesoreria' }
  }

  if (sucursalId) {
    return { href: '/sucursales', label: 'Ver sucursales' }
  }

  const categoryKey = (notification.categoria || '').toLowerCase()
  if (categoryKey && CATEGORY_FALLBACKS[categoryKey]) {
    return CATEGORY_FALLBACKS[categoryKey]
  }

  if (textHint.includes('presupuesto')) {
    return CATEGORY_FALLBACKS.ventas
  }

  if (textHint.includes('pedido')) {
    return CATEGORY_FALLBACKS.almacen
  }

  if (textHint.includes('ruta') || textHint.includes('vehiculo')) {
    return CATEGORY_FALLBACKS.reparto
  }

  if (textHint.includes('liquidacion') || textHint.includes('empleado') || textHint.includes('adelanto')) {
    return CATEGORY_FALLBACKS.rrhh
  }

  if (textHint.includes('tesoreria') || textHint.includes('cobro') || textHint.includes('transfer')) {
    return CATEGORY_FALLBACKS.tesoreria
  }

  return null
}
