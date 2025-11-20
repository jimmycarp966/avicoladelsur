import { z } from 'zod'

export const crearCajaSchema = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  saldo_inicial: z.number().min(0, 'El saldo inicial no puede ser negativo').default(0),
  moneda: z.string().min(3).max(6).default('ARS'),
  sucursal_id: z.string().uuid('ID de sucursal inválido').optional(),
})

export const movimientoCajaSchema = z.object({
  caja_id: z.string().uuid('ID de caja inválido'),
  tipo: z.enum(['ingreso', 'egreso']),
  monto: z.number().min(0.01, 'El monto debe ser mayor a 0'),
  descripcion: z.string().max(500, 'La descripción es demasiado larga').optional(),
  metodo_pago: z.enum(['efectivo', 'transferencia', 'tarjeta']).default('efectivo'),
  origen_tipo: z.string().max(50).optional(),
  origen_id: z.string().uuid().optional(),
})

export const registrarGastoSchema = z.object({
  sucursal_id: z.string().uuid().optional(),
  categoria_id: z.string().uuid('ID de categoría inválido').optional(),
  monto: z.number().min(0.01, 'El monto debe ser mayor a 0'),
  descripcion: z.string().max(500).optional(),
  fecha: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), 'Fecha inválida'),
  comprobante_url: z.string().url('URL inválida').optional(),
  afecta_caja: z.boolean().default(false),
  caja_id: z.string().uuid().optional(),
})

export const registrarPagoPedidoSchema = z.object({
  pedido_id: z.string().uuid('ID de pedido inválido'),
  caja_id: z.string().uuid('ID de caja inválido'),
  monto: z.number().min(0.01, 'El monto debe ser mayor a 0'),
  tipo_pago: z.enum(['efectivo', 'transferencia', 'tarjeta']).default('efectivo'),
})

export const exportReportSchema = z.object({
  tipo: z.enum(['ventas', 'gastos', 'movimientos_caja', 'cuentas_corrientes', 'kg_por_ruta']),
  formato: z.enum(['csv', 'pdf']).default('csv'),
  filtros: z.record(z.string(), z.any()).optional(),
})

// Schema para crear cierre de caja
export const crearCierreCajaSchema = z.object({
  caja_id: z.string().uuid('ID de caja inválido'),
  fecha: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Fecha inválida',
  }),
})

// Schema para cerrar cierre de caja
export const cerrarCierreCajaSchema = z.object({
  cierre_id: z.string().uuid('ID de cierre inválido'),
  saldo_final: z.number().min(0, 'El saldo final no puede ser negativo'),
  total_ingresos: z.number().min(0).default(0),
  total_egresos: z.number().min(0).default(0),
  cobranzas_cuenta_corriente: z.number().min(0).default(0),
  gastos: z.number().min(0).default(0),
  retiro_tesoro: z.number().min(0).default(0),
})

// Schema para registrar retiro al tesoro
export const registrarRetiroTesoroSchema = z.object({
  tipo: z.enum(['efectivo', 'transferencia', 'qr', 'tarjeta']),
  monto: z.number().positive('El monto debe ser mayor a 0'),
  descripcion: z.string().optional(),
})

// Schema para registrar depósito bancario
export const registrarDepositoBancarioSchema = z.object({
  monto: z.number().positive('El monto debe ser mayor a 0'),
  numero_transaccion: z
    .string()
    .min(1, 'El número de transacción es requerido')
    .refine((val) => !val.startsWith('0'), {
      message: 'El número de transacción BNA no debe empezar con 0',
    })
    .refine((val) => /^\d+$/.test(val), {
      message: 'El número de transacción debe contener solo dígitos',
    }),
})

// Schema para validar transferencia BNA
export const validarTransferenciaBNASchema = z.object({
  numero_transaccion: z
    .string()
    .min(1, 'El número de transacción es requerido')
    .refine((val) => !val.startsWith('0'), {
      message: 'El número de transacción BNA no debe empezar con 0',
    })
    .refine((val) => /^\d+$/.test(val), {
      message: 'El número de transacción debe contener solo dígitos',
    }),
})

export type CrearCajaFormData = z.infer<typeof crearCajaSchema>
export type MovimientoCajaFormData = z.infer<typeof movimientoCajaSchema>
export type RegistrarGastoFormData = z.infer<typeof registrarGastoSchema>
export type RegistrarPagoPedidoFormData = z.infer<typeof registrarPagoPedidoSchema>
export type ExportReportFormData = z.infer<typeof exportReportSchema>
export type CrearCierreCajaFormData = z.infer<typeof crearCierreCajaSchema>
export type CerrarCierreCajaFormData = z.infer<typeof cerrarCierreCajaSchema>
export type RegistrarRetiroTesoroFormData = z.infer<typeof registrarRetiroTesoroSchema>
export type RegistrarDepositoBancarioFormData = z.infer<typeof registrarDepositoBancarioSchema>
export type ValidarTransferenciaBNAFormData = z.infer<typeof validarTransferenciaBNASchema>

