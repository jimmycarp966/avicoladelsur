// Re-export de todos los esquemas Zod
export * from './auth.schema'
export * from './productos.schema'
export * from './clientes.schema'
export * from './pedidos.schema'
export * from './cotizaciones.schema'
export * from './reclamos.schema'
export * from './almacen.schema'
export * from './reparto.schema'
export * from './tesoreria.schema'
export * from './presupuestos.schema'

// Re-export de tipos
export type {
  LoginFormData,
  RegisterUserFormData,
  ChangePasswordFormData,
  ResetPasswordFormData,
} from './auth.schema'

export type {
  ProductoFormData,
  ProductosFilterData,
} from './productos.schema'

export type {
  ClienteFormData,
  ClientesFilterData,
} from './clientes.schema'

export type {
  PedidoItemFormData,
  CrearPedidoFormData,
  CrearPedidoBotFormData,
  ActualizarEstadoPedidoFormData,
  PedidosFilterData,
} from './pedidos.schema'

export type {
  CotizacionItemFormData,
  CrearCotizacionFormData,
  ActualizarEstadoCotizacionFormData,
  CotizacionesFilterData,
} from './cotizaciones.schema'

export type {
  CrearReclamoFormData,
  CrearReclamoBotFormData,
  ActualizarEstadoReclamoFormData,
  ReclamosFilterData,
} from './reclamos.schema'

export type {
  IngresoMercaderiaFormData,
  ActualizarLoteFormData,
  MovimientoStockFormData,
  ChecklistCalidadFormData,
  LotesFilterData,
  MovimientosStockFilterData,
} from './almacen.schema'

export type {
  VehiculoFormData,
  ChecklistVehiculoFormData,
  CrearRutaFormData,
  ActualizarEstadoEntregaFormData,
  ValidarEntregaFormData,
  RegistrarDevolucionFormData,
  VehiculosFilterData,
  RutasFilterData,
  EntregasFilterData,
} from './reparto.schema'

export type {
  CrearCajaFormData,
  MovimientoCajaFormData,
  RegistrarGastoFormData,
  RegistrarPagoPedidoFormData,
  ExportReportFormData,
  CrearCierreCajaFormData,
  CerrarCierreCajaFormData,
  RegistrarRetiroTesoroFormData,
  RegistrarDepositoBancarioFormData,
  ValidarTransferenciaBNAFormData,
} from './tesoreria.schema'
