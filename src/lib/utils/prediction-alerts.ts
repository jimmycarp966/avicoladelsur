/**
 * Prediction Alerts Utilities
 * 
 * Utilidades para manejar alertas de predicciones y notificaciones
 */

import { createNotification } from '@/actions'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

/**
 * Crea una notificación para una alerta de stock
 */
export async function notificarAlertaStock(
  supabase: SupabaseClient<Database>,
  alerta: {
    productoId: string
    productoNombre: string
    tipo: string
    mensaje: string
    diasRestantes: number
  }
): Promise<void> {
  try {
    await createNotification({
      titulo: `⚠️ Alerta de Stock: ${alerta.productoNombre}`,
      mensaje: alerta.mensaje,
      tipo: alerta.tipo === 'rotura_inminente' ? 'error' : 'warning',
      metadata: {
        productoId: alerta.productoId,
        tipo: alerta.tipo,
        diasRestantes: alerta.diasRestantes
      }
    })
  } catch (error) {
    console.error('Error al crear notificación de alerta:', error)
  }
}

/**
 * Crea una notificación para una optimización de ruta exitosa
 */
export async function notificarOptimizacionRuta(
  supabase: SupabaseClient<Database>,
  rutaId: string,
  ahorro: {
    distancia?: number
    tiempo?: number
    combustible?: number
  }
): Promise<void> {
  try {
    const mensaje = `Ruta optimizada exitosamente. ` +
      (ahorro.combustible ? `Ahorro estimado: $${ahorro.combustible.toFixed(0)}` : '') +
      (ahorro.distancia ? ` | ${ahorro.distancia.toFixed(1)}% menos distancia` : '') +
      (ahorro.tiempo ? ` | ${ahorro.tiempo.toFixed(1)}% menos tiempo` : '')

    await createNotification({
      titulo: '✅ Ruta Optimizada',
      mensaje,
      tipo: 'success',
      metadata: {
        rutaId,
        ahorro
      }
    })
  } catch (error) {
    console.error('Error al crear notificación de optimización:', error)
  }
}

/**
 * Crea una notificación para un documento procesado
 */
export async function notificarDocumentoProcesado(
  supabase: SupabaseClient<Database>,
  documentoId: string,
  tipo: string,
  datosExtraidos: Record<string, any>
): Promise<void> {
  try {
    const mensaje = tipo === 'factura'
      ? `Factura #${datosExtraidos.numero || 'N/A'} procesada. Total: $${datosExtraidos.total || 0}`
      : `Documento ${tipo} procesado exitosamente`

    await createNotification({
      titulo: `📄 Documento Procesado: ${tipo}`,
      mensaje,
      tipo: 'success',
      metadata: {
        documentoId,
        tipo,
        datosExtraidos
      }
    })
  } catch (error) {
    console.error('Error al crear notificación de documento:', error)
  }
}

