import { BaseEntity } from './domain.types'
import { z } from 'zod'

// ===========================================
// ENUMS & TYPES
// ===========================================

export type EstadoConciliacion = 'pendiente' | 'conciliado' | 'revisado' | 'descartado'
export type TipoMatch = 'exacto' | 'automatico' | 'manual' | 'ia'
export type OrigenPago = 'pedido' | 'factura' | 'manual'

// ===========================================
// DOMAIN INTERFACES
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
  cuenta_bancaria_id: string
  fecha: string // YYYY-MM-DD
  monto: number
  referencia?: string
  dni_cuit?: string
  descripcion?: string
  archivo_origen?: string
  estado_conciliacion: EstadoConciliacion
  metadata?: Record<string, any>
  // Relaciones
  cuenta_bancaria?: CuentaBancaria
  conciliaciones?: Conciliacion[]
}

export interface PagoEsperado extends BaseEntity {
  pedido_id?: string
  cliente_id?: string
  monto_esperado: number
  fecha_esperada?: string
  referencia?: string
  dni_cuit?: string
  estado: 'pendiente' | 'conciliado' | 'cancelado'
  origen: OrigenPago
  // Relaciones
  cliente?: {
    id: string
    nombre: string
    cuit?: string
  }
  pedido?: {
    id: string
    numero_pedido: string
    total: number
  }
}

export interface Conciliacion extends BaseEntity {
  movimiento_bancario_id: string
  pago_esperado_id: string
  monto_conciliado: number
  diferencia: number
  tipo_match: TipoMatch
  confianza_score: number // 0-100
  conciliado_por?: string
  notas?: string
  // Relaciones
  movimiento_bancario?: MovimientoBancario
  pago_esperado?: PagoEsperado
  usuario?: {
    id: string
    nombre?: string
    email?: string
  }
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

export const ConciliacionManualSchema = z.object({
  movimientoBancarioId: z.string().uuid(),
  pagoEsperadoId: z.string().uuid(),
  notas: z.string().optional(),
})

export type ConciliacionManualInput = z.infer<typeof ConciliacionManualSchema>
