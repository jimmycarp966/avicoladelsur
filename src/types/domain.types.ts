import { ROLES, ESTADOS_PEDIDO, ESTADOS_ENTREGA, type UserRole, type EstadoPedido, type EstadoEntrega } from '@/lib/config'

// Tipos base del dominio
export interface BaseEntity {
  id: string
  created_at: string
  updated_at?: string
}

// Usuario/Empleado
export interface Usuario extends BaseEntity {
  email: string
  nombre: string
  apellido?: string
  telefono?: string
  rol: UserRole
  vehiculo_asignado?: string
  activo: boolean
}

// Producto
export interface Producto extends BaseEntity {
  codigo: string
  nombre: string
  descripcion?: string
  categoria?: string
  precio_venta: number
  precio_costo?: number
  unidad_medida: string
  stock_minimo: number
  activo: boolean
}

// Cliente
export interface Cliente extends BaseEntity {
  codigo: string
  nombre: string
  telefono?: string
  whatsapp?: string
  email?: string
  direccion?: string
  localidad_id?: string
  zona_entrega?: string
  coordenadas?: {
    lat: number
    lng: number
  }
  tipo_cliente: string
  limite_credito: number
  activo: boolean
}

// Vehículo
export interface Vehiculo extends BaseEntity {
  patente: string
  marca?: string
  modelo?: string
  capacidad_kg: number
  tipo_vehiculo: string
  seguro_vigente: boolean
  fecha_vto_seguro?: string
  activo: boolean
}

// Lote/Mercadería
export interface Lote extends BaseEntity {
  numero_lote: string
  producto_id: string
  cantidad_ingresada: number
  cantidad_disponible: number
  fecha_ingreso: string
  fecha_vencimiento?: string
  proveedor?: string
  costo_unitario?: number
  ubicacion_almacen?: string
  estado: string
}

// Pedido
export interface Pedido extends BaseEntity {
  numero_pedido: string
  cliente_id: string
  usuario_vendedor?: string
  fecha_pedido: string
  fecha_entrega_estimada?: string
  fecha_entrega_real?: string
  estado: EstadoPedido
  tipo_pedido: string
  origen: string
  subtotal: number
  descuento: number
  total: number
  observaciones?: string
  turno?: 'mañana' | 'tarde'
  zona_id?: string
  metodos_pago?: any
  recargo_total?: number
  presupuesto_id?: string
}

// Detalle de Pedido
export interface DetallePedido extends BaseEntity {
  pedido_id: string
  producto_id: string
  lote_id?: string
  cantidad: number
  precio_unitario: number
  descuento: number
  subtotal: number
}

// Cotización
export interface Cotizacion extends BaseEntity {
  numero_cotizacion: string
  cliente_id: string
  usuario_vendedor?: string
  fecha_cotizacion: string
  fecha_vencimiento?: string
  estado: string
  subtotal: number
  descuento: number
  total: number
  observaciones?: string
}

// Reclamo
export interface Reclamo extends BaseEntity {
  numero_reclamo: string
  cliente_id: string
  pedido_id?: string
  tipo_reclamo: string
  descripcion: string
  estado: string
  prioridad: string
  fecha_resolucion?: string
  solucion?: string
  usuario_asignado?: string
  origen: string
}

// Checklist de Vehículo
export interface ChecklistVehiculo extends BaseEntity {
  vehiculo_id: string
  usuario_id: string
  fecha_check: string
  aceite_motor: boolean
  luces: boolean
  frenos: boolean
  presion_neumaticos: boolean
  limpieza_interior: boolean
  limpieza_exterior: boolean
  combustible?: number
  kilometraje?: number
  observaciones?: string
  aprobado: boolean
  fotos_url?: string[]
}

// Ruta de Reparto
export interface RutaReparto extends BaseEntity {
  numero_ruta: string
  vehiculo_id: string
  repartidor_id: string
  fecha_ruta: string
  turno?: 'mañana' | 'tarde'
  zona_id?: string
  estado: string
  distancia_estimada_km?: number
  distancia_real_km?: number
  tiempo_estimado_min?: number
  tiempo_real_min?: number
  peso_total_kg?: number
  costo_combustible?: number
  observaciones?: string
  checklist_inicio_id?: string
  checklist_fin_id?: string
}

