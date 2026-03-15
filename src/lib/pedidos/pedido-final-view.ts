export interface PedidoFinalEntregaItem {
  key: string
  codigo: string
  nombre: string
  categoria: string
  pesable: boolean
  cantidad: number
  cantidadFinal: number
  precioUnitario: number
  subtotal: number
}

export interface PedidoFinalEntrega {
  entregaId: string
  clienteId: string
  clienteNombre: string
  clienteTelefono: string
  presupuestoId: string | null
  numeroPresupuesto: string | null
  direccion: string | null
  ordenEntrega: number
  estadoEntrega: string
  estadoPago: string
  metodoPago: string | null
  montoCobrado: number
  referenciaPago: string | null
  observaciones: string | null
  subtotal: number
  recargo: number
  total: number
  totalKg: number
  totalUnidades: number
  items: PedidoFinalEntregaItem[]
}

export interface PedidoFinalProductoConsolidado {
  key: string
  codigo: string
  nombre: string
  categoria: string
  pesable: boolean
  totalCantidadFinal: number
  totalSubtotal: number
  entregas: number
  clientes: number
}

export interface PedidoFinalCategoriaConsolidada {
  nombre: string
  productos: PedidoFinalProductoConsolidado[]
}

export interface PedidoFinalResumenOperativo {
  numeroPedido: string
  fechaPedido: string | null
  fechaEntrega: string | null
  fechaEntregaReal: string | null
  zona: string
  turno: string | null
  estado: string
  estadoCierre: string | null
  pagoEstado: string | null
  cantidadEntregas: number
  totalKgFinal: number
  totalUnidades: number
  totalMonetario: number
  totalCobrado: number
  entregasPendientes: number
  entregasEntregadas: number
  rutaNumero: string | null
  rutaEstado: string | null
  repartidor: string
  vehiculo: string
}

export interface PedidoFinalViewModel {
  pedidoId: string
  observaciones: string | null
  resumenOperativo: PedidoFinalResumenOperativo
  consolidadoFinalPorProducto: PedidoFinalCategoriaConsolidada[]
  entregasFinales: PedidoFinalEntrega[]
}

interface PedidoProductoMeta {
  key: string
  codigo: string
  nombre: string
  categoria: string
  pesable: boolean
}

const FALLBACK_CATEGORY = 'Sin categoria'

const toNumber = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const normalizeTextKey = (value: string | null | undefined) =>
  (value || '').trim().toLowerCase()

const getProductKey = (codigo: string | null | undefined, nombre: string | null | undefined) => {
  const normalizedCode = normalizeTextKey(codigo)
  if (normalizedCode) {
    return normalizedCode
  }

  const normalizedName = normalizeTextKey(nombre)
  return normalizedName || 'producto-sin-clave'
}

const buildProductMetaMap = (pedido: any): Map<string, PedidoProductoMeta> => {
  const productMetaMap = new Map<string, PedidoProductoMeta>()

  for (const detalle of pedido?.detalles_pedido ?? []) {
    const producto = detalle?.productos ?? detalle?.producto ?? {}
    const codigo = producto?.codigo || detalle?.codigo || ''
    const nombre = producto?.nombre || detalle?.producto_nombre || 'Producto'
    const key = getProductKey(codigo, nombre)

    productMetaMap.set(key, {
      key,
      codigo: codigo || '',
      nombre,
      categoria: producto?.categoria || detalle?.categoria || FALLBACK_CATEGORY,
      pesable:
        Boolean(producto?.requiere_pesaje) ||
        detalle?.peso_final != null ||
        normalizeTextKey(producto?.unidad_medida) === 'kg' ||
        normalizeTextKey(producto?.unidad_medida) === 'kilogramo',
    })
  }

  return productMetaMap
}

export const formatPedidoFinalCantidad = (cantidad: number, pesable: boolean) =>
  pesable ? `${cantidad.toFixed(2)} kg` : `${cantidad.toFixed(0)} u`

