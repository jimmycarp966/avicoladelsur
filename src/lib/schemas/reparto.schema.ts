import { z } from 'zod'

// Esquema para crear/editar vehículo
export const vehiculoSchema = z.object({
  patente: z
    .string()
    .min(1, 'La patente es requerida')
    .max(20, 'La patente debe tener máximo 20 caracteres')
    .regex(/^[A-Z0-9\-]+$/, 'La patente solo puede contener letras mayúsculas, números y guiones'),

  marca: z
    .string()
    .max(100, 'La marca debe tener máximo 100 caracteres')
    .optional(),

  modelo: z
    .string()
    .max(100, 'El modelo debe tener máximo 100 caracteres')
    .optional(),

  capacidad_kg: z
    .number()
    .int('La capacidad debe ser un número entero')
    .min(1, 'La capacidad debe ser mayor a 0')
    .max(10000, 'La capacidad es demasiado alta'),

  tipo_vehiculo: z
    .enum(['fiat_fiorino', 'toyota_hilux', 'ford_f4000'])
    .default('fiat_fiorino'),

  seguro_vigente: z
    .boolean()
    .default(true),

  fecha_vto_seguro: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'La fecha de vencimiento del seguro tiene un formato inválido',
    }),

  activo: z
    .boolean()
    .default(true),
})

// Esquema para checklist de vehículo
export const checklistVehiculoSchema = z.object({
  vehiculo_id: z.string().uuid('ID de vehículo inválido'),

  aceite_motor: z.boolean().default(false),
  luces: z.boolean().default(false),
  frenos: z.boolean().default(false),
  presion_neumaticos: z.boolean().default(false),
  limpieza_interior: z.boolean().default(false),
  limpieza_exterior: z.boolean().default(false),

  combustible: z
    .number()
    .min(0, 'El combustible debe ser mayor o igual a 0')
    .max(100, 'El combustible debe ser menor o igual a 100')
    .optional(),

  kilometraje: z
    .number()
    .int('El kilometraje debe ser un número entero')
    .min(0, 'El kilometraje debe ser mayor o igual a 0')
    .max(9999999, 'El kilometraje es demasiado alto')
    .optional(),

  observaciones: z
    .string()
    .max(500, 'Las observaciones deben tener máximo 500 caracteres')
    .optional(),

  fotos_url: z
    .array(z.string().url('URL de foto inválida'))
    .max(10, 'No se pueden subir más de 10 fotos')
    .optional(),
})

// Esquema para crear ruta
export const crearRutaSchema = z.object({
  vehiculo_id: z.string().uuid('ID de vehículo inválido'),

  repartidor_id: z.string().uuid('ID de repartidor inválido'),

  fecha_ruta: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'La fecha de ruta tiene un formato inválido',
    }),

  turno: z.enum(['mañana', 'tarde'], {
    message: 'El turno es requerido y debe ser "mañana" o "tarde"',
  }),

  zona_id: z.string().uuid('ID de zona inválido'),

  pedidos_ids: z
    .array(z.string().uuid('ID de pedido inválido'))
    .min(1, 'La ruta debe tener al menos un pedido')
    .max(20, 'La ruta no puede tener más de 20 pedidos'),

  observaciones: z
    .string()
    .max(500, 'Las observaciones deben tener máximo 500 caracteres')
    .optional(),
})

// Esquema para registrar devolución
export const registrarDevolucionSchema = z.object({
  pedido_id: z.string().uuid('ID de pedido inválido'),
  detalle_ruta_id: z.string().uuid('ID de detalle de ruta inválido').optional(),
  producto_id: z.string().uuid('ID de producto inválido'),
  cantidad: z.number().positive('La cantidad debe ser mayor a 0'),
  motivo: z.string().min(1, 'El motivo es requerido'),
  observaciones: z.string().optional(),
})

// Esquema para actualizar estado de entrega
export const actualizarEstadoEntregaSchema = z.object({
  estado_entrega: z.enum([
    'pendiente',
    'en_camino',
    'entregado',
    'fallido'
  ]),

  notas_entrega: z
    .string()
    .max(500, 'Las notas de entrega deben tener máximo 500 caracteres')
    .optional(),
})

// Esquema para validar entrega
export const validarEntregaSchema = z.object({
  pedido_id: z.string().uuid('ID de pedido inválido'),

  firma_url: z
    .string()
    .url('URL de firma inválida'),

  qr_verificacion: z
    .string()
    .min(1, 'El código QR es requerido')
    .max(100, 'El código QR es demasiado largo'),

  notas_entrega: z
    .string()
    .max(500, 'Las notas de entrega deben tener máximo 500 caracteres')
    .optional(),
})

// Esquema para búsqueda y filtros de vehículos
export const vehiculosFilterSchema = z.object({
  search: z.string().optional(),
  tipo_vehiculo: z.enum(['fiat_fiorino', 'toyota_hilux', 'ford_f4000']).optional(),
  activo: z.boolean().optional(),
  seguro_vigente: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
})

// Esquema para búsqueda y filtros de rutas
export const rutasFilterSchema = z.object({
  search: z.string().optional(),
  vehiculo_id: z.string().uuid().optional(),
  repartidor_id: z.string().uuid().optional(),
  estado: z.enum(['planificada', 'en_curso', 'completada', 'cancelada']).optional(),
  turno: z.enum(['mañana', 'tarde']).optional(),
  zona_id: z.string().uuid().optional(),
  fecha_desde: z.string().optional(),
  fecha_hasta: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
})

// Esquema para búsqueda y filtros de entregas
export const entregasFilterSchema = z.object({
  search: z.string().optional(),
  ruta_id: z.string().uuid().optional(),
  pedido_id: z.string().uuid().optional(),
  estado_entrega: z.enum(['pendiente', 'en_camino', 'entregado', 'fallido']).optional(),
  fecha_desde: z.string().optional(),
  fecha_hasta: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(15),
})

// Tipos inferidos
export type VehiculoFormData = z.infer<typeof vehiculoSchema>
export type ChecklistVehiculoFormData = z.infer<typeof checklistVehiculoSchema>
export type CrearRutaFormData = z.infer<typeof crearRutaSchema>
export type ActualizarEstadoEntregaFormData = z.infer<typeof actualizarEstadoEntregaSchema>
export type ValidarEntregaFormData = z.infer<typeof validarEntregaSchema>
export type RegistrarDevolucionFormData = z.infer<typeof registrarDevolucionSchema>
export type VehiculosFilterData = z.infer<typeof vehiculosFilterSchema>
export type RutasFilterData = z.infer<typeof rutasFilterSchema>
export type EntregasFilterData = z.infer<typeof entregasFilterSchema>