// Detalle de Ruta
export interface DetalleRuta extends BaseEntity {
  ruta_id: string
  pedido_id: string
  orden_entrega: number
  distancia_parcial_km?: number
  tiempo_estimado_parcial_min?: number
  coordenadas_entrega?: {
    lat: number
    lng: number
  }
  estado_entrega: EstadoEntrega
  fecha_hora_entrega?: string
  notas_entrega?: string
  firma_url?: string
  qr_verificacion?: string
}

// Presupuesto
export interface Presupuesto extends BaseEntity {
  numero_presupuesto: string
  cliente_id: string
  zona_id?: string
  estado: 'pendiente' | 'cotizacion' | 'en_almacen' | 'facturado' | 'anulado'
  fecha_entrega_estimada?: string
  fecha_entrega_real?: string
  total_estimado: number
  total_final?: number
  observaciones?: string
  usuario_vendedor?: string
  usuario_almacen?: string
  usuario_repartidor?: string
  pedido_convertido_id?: string
  turno?: 'mañana' | 'tarde'
  metodos_pago?: any
  recargo_total?: number
}

// Presupuesto Item
export interface PresupuestoItem extends BaseEntity {
  presupuesto_id: string
  producto_id: string
  lote_reservado_id?: string
  cantidad_solicitada: number
  cantidad_reservada: number
  precio_unit_est: number
  precio_unit_final?: number
  pesable: boolean
  peso_final?: number
  subtotal_est: number
  subtotal_final?: number
}

// Zona
export interface Zona extends BaseEntity {
  nombre: string
  descripcion?: string
  activo: boolean
}

// Localidad
export interface Localidad extends BaseEntity {
  nombre: string
  zona_id: string
  zona?: Zona
  activo: boolean
}

// Zona Día
export interface ZonaDia extends BaseEntity {
  zona_id: string
  dia_semana: number // 0=domingo, 6=sábado
  turno: 'mañana' | 'tarde'
  activo: boolean
}

// Devolución
export interface Devolucion extends BaseEntity {
  pedido_id: string
  detalle_ruta_id?: string
  producto_id: string
  cantidad: number
  motivo: string
  observaciones?: string
  usuario_id: string
}

// Recepción Almacén
export interface RecepcionAlmacen extends BaseEntity {
  tipo: 'ingreso' | 'egreso'
  producto_id: string
  lote_id?: string
  cantidad: number
  unidad_medida: string
  motivo: string
  destino_produccion: boolean
  usuario_id: string
}

// Cierre de Caja
export interface CierreCaja extends BaseEntity {
  caja_id: string
  fecha: string
  saldo_inicial: number
  saldo_final?: number
  total_ingresos: number
  total_egresos: number
  cobranzas_cuenta_corriente: number
  gastos: number
  retiro_tesoro: number
  estado: 'abierto' | 'cerrado'
}

// Tesoro
export interface Tesoro extends BaseEntity {
  tipo: 'efectivo' | 'transferencia' | 'qr' | 'tarjeta'
  monto: number
  descripcion?: string
  origen_tipo?: string
  origen_id?: string
}

// Tipos para formularios
export interface FormResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  errors?: Record<string, string>
}

// Tipos para filtros y búsqueda
export interface PaginationParams {
  page: number
  limit: number
}

export interface SortParams {
  field: string
  direction: 'asc' | 'desc'
}

export interface FilterParams {
  [key: string]: any
}

export interface SearchParams extends PaginationParams {
  sort?: SortParams
  filters?: FilterParams
  search?: string
}

// Tipos para el bot
export interface BotWebhookPayload {
  intent: string
  parameters: Record<string, any>
  session: {
    userId: string
    channel: string
  }
}

export interface BotWebhookResponse {
  success: boolean
  message?: string
  data?: any
  error?: string
}

// Tipos para notificaciones
export interface NotificationItem {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message?: string
  timestamp: string
  read: boolean
}