export function buildPedidoFinalViewModel({
  pedido,
  ruta,
  entregas,
  resumenEntregas,
}: {
  pedido: any
  ruta?: any | null
  entregas?: any[] | null
  resumenEntregas?: any | null
}): PedidoFinalViewModel {
  const productMetaMap = buildProductMetaMap(pedido)
  const entregasRaw = Array.isArray(entregas) ? entregas : []

  const entregasFinales: PedidoFinalEntrega[] = entregasRaw.map((entrega) => {
    const items = Array.isArray(entrega?.items) ? entrega.items : []

    const normalizedItems: PedidoFinalEntregaItem[] = items.map((item: any) => {
      const key = getProductKey(item?.codigo, item?.producto_nombre)
      const meta = productMetaMap.get(key)
      const pesoFinal = toNumber(item?.peso)
      const cantidad = toNumber(item?.cantidad)
      const pesable = meta?.pesable ?? pesoFinal > 0
      const cantidadFinal = pesable ? (pesoFinal > 0 ? pesoFinal : cantidad) : cantidad

      return {
        key,
        codigo: item?.codigo || meta?.codigo || '',
        nombre: item?.producto_nombre || meta?.nombre || 'Producto',
        categoria: meta?.categoria || FALLBACK_CATEGORY,
        pesable,
        cantidad,
        cantidadFinal,
        precioUnitario: toNumber(item?.precio_unitario),
        subtotal: toNumber(item?.subtotal),
      }
    })

    const totalKg = normalizedItems.reduce(
      (sum, item) => sum + (item.pesable ? item.cantidadFinal : 0),
      0,
    )

    const totalUnidades = normalizedItems.reduce(
      (sum, item) => sum + (item.pesable ? 0 : item.cantidadFinal),
      0,
    )

    return {
      entregaId: entrega?.entrega_id || '',
      clienteId: entrega?.cliente_id || '',
      clienteNombre: entrega?.cliente_nombre || 'Cliente',
      clienteTelefono: entrega?.cliente_telefono || '',
      presupuestoId: entrega?.presupuesto_id || null,
      numeroPresupuesto: entrega?.numero_presupuesto || null,
      direccion: entrega?.direccion || null,
      ordenEntrega: toNumber(entrega?.orden_entrega),
      estadoEntrega: entrega?.estado_entrega || 'pendiente',
      estadoPago: entrega?.estado_pago || 'pendiente',
      metodoPago: entrega?.metodo_pago || null,
      montoCobrado: toNumber(entrega?.monto_cobrado),
      referenciaPago: entrega?.referencia_pago || null,
      observaciones: entrega?.observaciones || null,
      subtotal: toNumber(entrega?.subtotal),
      recargo: toNumber(entrega?.recargo),
      total: toNumber(entrega?.total),
      totalKg,
      totalUnidades,
      items: normalizedItems,
    }
  })

  const consolidadoMap = new Map<
    string,
    PedidoFinalProductoConsolidado & { entregaIds: Set<string>; clienteIds: Set<string> }
  >()

  for (const entrega of entregasFinales) {
    for (const item of entrega.items) {
      const existing = consolidadoMap.get(item.key)

      if (existing) {
        existing.totalCantidadFinal += item.cantidadFinal
        existing.totalSubtotal += item.subtotal
        existing.entregaIds.add(entrega.entregaId)
        existing.clienteIds.add(entrega.clienteId || entrega.clienteNombre)
        continue
      }

      consolidadoMap.set(item.key, {
        key: item.key,
        codigo: item.codigo,
        nombre: item.nombre,
        categoria: item.categoria || FALLBACK_CATEGORY,
        pesable: item.pesable,
        totalCantidadFinal: item.cantidadFinal,
        totalSubtotal: item.subtotal,
        entregas: 0,
        clientes: 0,
        entregaIds: new Set([entrega.entregaId]),
        clienteIds: new Set([entrega.clienteId || entrega.clienteNombre]),
      })
    }
  }

  const productosConsolidados = Array.from(consolidadoMap.values()).map((producto) => ({
    key: producto.key,
    codigo: producto.codigo,
    nombre: producto.nombre,
    categoria: producto.categoria,
    pesable: producto.pesable,
    totalCantidadFinal: producto.totalCantidadFinal,
    totalSubtotal: producto.totalSubtotal,
    entregas: producto.entregaIds.size,
    clientes: producto.clienteIds.size,
  }))

  const categoriasMap = new Map<string, PedidoFinalProductoConsolidado[]>()

  for (const producto of productosConsolidados) {
    const categoria = producto.categoria || FALLBACK_CATEGORY
    const productos = categoriasMap.get(categoria) ?? []
    productos.push(producto)
    categoriasMap.set(categoria, productos)
  }

  const consolidadoFinalPorProducto = Array.from(categoriasMap.entries())
    .map(([nombre, productos]) => ({
      nombre,
      productos: productos.sort((a, b) => {
        if (a.pesable !== b.pesable) {
          return a.pesable ? -1 : 1
        }

        if (b.totalCantidadFinal !== a.totalCantidadFinal) {
          return b.totalCantidadFinal - a.totalCantidadFinal
        }

        return a.nombre.localeCompare(b.nombre)
      }),
    }))
    .sort((a, b) => {
      if (a.nombre === FALLBACK_CATEGORY && b.nombre !== FALLBACK_CATEGORY) {
        return 1
      }

      if (a.nombre !== FALLBACK_CATEGORY && b.nombre === FALLBACK_CATEGORY) {
        return -1
      }

      return a.nombre.localeCompare(b.nombre)
    })

  const totalKgFinal = entregasFinales.reduce((sum, entrega) => sum + entrega.totalKg, 0)
  const totalUnidades = entregasFinales.reduce((sum, entrega) => sum + entrega.totalUnidades, 0)
  const totalMonetario =
    toNumber(resumenEntregas?.total_a_cobrar) ||
    entregasFinales.reduce((sum, entrega) => sum + entrega.total, 0) ||
    toNumber(pedido?.total)
  const totalCobrado =
    toNumber(resumenEntregas?.total_cobrado) ||
    entregasFinales.reduce((sum, entrega) => sum + entrega.montoCobrado, 0)

  const repartidor = ruta?.repartidor
    ? `${ruta.repartidor.nombre || ''} ${ruta.repartidor.apellido || ''}`.trim()
    : (pedido?.repartidor || 'Sin asignar')

  const vehiculo = ruta?.vehiculo
    ? `${ruta.vehiculo.marca || ''} ${ruta.vehiculo.modelo || ''} (${ruta.vehiculo.patente || 'Sin patente'})`.trim()
    : (pedido?.vehiculo || 'Sin asignar')

  return {
    pedidoId: pedido?.id || '',
    observaciones: pedido?.observaciones || null,
    resumenOperativo: {
      numeroPedido: pedido?.numero_pedido || '',
      fechaPedido: pedido?.fecha_pedido || null,
      fechaEntrega: pedido?.fecha_entrega_estimada || pedido?.fecha_pedido || null,
      fechaEntregaReal: pedido?.fecha_entrega_real || null,
      zona: pedido?.zonas?.nombre || pedido?.clientes?.zona_entrega || 'Sin zona',
      turno: pedido?.turno || null,
      estado: pedido?.estado || 'pendiente',
      estadoCierre: pedido?.estado_cierre || null,
      pagoEstado: pedido?.pago_estado || null,
      cantidadEntregas: entregasFinales.length || toNumber(pedido?.cantidad_entregas),
      totalKgFinal,
      totalUnidades,
      totalMonetario,
      totalCobrado,
      entregasPendientes:
        toNumber(resumenEntregas?.pendientes) ||
        entregasFinales.filter((entrega) => entrega.estadoEntrega === 'pendiente').length,
      entregasEntregadas:
        toNumber(resumenEntregas?.entregados) ||
        entregasFinales.filter((entrega) => entrega.estadoEntrega === 'entregado').length,
      rutaNumero: ruta?.numero_ruta || null,
      rutaEstado: ruta?.estado || null,
      repartidor,
      vehiculo,
    },
    consolidadoFinalPorProducto,
    entregasFinales: entregasFinales.sort((a, b) => a.ordenEntrega - b.ordenEntrega),
  }
}
