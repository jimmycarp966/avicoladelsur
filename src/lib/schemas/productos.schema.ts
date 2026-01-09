import { z } from 'zod'

// Esquema para crear/editar productos
export const productoSchema = z.object({
  codigo: z
    .string()
    .min(1, 'El código es requerido')
    .max(50, 'El código debe tener máximo 50 caracteres')
    .regex(/^[A-Z0-9-_]+$/, 'El código solo puede contener letras mayúsculas, números, guiones y guiones bajos'),

  nombre: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(255, 'El nombre debe tener máximo 255 caracteres'),

  descripcion: z
    .string()
    .max(1000, 'La descripción debe tener máximo 1000 caracteres')
    .optional(),

  categoria: z
    .string()
    .max(100, 'La categoría debe tener máximo 100 caracteres')
    .optional(),

  precio_venta: z
    .number()
    .min(0, 'El precio de venta debe ser mayor o igual a 0')
    .max(999999.99, 'El precio de venta es demasiado alto'),

  precio_costo: z
    .number()
    .min(0, 'El precio de costo debe ser mayor o igual a 0')
    .max(999999.99, 'El precio de costo es demasiado alto')
    .optional(),

  unidad_medida: z
    .string()
    .min(1, 'La unidad de medida es requerida')
    .max(20, 'La unidad de medida debe tener máximo 20 caracteres'),

  stock_minimo: z
    .number()
    .int('El stock mínimo debe ser un número entero')
    .min(0, 'El stock mínimo debe ser mayor o igual a 0')
    .max(999999, 'El stock mínimo es demasiado alto'),

  activo: z
    .boolean(),

  requiere_pesaje: z
    .boolean()
    .default(false),

  // Configuración de venta por mayor
  venta_mayor_habilitada: z
    .boolean()
    .default(false),

  unidad_mayor_nombre: z
    .string()
    .max(50, 'El nombre de unidad mayor debe tener máximo 50 caracteres')
    .optional()
    .default('caja'),

  kg_por_unidad_mayor: z
    .number()
    .positive('Los kg por unidad mayor deben ser positivos')
    .max(999, 'Los kg por unidad mayor son demasiado altos')
    .optional()
    .default(20),
})

// Esquema para búsqueda y filtros de productos
export const productosFilterSchema = z.object({
  search: z.string().optional(),
  categoria: z.string().optional(),
  activo: z.boolean().optional(),
  precio_min: z.number().min(0).optional(),
  precio_max: z.number().min(0).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
})

// Tipos inferidos
export type ProductoFormData = z.infer<typeof productoSchema>
// Tipo para input del formulario (acepta valores antes de aplicar defaults)
export type ProductoFormInput = z.input<typeof productoSchema>
export type ProductosFilterData = z.infer<typeof productosFilterSchema>
