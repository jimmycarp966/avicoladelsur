import { z } from 'zod'

// Esquema para crear/editar clientes
export const clienteSchema = z.object({
  codigo: z
    .string()
    .min(1, 'El código es requerido')
    .max(50, 'El código debe tener máximo 50 caracteres')
    .regex(/^[A-Z0-9-_]+$/, 'El código solo puede contener letras mayúsculas, números, guiones y guiones bajos'),

  nombre: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(255, 'El nombre debe tener máximo 255 caracteres'),

  telefono: z
    .string()
    .max(20, 'El teléfono debe tener máximo 20 caracteres')
    .optional()
    .refine((val) => !val || /^[0-9+\-\s()]+$/.test(val), {
      message: 'El teléfono tiene un formato inválido',
    }),

  whatsapp: z
    .string()
    .max(20, 'El WhatsApp debe tener máximo 20 caracteres')
    .optional()
    .refine((val) => !val || /^[0-9+\-\s()]+$/.test(val), {
      message: 'El WhatsApp tiene un formato inválido',
    }),

  email: z
    .string()
    .max(255, 'El email debe tener máximo 255 caracteres')
    .optional()
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: 'El email tiene un formato inválido',
    }),

  direccion: z
    .string()
    .max(1000, 'La dirección debe tener máximo 1000 caracteres')
    .optional(),

  zona_entrega: z
    .string()
    .max(100, 'La zona de entrega debe tener máximo 100 caracteres')
    .optional()
    .or(z.literal('')),

  coordenadas: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),

  tipo_cliente: z
    .enum(['minorista', 'mayorista', 'distribuidor']),

  limite_credito: z
    .number()
    .min(0, 'El límite de crédito debe ser mayor o igual a 0')
    .max(999999.99, 'El límite de crédito es demasiado alto'),

  activo: z
    .boolean(),
})

// Esquema para búsqueda y filtros de clientes
export const clientesFilterSchema = z.object({
  search: z.string().optional(),
  zona_entrega: z.string().optional(),
  tipo_cliente: z.enum(['minorista', 'mayorista', 'distribuidor']).optional(),
  activo: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
})

// Tipos inferidos
export type ClienteFormData = z.infer<typeof clienteSchema>
export type ClientesFilterData = z.infer<typeof clientesFilterSchema>
