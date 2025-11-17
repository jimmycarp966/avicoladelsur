import { z } from 'zod'

// Esquema para un item de cotización
export const cotizacionItemSchema = z.object({
  producto_id: z.string().uuid('ID de producto inválido'),
  cantidad: z
    .number()
    .min(0.01, 'La cantidad debe ser mayor a 0')
    .max(9999.99, 'La cantidad es demasiado alta'),
  precio_unitario: z
    .number()
    .min(0, 'El precio unitario debe ser mayor o igual a 0')
    .max(999999.99, 'El precio unitario es demasiado alto')
    .optional(), // Se calcula automáticamente si no se proporciona
})

// Esquema para crear cotización
export const crearCotizacionSchema = z.object({
  cliente_id: z.string().uuid('ID de cliente inválido'),

  items: z
    .array(cotizacionItemSchema)
    .min(1, 'La cotización debe tener al menos un item')
    .max(50, 'La cotización no puede tener más de 50 items'),

  fecha_vencimiento: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'La fecha de vencimiento tiene un formato inválido',
    })
    .refine((val) => !val || new Date(val) > new Date(), {
      message: 'La fecha de vencimiento debe ser futura',
    }),

  descuento: z
    .number()
    .min(0, 'El descuento debe ser mayor o igual a 0')
    .max(999999.99, 'El descuento es demasiado alto')
    .default(0),

  observaciones: z
    .string()
    .max(1000, 'Las observaciones deben tener máximo 1000 caracteres')
    .optional(),
})

// Esquema para actualizar estado de cotización
export const actualizarEstadoCotizacionSchema = z.object({
  estado: z.enum([
    'pendiente',
    'aprobada',
    'rechazada',
    'vencida'
  ]),

  observaciones: z
    .string()
    .max(500, 'Las observaciones deben tener máximo 500 caracteres')
    .optional(),
})

// Esquema para búsqueda y filtros de cotizaciones
export const cotizacionesFilterSchema = z.object({
  search: z.string().optional(),
  cliente_id: z.string().uuid().optional(),
  estado: z.enum([
    'pendiente',
    'aprobada',
    'rechazada',
    'vencida'
  ]).optional(),
  fecha_desde: z.string().optional(),
  fecha_hasta: z.string().optional(),
  fecha_vencimiento_desde: z.string().optional(),
  fecha_vencimiento_hasta: z.string().optional(),
  usuario_vendedor: z.string().uuid().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
})

// Tipos inferidos
export type CotizacionItemFormData = z.infer<typeof cotizacionItemSchema>
export type CrearCotizacionFormData = z.infer<typeof crearCotizacionSchema>
export type ActualizarEstadoCotizacionFormData = z.infer<typeof actualizarEstadoCotizacionSchema>
export type CotizacionesFilterData = z.infer<typeof cotizacionesFilterSchema>
