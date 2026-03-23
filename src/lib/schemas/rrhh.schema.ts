import { z } from 'zod'

// ===========================================
// RRHH - ESQUEMAS DE VALIDACIÓN
// ===========================================

// Esquema para sucursales
export const sucursalSchema = z.object({
  nombre: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(255, 'El nombre debe tener máximo 255 caracteres'),

  direccion: z
    .string()
    .max(500, 'La dirección debe tener máximo 500 caracteres')
    .optional(),

  telefono: z
    .string()
    .max(20, 'El teléfono debe tener máximo 20 caracteres')
    .optional()
    .refine((val) => !val || /^[0-9+\-\s()]+$/.test(val), {
      message: 'El teléfono tiene un formato inválido',
    }),

  encargado_id: z
    .string()
    .uuid('ID de encargado inválido')
    .optional(),

  activo: z.boolean().default(true)
})

// Esquema para categorías de empleados
export const categoriaEmpleadoSchema = z.object({
  nombre: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(100, 'El nombre debe tener máximo 100 caracteres'),

  descripcion: z
    .string()
    .max(500, 'La descripción debe tener máximo 500 caracteres')
    .optional(),

  sueldo_basico: z
    .number()
    .min(0, 'El sueldo básico debe ser mayor o igual a 0')
    .max(10000000, 'El sueldo básico es demasiado alto'),

  adicional_cajero: z
    .number()
    .min(0, 'El adicional de cajero debe ser mayor o igual a 0')
    .default(0),

  adicional_produccion: z
    .number()
    .min(0, 'El adicional de producción debe ser mayor o igual a 0')
    .default(0),

  activo: z.boolean().default(true)
})

// Esquema para empleados
export const empleadoSchema = z.object({
  usuario_id: z
    .string()
    .uuid('ID de usuario inválido')
    .optional(),

  sucursal_id: z
    .string()
    .uuid('ID de sucursal inválido')
    .optional(),

  categoria_id: z
    .string()
    .uuid('ID de categoría inválido')
    .optional(),

  legajo: z
    .string()
    .max(20, 'El legajo debe tener máximo 20 caracteres')
    .optional()
    .refine((val) => !val || /^[A-Z0-9-_]+$/.test(val), {
      message: 'El legajo solo puede contener letras mayúsculas, números, guiones y guiones bajos',
    }),

  nombre: z
    .string()
    .max(255, 'El nombre debe tener máximo 255 caracteres')
    .optional(),

  apellido: z
    .string()
    .max(255, 'El apellido debe tener máximo 255 caracteres')
    .optional(),

  fecha_ingreso: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Fecha de ingreso inválida',
    }),

  fecha_nacimiento: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Fecha de nacimiento inválida',
    }),

  dni: z
    .string()
    .max(20, 'El DNI debe tener máximo 20 caracteres')
    .optional()
    .refine((val) => !val || /^[0-9]+$/.test(val), {
      message: 'El DNI solo puede contener números',
    }),

  cuil: z
    .string()
    .max(20, 'El CUIL debe tener máximo 20 caracteres')
    .optional()
    .refine((val) => !val || /^[0-9-]+$/.test(val), {
      message: 'El CUIL tiene un formato inválido',
    }),

  domicilio: z
    .string()
    .max(500, 'El domicilio debe tener máximo 500 caracteres')
    .optional(),

  telefono_personal: z
    .string()
    .max(20, 'El teléfono debe tener máximo 20 caracteres')
    .optional()
    .refine((val) => !val || /^[0-9+\-\s()]+$/.test(val), {
      message: 'El teléfono tiene un formato inválido',
    }),

  contacto_emergencia: z
    .string()
    .max(255, 'El contacto de emergencia debe tener máximo 255 caracteres')
    .optional(),

  telefono_emergencia: z
    .string()
    .max(20, 'El teléfono de emergencia debe tener máximo 20 caracteres')
    .optional()
    .refine((val) => !val || /^[0-9+\-\s()]+$/.test(val), {
      message: 'El teléfono de emergencia tiene un formato inválido',
    }),

  obra_social: z
    .string()
    .max(255, 'La obra social debe tener máximo 255 caracteres')
    .optional(),

  numero_afiliado: z
    .string()
    .max(50, 'El número de afiliado debe tener máximo 50 caracteres')
    .optional(),

  banco: z
    .string()
    .max(100, 'El banco debe tener máximo 100 caracteres')
    .optional(),

  cbu: z
    .string()
    .max(50, 'El CBU debe tener máximo 50 caracteres')
    .optional()
    .refine((val) => !val || /^[0-9]+$/.test(val), {
      message: 'El CBU solo puede contener números',
    }),

  numero_cuenta: z
    .string()
    .max(50, 'El número de cuenta debe tener máximo 50 caracteres')
    .optional(),

  sueldo_actual: z
    .number()
    .min(0, 'El sueldo debe ser mayor o igual a 0')
    .optional(),

  valor_jornal_presentismo: z
    .number()
    .min(0, 'El valor jornal debe ser mayor o igual a 0')
    .optional(),

  valor_hora: z
    .number()
    .min(0, 'El valor hora debe ser mayor o igual a 0')
    .optional(),

  activo: z.boolean().default(true)
})

