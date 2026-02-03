import { BaseEntity } from './domain.types'
import { z } from 'zod'

// ===========================================
// ENUMS & TYPES
// ===========================================

export type EstadoConciliacion = 'pendiente' | 'conciliado' | 'revisado' | 'descartado'
export type TipoMatch = 'exacto' | 'automatico' | 'manual' | 'ia'
export type OrigenComprobante = 'manual' | 'sucursal' | 'whatsapp'
export type EstadoValidacion = 'pendiente' | 'validado' | 'no_encontrado' | 'sin_cliente' | 'error'
export type EstadoSesion = 'en_proceso' | 'completada' | 'con_errores'

// ===========================================
// DOMAIN INTERFACES - Nuevo Flujo
// ===========================================

/**
 * Sesión de conciliación: representa una ejecución completa del proceso
 * (1 PDF sábana + N imágenes de comprobantes)
 */
export interface SesionConciliacion extends BaseEntity {
  fecha: string
  sabana_archivo: string
  total_movimientos_sabana: number
  total_comprobantes: number
  validados: number
  no_encontrados: number
  monto_total_acreditado: number
  usuario_id: string
  reporte_url?: string
  estado: EstadoSesion
  notas?: string
  // Relaciones
  usuario?: {
    id: string
    nombre?: string
    email?: string
  }
  comprobantes?: ComprobanteConciliacion[]
}

/**
 * Comprobante de pago procesado (imagen de transferencia)
 */
export interface ComprobanteConciliacion extends BaseEntity {
  sesion_id: string
  fecha?: string
  monto: number
  dni_cuit?: string
  referencia?: string
  descripcion?: string
  // Estado de validación
  estado_validacion: EstadoValidacion
  // Relaciones encontradas
  cliente_id?: string
  movimiento_match_id?: string
  confianza_score?: number
  etiquetas?: string[]
  // Para futuras integraciones
  sucursal_origen_id?: string
  origen: OrigenComprobante
  // Metadatos
  notas?: string
  acreditado: boolean
  // Relaciones expandidas
  cliente?: {
    id: string
    nombre: string
    cuit?: string
  }
  movimiento_match?: MovimientoBancario
}

/**
 * Datos extraídos de un comprobante (imagen) por Gemini
 */
export interface DatosComprobante {
  fecha?: string
  monto: number
  dni_cuit?: string
  referencia?: string
  descripcion?: string
  // Metadatos de extracción
  confianza_extraccion?: number
  campos_detectados?: string[]
  archivo_origen?: string
  // Datos enriquecidos post-lookup para matching inteligente
  nombre_cliente_identificado?: string
}

/**
 * Resultado de validación de un comprobante contra la sábana
 */
export interface ResultadoValidacion {
  comprobante: DatosComprobante
  estado: EstadoValidacion
  movimiento_match?: MovimientoBancario
  cliente?: {
    id: string
    nombre: string
    cuit?: string
  }
  confianza_score: number
  etiquetas: string[]
  detalles: Record<string, number>
  acreditado: boolean
  error?: string
}

/**
 * Resumen de una sesión de conciliación
 */
export interface ResumenConciliacion {
  sesion_id: string
  total_comprobantes: number
  validados: number
  no_encontrados: number
  sin_cliente: number
  errores: number
  monto_total_acreditado: number
  detalles: ResultadoValidacion[]
  reporte_url?: string
}

// ===========================================
// LEGACY INTERFACES (para compatibilidad)
// ===========================================

export interface CuentaBancaria extends BaseEntity {
  banco: string
  numero_cuenta: string
  cbu?: string
  descripcion?: string
  moneda: string
  activo: boolean
}

export interface MovimientoBancario extends BaseEntity {
  cuenta_bancaria_id?: string
  fecha: string // YYYY-MM-DD
  monto: number
  referencia?: string
  dni_cuit?: string
  descripcion?: string
  archivo_origen?: string
  estado_conciliacion: EstadoConciliacion
  metadata?: Record<string, unknown>
  // Relaciones
  cuenta_bancaria?: CuentaBancaria
}

// ===========================================
// ZOD SCHEMAS
// ===========================================

export const MovimientoBancarioSchema = z.object({
  fecha: z.coerce.date(),
  monto: z.number().positive(),
  referencia: z.string().optional(),
  dni_cuit: z.string().regex(/^\d{8,11}$/, "DNI/CUIT inválido").optional().or(z.literal('')),
  descripcion: z.string().optional(),
})

export type MovimientoBancarioInput = z.infer<typeof MovimientoBancarioSchema>

export const ComprobanteSchema = z.object({
  fecha: z.string().optional(),
  monto: z.number().positive(),
  dni_cuit: z.string().optional(),
  referencia: z.string().optional(),
  descripcion: z.string().optional(),
})

export type ComprobanteInput = z.infer<typeof ComprobanteSchema>

// Schema para validación manual
export const ValidacionManualSchema = z.object({
  comprobanteId: z.string().uuid(),
  clienteId: z.string().uuid().optional(),
  movimientoId: z.string().uuid().optional(),
  notas: z.string().optional(),
  acreditar: z.boolean().default(true),
})

export type ValidacionManualInput = z.infer<typeof ValidacionManualSchema>

// ===========================================
// ALERTAS DE VALIDACIÓN
// ===========================================

export interface AlertaValidacion {
    tipo: 'error' | 'warning' | 'info'
    codigo: string
    mensaje: string
    detalles?: Record<string, number | string>
}
