/**
 * Document Processor
 * 
 * Procesador de documentos que integra Document AI con el sistema
 * y maneja la lógica de negocio para diferentes tipos de documentos.
 */

import { processFactura, processRemito, type DocumentAIResponse } from '@/lib/services/google-cloud/document-ai'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

export interface ProcessedDocument {
  id: string
  tipo: 'factura' | 'remito' | 'recibo'
  estado: 'procesando' | 'completado' | 'error'
  datosExtraidos: Record<string, any>
  archivoUrl: string
  error?: string
}

/**
 * Procesa un documento y guarda los resultados
 */
export async function processAndSaveDocument(
  supabase: SupabaseClient<Database>,
  fileContent: string,
  mimeType: string,
  tipo: 'factura' | 'remito' | 'recibo',
  archivoUrl: string
): Promise<ProcessedDocument> {
  try {
    // Procesar según el tipo
    let result: DocumentAIResponse
    if (tipo === 'factura') {
      result = await processFactura(fileContent, mimeType)
    } else if (tipo === 'remito') {
      result = await processRemito(fileContent, mimeType)
    } else {
      return {
        id: '',
        tipo,
        estado: 'error',
        datosExtraidos: {},
        archivoUrl,
        error: 'Tipo de documento no soportado'
      }
    }

    if (!result.success || !result.extractedData) {
      // Guardar documento con error
      const { data: docError } = await supabase
        .from('documentos_procesados')
        .insert({
          tipo,
          archivo_url: archivoUrl,
          datos_extraidos: {},
          estado: 'error'
        })
        .select()
        .single()

      return {
        id: (docError as any)?.id || '',
        tipo,
        estado: 'error',
        datosExtraidos: {},
        archivoUrl,
        error: result.error || 'Error al procesar documento'
      }
    }

    // Guardar documento procesado exitosamente
    const { data: documento, error: docError } = await supabase
      .from('documentos_procesados')
      .insert({
        tipo,
        archivo_url: archivoUrl,
        datos_extraidos: result.extractedData,
        estado: 'completado'
      })
      .select()
      .single()

    if (docError || !documento) {
      throw new Error('Error al guardar documento procesado')
    }

    return {
      id: (documento as any).id,
      tipo,
      estado: 'completado',
      datosExtraidos: result.extractedData,
      archivoUrl
    }
  } catch (error: any) {
    console.error('Error al procesar y guardar documento:', error)
    
    // Intentar guardar con estado de error
    try {
      const { data: docError } = await supabase
        .from('documentos_procesados')
        .insert({
          tipo,
          archivo_url: archivoUrl,
          datos_extraidos: {},
          estado: 'error'
        })
        .select()
        .single()

      return {
        id: (docError as any)?.id || '',
        tipo,
        estado: 'error',
        datosExtraidos: {},
        archivoUrl,
        error: error.message || 'Error desconocido'
      }
    } catch {
      return {
        id: '',
        tipo,
        estado: 'error',
        datosExtraidos: {},
        archivoUrl,
        error: error.message || 'Error desconocido'
      }
    }
  }
}

/**
 * Valida y normaliza datos extraídos de una factura
 */
export function validateFacturaData(data: Record<string, any>): {
  isValid: boolean
  normalized: {
    numero?: string
    fecha?: string
    proveedor?: string
    total?: number
    productos?: Array<{
      nombre: string
      cantidad: number
      precio: number
      subtotal: number
    }>
  }
  errors: string[]
} {
  const errors: string[] = []
  const normalized: any = {}

  // Validar número
  if (data.numero) {
    normalized.numero = String(data.numero).trim()
  } else {
    errors.push('Número de factura no encontrado')
  }

  // Validar fecha
  if (data.fecha) {
    const fecha = new Date(data.fecha)
    if (!isNaN(fecha.getTime())) {
      normalized.fecha = fecha.toISOString().split('T')[0]
    } else {
      errors.push('Fecha inválida')
    }
  } else {
    errors.push('Fecha no encontrada')
  }

  // Validar proveedor
  if (data.proveedor) {
    normalized.proveedor = String(data.proveedor).trim()
  } else {
    errors.push('Proveedor no encontrado')
  }

  // Validar total
  if (data.total) {
    const total = parseFloat(String(data.total))
    if (!isNaN(total) && total > 0) {
      normalized.total = total
    } else {
      errors.push('Total inválido')
    }
  } else {
    errors.push('Total no encontrado')
  }

  // Validar productos
  if (data.productos && Array.isArray(data.productos) && data.productos.length > 0) {
    normalized.productos = data.productos.map((p: any) => ({
      nombre: String(p.nombre || '').trim(),
      cantidad: parseFloat(String(p.cantidad || 1)) || 1,
      precio: parseFloat(String(p.precio || 0)) || 0,
      subtotal: parseFloat(String(p.subtotal || 0)) || 0
    }))
  }

  return {
    isValid: errors.length === 0,
    normalized,
    errors
  }
}