// Esquema para novedades RRHH
export const novedadRRHHSchema = z.object({
  titulo: z
    .string()
    .min(1, 'El título es requerido')
    .max(255, 'El título debe tener máximo 255 caracteres'),

  descripcion: z
    .string()
    .max(2000, 'La descripción debe tener máximo 2000 caracteres')
    .optional(),

  tipo: z.enum(['general', 'sucursal', 'categoria']),

  sucursal_id: z
    .string()
    .uuid('ID de sucursal inválido')
    .optional(),

  categoria_id: z
    .string()
    .uuid('ID de categoría inválido')
    .optional(),

  fecha_publicacion: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Fecha de publicación inválida',
    }),

  fecha_expiracion: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Fecha de expiración inválida',
    }),

  prioridad: z.enum(['baja', 'normal', 'alta', 'urgente']).default('normal'),

  activo: z.boolean().default(true)
})

// Esquema para asistencia
export const asistenciaSchema = z.object({
  empleado_id: z
    .string()
    .uuid('ID de empleado inválido'),

  fecha: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Fecha inválida',
    }),

  hora_entrada: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Hora de entrada inválida',
    }),

  hora_salida: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Hora de salida inválida',
    }),

  turno: z.enum(['mañana', 'tarde', 'noche']).optional(),

  estado: z.enum(['presente', 'ausente', 'tarde', 'licencia']).default('presente'),

  observaciones: z
    .string()
    .max(500, 'Las observaciones deben tener máximo 500 caracteres')
    .optional()
})

// Esquema para licencias
export const licenciaSchema = z.object({
  empleado_id: z
    .string()
    .uuid('ID de empleado invalido'),

  tipo: z.enum(['vacaciones', 'enfermedad', 'maternidad', 'estudio', 'otro']),

  fecha_inicio: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Fecha de inicio invalida',
    }),

  fecha_fin: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Fecha de fin invalida',
    }),

  fecha_sintomas: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Fecha/hora de inicio invalida',
    }),

  fecha_presentacion: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Fecha de presentacion invalida',
    }),

  diagnostico_reportado: z
    .string()
    .max(500, 'El diagnostico debe tener maximo 500 caracteres')
    .optional(),

  excepcion_plazo: z.boolean().default(false),

  motivo_excepcion: z
    .string()
    .max(500, 'El motivo de excepcion debe tener maximo 500 caracteres')
    .optional(),

  observaciones: z
    .string()
    .max(500, 'Las observaciones deben tener maximo 500 caracteres')
    .optional()
}).superRefine((data, ctx) => {
  if (new Date(data.fecha_fin) < new Date(data.fecha_inicio)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fecha_fin'],
      message: 'La fecha de fin no puede ser anterior a la fecha de inicio',
    })
  }

  if (data.excepcion_plazo && !data.motivo_excepcion?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['motivo_excepcion'],
      message: 'Debe indicar el motivo de la excepcion de plazo',
    })
  }
})

export const legajoIncidenciaSchema = z.object({
  empleado_id: z
    .string()
    .uuid('ID de empleado invalido'),

  titulo: z
    .string()
    .min(1, 'El titulo es requerido')
    .max(120, 'El titulo debe tener maximo 120 caracteres'),

  descripcion: z
    .string()
    .max(1000, 'La descripcion debe tener maximo 1000 caracteres')
    .optional(),

  fecha_evento: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Fecha de incidencia invalida',
    }),
})

// Esquema para adelantos
export const adelantoSchema = z.object({
  empleado_id: z
    .string()
    .uuid('ID de empleado inválido'),

  tipo: z.enum(['dinero', 'producto']),

  monto: z
    .number()
    .min(0, 'El monto debe ser mayor o igual a 0')
    .optional(),

  producto_id: z
    .string()
    .uuid('ID de producto inválido')
    .optional(),

  cantidad: z
    .number()
    .min(0, 'La cantidad debe ser mayor o igual a 0')
    .optional(),

  precio_unitario: z
    .number()
    .min(0, 'El precio unitario debe ser mayor o igual a 0')
    .optional(),

  fecha_solicitud: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Fecha de solicitud inválida',
    }),

  cantidad_cuotas: z
    .number()
    .int('La cantidad de cuotas debe ser un número entero')
    .min(1, 'La cantidad de cuotas mínima es 1')
    .max(24, 'La cantidad máxima de cuotas es 24')
    .default(1),

  observaciones: z
    .string()
    .max(500, 'Las observaciones deben tener máximo 500 caracteres')
    .optional()
})

