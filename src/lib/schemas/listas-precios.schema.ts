import { z } from 'zod'

// Schema para crear/actualizar lista de precios
export const listaPrecioSchema = z.object({
  codigo: z.string().min(1, 'El código es requerido').max(50, 'El código no puede exceder 50 caracteres'),
  nombre: z.string().min(1, 'El nombre es requerido').max(255, 'El nombre no puede exceder 255 caracteres'),
  tipo: z.enum(['minorista', 'mayorista', 'distribuidor', 'personalizada']).refine((val) => ['minorista', 'mayorista', 'distribuidor', 'personalizada'].includes(val), {
    message: 'Tipo de lista inválido'
  }),
  activa: z.boolean(),
  margen_ganancia: z.number().min(0, 'El margen no puede ser negativo').max(1000, 'El margen no puede exceder 1000%').optional().nullable(),
  vigencia_activa: z.boolean(),
  fecha_vigencia_desde: z.string().optional().nullable(),
  fecha_vigencia_hasta: z.string().optional().nullable(),
})

// Schema para crear/actualizar precio de producto
export const precioProductoSchema = z.object({
  lista_precio_id: z.string().uuid('ID de lista inválido'),
  producto_id: z.string().uuid('ID de producto inválido'),
  precio: z.number().positive('El precio debe ser mayor a 0'),
  fecha_desde: z.string().optional().nullable(),
  fecha_hasta: z.string().optional().nullable(),
  activo: z.boolean().default(true),
})

// Schema para asignar lista a cliente
export const asignarListaClienteSchema = z.object({
  cliente_id: z.string().uuid('ID de cliente inválido'),
  lista_precio_id: z.string().uuid('ID de lista inválido'),
  prioridad: z.number().int().min(1).max(2).default(1),
})

// Schema para actualizar prioridad de lista
export const actualizarPrioridadListaSchema = z.object({
  cliente_id: z.string().uuid('ID de cliente inválido'),
  lista_precio_id: z.string().uuid('ID de lista inválido'),
  prioridad: z.number().int().min(1).max(2),
})

// Tipos inferidos
export type ListaPrecioInput = z.infer<typeof listaPrecioSchema>
export type PrecioProductoInput = z.infer<typeof precioProductoSchema>
export type AsignarListaClienteInput = z.infer<typeof asignarListaClienteSchema>
export type ActualizarPrioridadListaInput = z.infer<typeof actualizarPrioridadListaSchema>

