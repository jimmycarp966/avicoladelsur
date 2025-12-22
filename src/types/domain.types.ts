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
  // Configuración de venta por mayor
  venta_mayor_habilitada: boolean
  unidad_mayor_nombre?: string
  kg_por_unidad_mayor?: number
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
  listas_precios?: ClienteListaPrecio[]
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
  ubicacion_almacen?: string
  estado: string
  // Campos de producción
  orden_produccion_id?: string
  es_produccion: boolean
  // Relaciones
  producto?: Producto
}

// Pedido
export interface Pedido extends BaseEntity {
  numero_pedido: string
  cliente_id?: string | null
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
  lista_precio_id?: string
  // Relaciones (joins)
  cliente?: {
    id: string
    nombre: string
    telefono?: string
    zona_entrega?: string
  } | null
  vendedor?: {
    id: string
    nombre: string
    apellido?: string
  } | null
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
  fecha_planificada?: string // Alias común para fecha_ruta
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
  // Relaciones (joins)
  repartidor?: {
    id: string
    nombre: string
    apellido?: string
  } | null
  vehiculo?: {
    id: string
    patente: string
    marca?: string
    modelo?: string
    capacidad_kg?: number
  } | null
  zona?: {
    id: string
    nombre: string
  } | null
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
  lista_precio_id?: string
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
  tipo: 'efectivo' | 'transferencia' | 'qr' | 'tarjeta_debito' | 'tarjeta_credito'
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

// ===========================================
// RRHH - RECURSOS HUMANOS
// ===========================================

// Sucursal
export interface Sucursal extends BaseEntity {
  nombre: string
  direccion?: string
  telefono?: string
  encargado_id?: string
  activo: boolean
  // Relaciones calculadas
  encargado?: Empleado
  empleados_count?: number
}

// Categoría de empleado
export interface CategoriaEmpleado extends BaseEntity {
  nombre: string
  descripcion?: string
  sueldo_basico: number
  adicional_cajero: number
  adicional_produccion: number
  activo: boolean
  // Relaciones calculadas
  empleados_count?: number
}

// Empleado
export interface Empleado extends BaseEntity {
  usuario_id?: string
  sucursal_id?: string
  categoria_id?: string
  legajo?: string
  nombre?: string
  apellido?: string
  fecha_ingreso: string
  fecha_nacimiento?: string
  dni?: string
  cuil?: string
  domicilio?: string
  telefono_personal?: string
  contacto_emergencia?: string
  telefono_emergencia?: string
  obra_social?: string
  numero_afiliado?: string
  banco?: string
  cbu?: string
  numero_cuenta?: string
  sueldo_actual?: number
  valor_jornal_presentismo?: number
  valor_hora?: number
  activo: boolean
  // Relaciones calculadas
  usuario?: Usuario
  sucursal?: Sucursal
  categoria?: CategoriaEmpleado
}

// Novedades RRHH
export interface NovedadRRHH extends BaseEntity {
  titulo: string
  descripcion?: string
  tipo: 'general' | 'sucursal' | 'categoria'
  sucursal_id?: string
  categoria_id?: string
  fecha_publicacion: string
  fecha_expiracion?: string
  prioridad: 'baja' | 'normal' | 'alta' | 'urgente'
  activo: boolean
  created_by?: string
  // Relaciones calculadas
  sucursal?: Sucursal
  categoria?: CategoriaEmpleado
  creador?: Usuario
}

// Asistencia
export interface Asistencia extends BaseEntity {
  empleado_id: string
  fecha: string
  hora_entrada?: string
  hora_salida?: string
  horas_trabajadas?: number
  turno?: 'mañana' | 'tarde' | 'noche'
  estado: 'presente' | 'ausente' | 'tarde' | 'licencia'
  observaciones?: string
  retraso_minutos: number
  falta_sin_aviso: boolean
  // Relaciones calculadas
  empleado?: Empleado
}

// Licencias y descansos
export interface Licencia extends BaseEntity {
  empleado_id: string
  tipo: 'vacaciones' | 'enfermedad' | 'maternidad' | 'estudio' | 'otro'
  fecha_inicio: string
  fecha_fin: string
  dias_total: number
  aprobado: boolean
  aprobado_por?: string
  fecha_aprobacion?: string
  observaciones?: string
  // Relaciones calculadas
  empleado?: Empleado
  aprobador?: Usuario
}

// Adelantos
export interface Adelanto extends BaseEntity {
  empleado_id: string
  tipo: 'dinero' | 'producto'
  monto?: number
  producto_id?: string
  cantidad?: number
  precio_unitario?: number
  fecha_solicitud: string
  aprobado: boolean
  aprobado_por?: string
  fecha_aprobacion?: string
  porcentaje_sueldo?: number
  observaciones?: string
  // Relaciones calculadas
  empleado?: Empleado
  producto?: Producto
  aprobador?: Usuario
}

// Liquidaciones de sueldo
export interface Liquidacion extends BaseEntity {
  empleado_id: string
  periodo_mes: number
  periodo_anio: number
  fecha_liquidacion: string
  sueldo_basico: number
  adicional_cajero: number
  adicional_produccion: number
  horas_trabajadas: number
  turnos_trabajados: number
  horas_extras: number
  valor_hora_extra: number
  kg_producidos: number
  valor_kg: number
  total_bruto: number
  descuentos_total: number
  adelantos_total: number
  total_neto: number
  estado: 'borrador' | 'calculada' | 'aprobada' | 'pagada'
  aprobado_por?: string
  fecha_aprobacion?: string
  pagado: boolean
  fecha_pago?: string
  observaciones?: string
  created_by?: string
  // Relaciones calculadas
  empleado?: Empleado
  aprobador?: Usuario
  creador?: Usuario
  detalles?: LiquidacionDetalle[]
}

// Detalles de liquidación
export interface LiquidacionDetalle extends BaseEntity {
  liquidacion_id: string
  tipo: string
  descripcion?: string
  monto: number
  referencia_id?: string
  // Relaciones calculadas
  liquidacion?: Liquidacion
}

// Descuentos (distintos de adelantos)
export interface Descuento extends BaseEntity {
  empleado_id: string
  tipo: 'multa' | 'daño_equipo' | 'otro'
  monto: number
  fecha: string
  motivo: string
  observaciones?: string
  aprobado: boolean
  aprobado_por?: string
  fecha_aprobacion?: string
  liquidacion_id?: string
  // Relaciones calculadas
  empleado?: Empleado
  aprobador?: Usuario
  liquidacion?: Liquidacion
}

// Evaluaciones de desempeño
export interface Evaluacion extends BaseEntity {
  empleado_id: string
  sucursal_id: string
  periodo_mes: number
  periodo_anio: number
  puntualidad?: number // 1-5
  rendimiento?: number // 1-5
  actitud?: number // 1-5
  responsabilidad?: number // 1-5
  trabajo_equipo?: number // 1-5
  promedio?: number // calculado automáticamente
  fortalezas?: string
  areas_mejora?: string
  objetivos?: string
  comentarios?: string
  evaluador_id: string
  fecha_evaluacion: string
  estado: 'borrador' | 'enviada' | 'completada'
  notificado: boolean
  fecha_notificacion?: string
  // Relaciones calculadas
  empleado?: Empleado
  sucursal?: Sucursal
  evaluador?: Usuario
}

// Tipos para estadísticas RRHH
export interface EstadisticasRRHH {
  empleados_activos: number
  empleados_por_sucursal: Record<string, number>
  asistencia_promedio: number
  faltas_mes_actual: number
  adelantos_pendientes: number
  liquidaciones_pendientes: number
  evaluaciones_pendientes: number
}

// Tipos para reportes RRHH
export interface ReporteAsistencia {
  empleado_id: string
  empleado_nombre: string
  fecha: string
  estado: string
  retraso_minutos: number
  falta_sin_aviso: boolean
}

export interface ReporteLiquidacion {
  empleado_id: string
  empleado_nombre: string
  periodo: string
  total_bruto: number
  total_neto: number
  estado: string
}

export interface ReporteAdelantos {
  empleado_id: string
  empleado_nombre: string
  tipo: string
  monto: number
  fecha_aprobacion: string
  estado: string
}

// Lista de Precios
export interface ListaPrecio extends BaseEntity {
  codigo: string
  nombre: string
  tipo: 'minorista' | 'mayorista' | 'distribuidor' | 'personalizada'
  activa: boolean
  margen_ganancia?: number // Porcentaje de margen (ej: 30 = 30%)
  vigencia_activa?: boolean // Si true, valida fechas de vigencia. Si false, lista siempre vigente
  fecha_vigencia_desde?: string
  fecha_vigencia_hasta?: string
}

// Precio de Producto en Lista
export interface PrecioProducto extends BaseEntity {
  lista_precio_id: string
  producto_id: string
  precio: number
  fecha_desde?: string
  fecha_hasta?: string
  activo: boolean
  producto?: Producto
  lista_precio?: ListaPrecio
}

// Asignación de Lista a Cliente
export interface ClienteListaPrecio extends BaseEntity {
  cliente_id: string
  lista_precio_id: string
  es_automatica: boolean
  prioridad: number
  activa: boolean
  lista_precio?: ListaPrecio
  cliente?: Cliente
}

// ===========================================
// PRODUCCIÓN / DESPOSTE
// ===========================================

// Estado de orden de producción
export type EstadoOrdenProduccion = 'en_proceso' | 'completada' | 'cancelada'

// Orden de Producción
export interface OrdenProduccion extends BaseEntity {
  numero_orden: string
  fecha_produccion: string
  estado: EstadoOrdenProduccion
  operario_id?: string
  observaciones?: string
  // Métricas
  peso_total_entrada: number
  peso_total_salida: number
  merma_kg: number
  merma_porcentaje: number
  // Relaciones
  operario?: Usuario
  entradas?: OrdenProduccionEntrada[]
  salidas?: OrdenProduccionSalida[]
}

// Entrada de Producción (producto consumido)
export interface OrdenProduccionEntrada extends BaseEntity {
  orden_id: string
  producto_id: string
  lote_id?: string
  cantidad: number
  peso_kg?: number
  // Relaciones
  producto?: Producto
  lote?: Lote
}

// Salida de Producción (producto generado)
export interface OrdenProduccionSalida extends BaseEntity {
  orden_id: string
  producto_id: string
  lote_generado_id?: string
  cantidad: number
  peso_kg: number
  plu?: string
  fecha_vencimiento?: string
  pesaje_id?: string
  // Relaciones
  producto?: Producto
  lote_generado?: Lote
}

// Configuración de Balanza
export interface BalanzaConfig extends BaseEntity {
  nombre: string
  modelo?: string
  indicador?: string
  puerto?: string
  baudrate: number
  data_bits: number
  parity: 'none' | 'even' | 'odd'
  stop_bits: number
  activa: boolean
  ultima_sincronizacion?: string
}

// Pesaje (registro individual)
export interface Pesaje extends BaseEntity {
  balanza_id?: string
  producto_id?: string
  orden_produccion_id?: string
  peso_bruto: number
  tara: number
  peso_neto: number
  unidad: string
  operario_id?: string
  // Relaciones
  balanza?: BalanzaConfig
  producto?: Producto
  operario?: Usuario
}

