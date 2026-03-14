export type EstadoPagoType =
  | 'pagado'
  | 'pendiente'
  | 'pagara_despues'
  | 'parcial'
  | 'cuenta_corriente'
  | 'rechazado'

export interface EntregaConEstadoPago {
  estado_entrega?: string | null
  pago_registrado?: boolean | null
  monto_cobrado_registrado?: number | null
  metodo_pago_registrado?: string | null
  notas_pago?: string | null
  estado_pago?: string | null
  pedido?: {
    total?: number | null
    pago_estado?: string | null
  } | null
  total?: number | null
  monto_cobrado?: number | null
  metodo_pago?: string | null
}

const ESTADOS_ENTREGA_NEGATIVOS = new Set(['rechazado', 'fallido', 'cancelado'])
const ESTADOS_ENTREGA_TERMINALES = new Set(['entregado', ...ESTADOS_ENTREGA_NEGATIVOS])
const ESTADOS_PAGO_RESUELTOS = new Set<EstadoPagoType>(['pagado', 'cuenta_corriente', 'parcial'])
const ESTADOS_PAGO_DEFINIDOS = new Set<EstadoPagoType>([
  'pagado',
  'pendiente',
  'pagara_despues',
  'parcial',
  'cuenta_corriente',
  'rechazado',
])

function tieneNotaPagaraDespues(notasPago?: string | null) {
  const notas = notasPago?.toLowerCase() || ''
  return (
    notas.includes('pagara despues') ||
    notas.includes('pagara despues.')
  )
}

export function normalizarEstadoEntrega(
  estado?: string | null,
): 'pendiente' | 'en_camino' | 'entregado' | 'rechazado' {
  if (!estado) return 'pendiente'
  if (estado === 'en_camino') return 'en_camino'
  if (ESTADOS_ENTREGA_NEGATIVOS.has(estado)) return 'rechazado'
  return estado === 'entregado' ? 'entregado' : 'pendiente'
}

export function normalizarEstadoPago(entrega: EntregaConEstadoPago): EstadoPagoType | null {
  const estadoEntrega = normalizarEstadoEntrega(entrega.estado_entrega)
  if (estadoEntrega === 'rechazado') {
    return 'rechazado'
  }

  const estadoPago = entrega.estado_pago
  const metodoPago = entrega.metodo_pago_registrado || entrega.metodo_pago
  const montoCobrado = Number(
    entrega.monto_cobrado_registrado ?? entrega.monto_cobrado ?? 0,
  )
  const pagoEstadoPedido = entrega.pedido?.pago_estado
  const notaPagaraDespues = tieneNotaPagaraDespues(entrega.notas_pago)

  if (estadoPago === 'pago_parcial') return 'parcial'
  if (estadoPago === 'fiado') return 'cuenta_corriente'
  if (
    estadoPago === 'pagado' ||
    estadoPago === 'parcial' ||
    estadoPago === 'cuenta_corriente' ||
    estadoPago === 'rechazado'
  ) {
    return estadoPago
  }
  if (estadoPago === 'pagara_despues' || (estadoPago === 'pendiente' && notaPagaraDespues)) {
    return 'pagara_despues'
  }
  if (estadoPago === 'pendiente' && Boolean(metodoPago)) {
    return 'pendiente'
  }

  if (metodoPago === 'cuenta_corriente' || pagoEstadoPedido === 'cuenta_corriente') {
    return 'cuenta_corriente'
  }

  const total = Number(entrega.pedido?.total ?? entrega.total ?? 0)
  if (montoCobrado > 0 && total > 0 && montoCobrado < total) {
    return 'parcial'
  }

  if (montoCobrado > 0 || pagoEstadoPedido === 'pagado') {
    return 'pagado'
  }

  if (notaPagaraDespues) {
    return 'pagara_despues'
  }

  if (metodoPago) {
    return 'pendiente'
  }

  if (
    estadoPago &&
    estadoPago !== 'pendiente' &&
    ESTADOS_PAGO_DEFINIDOS.has(estadoPago as EstadoPagoType)
  ) {
    return estadoPago as EstadoPagoType
  }

  return null
}

export function esEntregaTerminal(
  entrega: Pick<EntregaConEstadoPago, 'estado_entrega'> | string | null | undefined,
): boolean {
  const estado =
    typeof entrega === 'string' || entrega == null ? entrega : entrega.estado_entrega

  return ESTADOS_ENTREGA_TERMINALES.has(estado || '')
}

export function tieneEstadoPagoDefinido(entrega: EntregaConEstadoPago): boolean {
  const estadoPago = normalizarEstadoPago(entrega)
  return estadoPago !== null && ESTADOS_PAGO_DEFINIDOS.has(estadoPago)
}

export function estaPagado(entrega: EntregaConEstadoPago): boolean {
  const estadoPago = normalizarEstadoPago(entrega)
  return estadoPago !== null && ESTADOS_PAGO_RESUELTOS.has(estadoPago)
}

export function calcularMontoPorCobrar(entrega: EntregaConEstadoPago): number {
  const estadoEntrega = normalizarEstadoEntrega(entrega.estado_entrega)
  if (estadoEntrega === 'rechazado') {
    return 0
  }

  const total = Number(entrega.pedido?.total ?? entrega.total ?? 0)
  const montoCobrado = Number(entrega.monto_cobrado_registrado ?? entrega.monto_cobrado ?? 0)
  const estadoPago = normalizarEstadoPago(entrega)

  if (!estadoPago) {
    return total
  }

  if (
    estadoPago === 'pagado' ||
    estadoPago === 'cuenta_corriente' ||
    estadoPago === 'rechazado'
  ) {
    return 0
  }

  if (estadoPago === 'parcial') {
    return Math.max(total - montoCobrado, 0)
  }

  return total
}

export function sumarMontoPorCobrar<T extends EntregaConEstadoPago>(entregas: T[]): number {
  return entregas.reduce((sum, entrega) => sum + calcularMontoPorCobrar(entrega), 0)
}

export function getEstadoPagoLabel(entrega: EntregaConEstadoPago): string {
  const estadoPago = normalizarEstadoPago(entrega)

  switch (estadoPago) {
    case 'pagado':
      return 'Pagado'
    case 'pendiente':
      return 'Pendiente'
    case 'pagara_despues':
      return 'Pagara despues'
    case 'parcial':
      return 'Pago parcial'
    case 'cuenta_corriente':
      return 'Cuenta corriente'
    case 'rechazado':
      return 'Rechazado'
    default:
      return 'Sin definir'
  }
}

export function getEstadoPagoBadgeVariant(
  entrega: EntregaConEstadoPago,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  const estadoPago = normalizarEstadoPago(entrega)

  if (estadoPago === 'rechazado') {
    return 'destructive'
  }

  if (estadoPago && ESTADOS_PAGO_RESUELTOS.has(estadoPago)) {
    return 'default'
  }

  if (estadoPago && ESTADOS_PAGO_DEFINIDOS.has(estadoPago)) {
    return 'secondary'
  }

  return 'outline'
}

export function getEntregasSinEstadoPago<T extends EntregaConEstadoPago>(entregas: T[]): T[] {
  return entregas.filter((entrega) => {
    if (!esEntregaTerminal(entrega)) {
      return false
    }

    return !tieneEstadoPagoDefinido(entrega)
  })
}
