import { z } from 'zod'

// Esquema para ingreso de mercadería
export const ingresoMercaderiaSchema = z.object({
  producto_id: z.string().uuid('ID de producto inválido'),

  cantidad: z
    .number()
    .min(0.01, 'La cantidad debe ser mayor a 0')
    .max(99999.99, 'La cantidad es demasiado alta'),

  fecha_vencimiento: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'La fecha de vencimiento tiene un formato inválido',
    })
    .refine((val) => !val || new Date(val) > new Date(), {
      message: 'La fecha de vencimiento debe ser futura',
    }),

  proveedor: z
    .string()
    .max(255, 'El proveedor debe tener máximo 255 caracteres')
    .optional(),

  costo_unitario: z
    .number()
    .min(0, 'El costo unitario debe ser mayor o igual a 0')
    .max(999999.99, 'El costo unitario es demasiado alto')
    .optional(),

  ubicacion_almacen: z
    .string()
    .max(100, 'La ubicación debe tener máximo 100 caracteres')
    .optional(),
})

// Esquema para actualizar lote
export const actualizarLoteSchema = z.object({
  cantidad: z
    .number()
    .min(0, 'La cantidad debe ser mayor o igual a 0')
    .max(99999.99, 'La cantidad es demasiado alta')
    .optional(),

  fecha_vencimiento: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'La fecha de vencimiento tiene un formato inválido',
    }),

  proveedor: z
    .string()
    .max(255, 'El proveedor debe tener máximo 255 caracteres')
    .optional(),

  costo_unitario: z
    .number()
    .min(0, 'El costo unitario debe ser mayor o igual a 0')
    .max(999999.99, 'El costo unitario es demasiado alto')
    .optional(),

  ubicacion_almacen: z
    .string()
    .max(100, 'La ubicación debe tener máximo 100 caracteres')
    .optional(),

  estado: z
    .enum(['disponible', 'reservado', 'vencido', 'rechazado'])
    .optional(),
})

// Esquema para movimiento de stock
export const movimientoStockSchema = z.object({
  lote_id: z.string().uuid('ID de lote inválido'),

  tipo_movimiento: z.enum([
    'ingreso',
    'salida',
    'ajuste'
  ]),

  cantidad: z
    .number()
    .min(0.01, 'La cantidad debe ser mayor a 0')
    .max(99999.99, 'La cantidad es demasiado alta'),

  motivo: z
    .string()
    .max(500, 'El motivo debe tener máximo 500 caracteres')
    .optional(),
})

// Esquema para checklist de calidad
export const checklistCalidadSchema = z.object({
  lote_id: z.string().uuid('ID de lote inválido'),

  temperatura: z
    .number()
    .min(-50, 'La temperatura es demasiado baja')
    .max(50, 'La temperatura es demasiado alta')
    .optional(),

  humedad: z
    .number()
    .min(0, 'La humedad debe ser mayor o igual a 0')
    .max(100, 'La humedad debe ser menor o igual a 100')
    .optional(),

  apariencia: z
    .string()
    .max(255, 'La apariencia debe tener máximo 255 caracteres')
    .optional(),

  aprobado: z.boolean(),

  observaciones: z
    .string()
    .max(500, 'Las observaciones deben tener máximo 500 caracteres')
    .optional(),
})

// Esquema para búsqueda y filtros de lotes
export const lotesFilterSchema = z.object({
  search: z.string().optional(),
  producto_id: z.string().uuid().optional(),
  estado: z.enum(['disponible', 'reservado', 'vencido', 'rechazado']).optional(),
  proveedor: z.string().optional(),
  fecha_ingreso_desde: z.string().optional(),
  fecha_ingreso_hasta: z.string().optional(),
  fecha_vencimiento_desde: z.string().optional(),
  fecha_vencimiento_hasta: z.string().optional(),
  ubicacion_almacen: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
})

// Esquema para búsqueda y filtros de movimientos de stock
export const movimientosStockFilterSchema = z.object({
  search: z.string().optional(),
  lote_id: z.string().uuid().optional(),
  tipo_movimiento: z.enum(['ingreso', 'salida', 'ajuste']).optional(),
  usuario_id: z.string().uuid().optional(),
  pedido_id: z.string().uuid().optional(),
  fecha_desde: z.string().optional(),
  fecha_hasta: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(15),
})

// Tipos inferidos
export type IngresoMercaderiaFormData = z.infer<typeof ingresoMercaderiaSchema>
export type ActualizarLoteFormData = z.infer<typeof actualizarLoteSchema>
export type MovimientoStockFormData = z.infer<typeof movimientoStockSchema>
export type ChecklistCalidadFormData = z.infer<typeof checklistCalidadSchema>
export type LotesFilterData = z.infer<typeof lotesFilterSchema>
export type MovimientosStockFilterData = z.infer<typeof movimientosStockFilterSchema>