// Esquema para descuentos
export const descuentoSchema = z.object({
  empleado_id: z
    .string()
    .uuid('ID de empleado inválido'),

  tipo: z.enum(['multa', 'daño_equipo', 'otro']),

  monto: z
    .number()
    .min(0, 'El monto debe ser mayor o igual a 0'),

  fecha: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Fecha inválida',
    }),

  motivo: z
    .string()
    .min(1, 'El motivo es requerido')
    .max(500, 'El motivo debe tener máximo 500 caracteres'),

  observaciones: z
    .string()
    .max(500, 'Las observaciones deben tener máximo 500 caracteres')
    .optional()
})

// Esquema para evaluaciones
export const evaluacionSchema = z.object({
  empleado_id: z
    .string()
    .uuid('ID de empleado inválido'),

  sucursal_id: z
    .string()
    .uuid('ID de sucursal inválido'),

  periodo_mes: z
    .number()
    .min(1, 'El mes debe ser entre 1 y 12')
    .max(12, 'El mes debe ser entre 1 y 12'),

  periodo_anio: z
    .number()
    .min(2020, 'El año debe ser válido')
    .max(2050, 'El año debe ser válido'),

  puntualidad: z
    .number()
    .min(1, 'La puntuación debe ser entre 1 y 5')
    .max(5, 'La puntuación debe ser entre 1 y 5')
    .optional(),

  rendimiento: z
    .number()
    .min(1, 'La puntuación debe ser entre 1 y 5')
    .max(5, 'La puntuación debe ser entre 1 y 5')
    .optional(),

  actitud: z
    .number()
    .min(1, 'La puntuación debe ser entre 1 y 5')
    .max(5, 'La puntuación debe ser entre 1 y 5')
    .optional(),

  responsabilidad: z
    .number()
    .min(1, 'La puntuación debe ser entre 1 y 5')
    .max(5, 'La puntuación debe ser entre 1 y 5')
    .optional(),

  trabajo_equipo: z
    .number()
    .min(1, 'La puntuación debe ser entre 1 y 5')
    .max(5, 'La puntuación debe ser entre 1 y 5')
    .optional(),

  fortalezas: z
    .string()
    .max(1000, 'Las fortalezas deben tener máximo 1000 caracteres')
    .optional(),

  areas_mejora: z
    .string()
    .max(1000, 'Las áreas de mejora deben tener máximo 1000 caracteres')
    .optional(),

  objetivos: z
    .string()
    .max(1000, 'Los objetivos deben tener máximo 1000 caracteres')
    .optional(),

  comentarios: z
    .string()
    .max(1000, 'Los comentarios deben tener máximo 1000 caracteres')
    .optional(),

  fecha_evaluacion: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Fecha de evaluación inválida',
    }),

  estado: z.enum(['borrador', 'enviada', 'completada']).default('borrador')
})

// Esquemas para filtros y búsqueda
export const empleadoFiltersSchema = z.object({
  sucursal_id: z.string().optional(),
  categoria_id: z.string().optional(),
  activo: z.boolean().optional(),
  search: z.string().optional()
})

export const asistenciaFiltersSchema = z.object({
  empleado_id: z.string().optional(),
  fecha_desde: z.string().optional(),
  fecha_hasta: z.string().optional(),
  turno: z.enum(['mañana', 'tarde', 'noche']).optional(),
  estado: z.enum(['presente', 'ausente', 'tarde', 'licencia']).optional()
})

export const liquidacionFiltersSchema = z.object({
  empleado_id: z.string().optional(),
  periodo_mes: z.number().optional(),
  periodo_anio: z.number().optional(),
  estado: z.enum(['borrador', 'calculada', 'aprobada', 'pagada']).optional()
})

// Tipos inferidos
export type SucursalFormData = z.infer<typeof sucursalSchema>
export type CategoriaEmpleadoFormData = z.infer<typeof categoriaEmpleadoSchema>
// Para formularios usamos z.input para que campos con default/booleanos como `activo`
// sean compatibles con React Hook Form (pueden llegar como opcionales/undefined).
export type EmpleadoFormData = z.input<typeof empleadoSchema>
export type NovedadRRHHFormData = z.input<typeof novedadRRHHSchema>
// Para formularios usamos el tipo de ENTRADA (z.input) para que campos con default,
// como `estado`, puedan ser opcionales al enviar y compatibles con React Hook Form.
export type AsistenciaFormData = z.input<typeof asistenciaSchema>
export type LicenciaFormData = z.input<typeof licenciaSchema>
export type LegajoIncidenciaFormData = z.input<typeof legajoIncidenciaSchema>
export type AdelantoFormData = z.infer<typeof adelantoSchema>
export type DescuentoFormData = z.infer<typeof descuentoSchema>
export type EvaluacionFormData = z.input<typeof evaluacionSchema>

export type EmpleadoFilters = z.infer<typeof empleadoFiltersSchema>
export type AsistenciaFilters = z.infer<typeof asistenciaFiltersSchema>
export type LiquidacionFilters = z.infer<typeof liquidacionFiltersSchema>
