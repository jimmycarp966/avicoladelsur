import { z } from 'zod'

// Esquema para crear reclamo
export const crearReclamoSchema = z.object({
  cliente_id: z.string().uuid('ID de cliente inválido'),

  pedido_id: z
    .string()
    .uuid('ID de pedido inválido')
    .optional(),

  tipo_reclamo: z.enum([
    'producto_dañado',
    'entrega_tardia',
    'cantidad_erronea',
    'producto_equivocado',
    'precio_incorrecto',
    'calidad_deficiente',
    'empaque_dañado',
    'otro'
  ]),

  descripcion: z
    .string()
    .min(10, 'La descripción debe tener al menos 10 caracteres')
    .max(1000, 'La descripción debe tener máximo 1000 caracteres'),

  prioridad: z
    .enum(['baja', 'media', 'alta', 'urgente'])
    .default('media'),

  origen: z
    .enum(['telefono', 'whatsapp', 'web', 'presencial'])
    .default('telefono'),
})

// Esquema para crear reclamo desde bot
export const crearReclamoBotSchema = z.object({
  cliente_telefono: z
    .string()
    .min(1, 'El teléfono del cliente es requerido')
    .max(20, 'El teléfono del cliente es demasiado largo'),

  pedido_numero: z
    .string()
    .optional(),

  tipo_reclamo: z.enum([
    'producto_dañado',
    'entrega_tardia',
    'cantidad_erronea',
    'producto_equivocado',
    'precio_incorrecto',
    'calidad_deficiente',
    'empaque_dañado',
    'otro'
  ]),

  descripcion: z
    .string()
    .min(10, 'La descripción debe tener al menos 10 caracteres')
    .max(500, 'La descripción debe tener máximo 500 caracteres'),
})

// Esquema para actualizar estado de reclamo
export const actualizarEstadoReclamoSchema = z.object({
  estado: z.enum([
    'abierto',
    'investigando',
    'resuelto',
    'cerrado'
  ]),

  solucion: z
    .string()
    .max(1000, 'La solución debe tener máximo 1000 caracteres')
    .optional(),

  usuario_asignado: z
    .string()
    .uuid('ID de usuario inválido')
    .optional(),

  observaciones: z
    .string()
    .max(500, 'Las observaciones deben tener máximo 500 caracteres')
    .optional(),
})

// Esquema para búsqueda y filtros de reclamos
export const reclamosFilterSchema = z.object({
  search: z.string().optional(),
  cliente_id: z.string().uuid().optional(),
  pedido_id: z.string().uuid().optional(),
  tipo_reclamo: z.enum([
    'producto_dañado',
    'entrega_tardia',
    'cantidad_erronea',
    'producto_equivocado',
    'precio_incorrecto',
    'calidad_deficiente',
    'empaque_dañado',
    'otro'
  ]).optional(),
  estado: z.enum([
    'abierto',
    'investigando',
    'resuelto',
    'cerrado'
  ]).optional(),
  prioridad: z.enum(['baja', 'media', 'alta', 'urgente']).optional(),
  origen: z.enum(['telefono', 'whatsapp', 'web', 'presencial']).optional(),
  fecha_desde: z.string().optional(),
  fecha_hasta: z.string().optional(),
  usuario_asignado: z.string().uuid().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
})

// Tipos inferidos
export type CrearReclamoFormData = z.infer<typeof crearReclamoSchema>
export type CrearReclamoBotFormData = z.infer<typeof crearReclamoBotSchema>
export type ActualizarEstadoReclamoFormData = z.infer<typeof actualizarEstadoReclamoSchema>
export type ReclamosFilterData = z.infer<typeof reclamosFilterSchema>
