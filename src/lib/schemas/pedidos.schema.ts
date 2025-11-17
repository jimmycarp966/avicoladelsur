import { z } from 'zod'

// Esquema para un item de pedido
export const pedidoItemSchema = z.object({
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

// Esquema para crear pedido
export const crearPedidoSchema = z.object({
  cliente_id: z.string().uuid('ID de cliente inválido'),

  items: z
    .array(pedidoItemSchema)
    .min(1, 'El pedido debe tener al menos un item')
    .max(50, 'El pedido no puede tener más de 50 items'),

  fecha_entrega_estimada: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'La fecha de entrega estimada tiene un formato inválido',
    })
    .refine((val) => !val || new Date(val) > new Date(), {
      message: 'La fecha de entrega estimada debe ser futura',
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

// Esquema para crear pedido desde bot (WhatsApp)
export const crearPedidoBotSchema = z.object({
  cliente_id: z.string().uuid('ID de cliente inválido'),

  items: z
    .array(z.object({
      producto_id: z.string().uuid('ID de producto inválido'),
      cantidad: z
        .number()
        .min(0.01, 'La cantidad debe ser mayor a 0')
        .max(9999.99, 'La cantidad es demasiado alta'),
      precio_unitario: z
        .number()
        .min(0, 'El precio unitario debe ser mayor o igual a 0')
        .max(999999.99, 'El precio unitario es demasiado alto')
        .optional(),
    }))
    .min(1, 'El pedido debe tener al menos un item')
    .max(20, 'El pedido no puede tener más de 20 items'),

  observaciones: z
    .string()
    .max(500, 'Las observaciones deben tener máximo 500 caracteres')
    .optional(),

  origen: z
    .literal('whatsapp')
    .default('whatsapp'),
})

// Esquema para actualizar estado de pedido
export const actualizarEstadoPedidoSchema = z.object({
  estado: z.enum([
    'pendiente',
    'confirmado',
    'preparando',
    'enviado',
    'entregado',
    'cancelado'
  ]),

  observaciones: z
    .string()
    .max(500, 'Las observaciones deben tener máximo 500 caracteres')
    .optional(),
})

// Esquema para búsqueda y filtros de pedidos
export const pedidosFilterSchema = z.object({
  search: z.string().optional(),
  cliente_id: z.string().uuid().optional(),
  estado: z.enum([
    'pendiente',
    'confirmado',
    'preparando',
    'enviado',
    'entregado',
    'cancelado'
  ]).optional(),
  origen: z.enum(['web', 'whatsapp', 'telefono']).optional(),
  fecha_desde: z.string().optional(),
  fecha_hasta: z.string().optional(),
  usuario_vendedor: z.string().uuid().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(15),
})

// Tipos inferidos
export type PedidoItemFormData = z.infer<typeof pedidoItemSchema>
export type CrearPedidoFormData = z.infer<typeof crearPedidoSchema>
export type CrearPedidoBotFormData = z.infer<typeof crearPedidoBotSchema>
export type ActualizarEstadoPedidoFormData = z.infer<typeof actualizarEstadoPedidoSchema>
export type PedidosFilterData = z.infer<typeof pedidosFilterSchema>
