// Tipos para respuestas de API
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
  pagination?: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface ApiError {
  code: string
  message: string
  details?: any
}

// Tipos para parámetros de API
export interface ListParams {
  page?: number
  limit?: number
  sort?: string
  order?: 'asc' | 'desc'
  search?: string
  filters?: Record<string, any>
}

export interface CreateResponse {
  success: boolean
  id?: string
  message: string
}

export interface UpdateResponse {
  success: boolean
  message: string
}

export interface DeleteResponse {
  success: boolean
  message: string
}

// Tipos específicos para cada módulo

// Almacén
export interface IngresarMercaderiaParams {
  producto_id: string
  cantidad: number
  fecha_vencimiento?: string
  proveedor?: string
  costo_unitario?: number
  ubicacion_almacen?: string
}

export interface MovimientoStockParams {
  lote_id: string
  tipo_movimiento: 'ingreso' | 'salida' | 'ajuste'
  cantidad: number
  motivo?: string
}

export interface ChecklistCalidadParams {
  lote_id: string
  temperatura?: number
  humedad?: number
  apariencia?: string
  aprobado: boolean
  observaciones?: string
}

// Ventas
export interface CrearPedidoParams {
  cliente_id: string
  items: Array<{
    producto_id: string
    cantidad: number
    precio_unitario?: number
  }>
  fecha_entrega_estimada?: string
  descuento?: number
  observaciones?: string
  pago?: {
    modalidad: 'contado' | 'credito'
    monto?: number
    caja_id?: string
    tipo_pago?: 'efectivo' | 'transferencia' | 'tarjeta'
  }
}

export interface CrearPedidoBotParams extends CrearPedidoParams {
  origen: 'whatsapp'
  pago?: {
    modalidad: 'contado' | 'credito'
    monto?: number
    tipo_pago?: 'efectivo' | 'transferencia' | 'tarjeta'
  }
}

export interface CrearPedidoBotResponse {
  pedidoId: string
  numeroPedido: string
  total: number
  referenciaPago: string | null
  instruccionRepartidor: string | null
}

export interface CrearCotizacionParams {
  cliente_id: string
  items: Array<{
    producto_id: string
    cantidad: number
    precio_unitario?: number
  }>
  fecha_vencimiento?: string
  descuento?: number
  observaciones?: string
}

export interface CrearReclamoParams {
  cliente_id: string
  pedido_id?: string
  tipo_reclamo: string
  descripcion: string
  prioridad?: 'baja' | 'media' | 'alta'
  origen?: 'telefono' | 'whatsapp' | 'web'
}

export interface CrearReclamoBotParams extends CrearReclamoParams {
  origen: 'whatsapp'
}

// Reparto
export interface CrearVehiculoParams {
  patente: string
  marca?: string
  modelo?: string
  capacidad_kg: number
  tipo_vehiculo?: string
}

export interface ChecklistVehiculoParams {
  vehiculo_id: string
  aceite_motor: boolean
  luces: boolean
  frenos: boolean
  presion_neumaticos: boolean
  limpieza_interior: boolean
  limpieza_exterior: boolean
  combustible?: number
  kilometraje?: number
  observaciones?: string
  fotos_url?: string[]
}

export interface CrearRutaParams {
  vehiculo_id: string
  repartidor_id: string
  fecha_ruta: string
  pedidos_ids: string[]
  observaciones?: string
}

export interface ValidacionEntregaParams {
  pedido_id: string
  firma_url: string
  qr_verificacion: string
  notas_entrega?: string
}

// Tesorería
export interface CrearCajaParams {
  nombre: string
  saldo_inicial?: number
  moneda?: string
  sucursal_id?: string
}

export interface MovimientoCajaParams {
  caja_id: string
  tipo: 'ingreso' | 'egreso'
  monto: number
  descripcion?: string
  metodo_pago?: 'efectivo' | 'transferencia' | 'tarjeta'
  origen_tipo?: string
  origen_id?: string
}

export interface RegistrarGastoParams {
  sucursal_id?: string
  categoria_id?: string
  monto: number
  descripcion?: string
  fecha?: string
  comprobante_url?: string
  afecta_caja?: boolean
  caja_id?: string
}

export interface RegistrarPagoPedidoParams {
  pedido_id: string
  caja_id: string
  monto: number
  tipo_pago?: 'efectivo' | 'transferencia' | 'tarjeta'
}

export interface ExportReportParams {
  tipo: 'ventas' | 'gastos' | 'movimientos_caja' | 'cuentas_corrientes' | 'kg_por_ruta'
  formato?: 'csv' | 'pdf'
  filtros?: Record<string, any>
}

// Tipos para respuestas específicas
export interface StockDisponibleResponse {
  producto_id: string
  stock_disponible: number
  lotes: Array<{
    lote_id: string
    cantidad_disponible: number
    fecha_vencimiento?: string
  }>
}

export interface RutaActivaResponse {
  ruta_id: string
  numero_ruta: string
  fecha_ruta: string
  estado: string
  vehiculo: {
    patente: string
    marca?: string
    modelo?: string
  }
  entregas_pendientes: number
  entregas_completadas: number
}
