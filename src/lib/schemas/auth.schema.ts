import { z } from 'zod'

// Esquema para login
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'El email es requerido')
    .email('Email inválido'),
  password: z
    .string()
    .min(1, 'La contraseña es requerida')
    .min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

// Esquema para registro de usuario (solo admin)
export const registerUserSchema = z.object({
  email: z
    .string()
    .min(1, 'El email es requerido')
    .email('Email inválido'),
  password: z
    .string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres'),
  nombre: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(255, 'El nombre es demasiado largo'),
  apellido: z
    .string()
    .max(255, 'El apellido es demasiado largo')
    .optional(),
  telefono: z
    .string()
    .max(20, 'El teléfono es demasiado largo')
    .optional(),
  rol: z.enum(['admin', 'vendedor', 'repartidor', 'almacenista'])
    .describe('El rol es requerido'),
  vehiculo_asignado: z.string().uuid().optional(),
})

// Esquema para cambiar contraseña
export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, 'La contraseña actual es requerida'),
  newPassword: z
    .string()
    .min(6, 'La nueva contraseña debe tener al menos 6 caracteres'),
  confirmPassword: z
    .string()
    .min(1, 'La confirmación de contraseña es requerida'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
})

// Esquema para resetear contraseña
export const resetPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'El email es requerido')
    .email('Email inválido'),
})

// Tipos inferidos
export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterUserFormData = z.infer<typeof registerUserSchema>
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>
