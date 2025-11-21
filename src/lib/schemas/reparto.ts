/**
 * Schemas Zod para validación de datos de reparto y tracking
 */

import { z } from 'zod'

// Schema para registrar ubicación GPS
export const ubicacionRepartidorSchema = z.object({
  repartidorId: z.string().uuid('ID de repartidor inválido'),
  vehiculoId: z.string().uuid('ID de vehículo inválido'),
  lat: z.number()
    .min(-90, 'Latitud debe estar entre -90 y 90')
    .max(90, 'Latitud debe estar entre -90 y 90'),
  lng: z.number()
    .min(-180, 'Longitud debe estar entre -180 y 180')
    .max(180, 'Longitud debe estar entre -180 y 180')
})

export type UbicacionRepartidorInput = z.infer<typeof ubicacionRepartidorSchema>

// Schema para generar ruta optimizada
export const generarRutaSchema = z.object({
  rutaId: z.string().uuid('ID de ruta inválido'),
  usarGoogle: z.boolean().default(false),
  origin: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180)
  }).optional(),
  destination: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180)
  }).optional()
})

export type GenerarRutaInput = z.infer<typeof generarRutaSchema>

// Schema para crear alerta
export const crearAlertaSchema = z.object({
  rutaId: z.string().uuid('ID de ruta inválido').optional(),
  rutaRepartoId: z.string().uuid('ID de ruta reparto inválido').optional(),
  vehiculoId: z.string().uuid('ID de vehículo inválido'),
  repartidorId: z.string().uuid('ID de repartidor inválido'),
  tipo: z.enum(['desvio', 'cliente_saltado', 'retraso', 'otro']),
  descripcion: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  distanciaDesvioM: z.number().min(0).optional(),
  clienteId: z.string().uuid().optional(),
  pedidoId: z.string().uuid().optional()
})

export type CrearAlertaInput = z.infer<typeof crearAlertaSchema>

// Schema para punto de ruta
export const puntoRutaSchema = z.object({
  clienteId: z.string().uuid().optional(),
  pedidoId: z.string().uuid().optional(),
  detalleRutaId: z.string().uuid().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  orden: z.number().int().min(1),
  nombreCliente: z.string().optional()
})

export type PuntoRuta = z.infer<typeof puntoRutaSchema>

