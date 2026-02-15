/**
 * POST /api/documents/process
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { processAndSaveDocument } from '@/lib/services/documents/processor'
import { createAIMetadata } from '@/lib/ai/metadata'
import { logAIUsage } from '@/lib/ai/logger'
import type { AIMetadata } from '@/types/ai.types'

interface DocumentsProcessResponse {
  success: boolean
  data?: {
    id: string
    tipo: string
    estado: 'procesando' | 'completado' | 'error'
    datosExtraidos: Record<string, any>
  }
  error?: string
  ai: AIMetadata
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()

  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      const ai = createAIMetadata({
        strategy: 'primary',
        used: false,
        provider: 'none',
        model: null,
        fallbackUsed: false,
        reason: 'No autenticado.',
        startedAt,
      })

      return NextResponse.json<DocumentsProcessResponse>({ success: false, error: 'No autenticado', ai }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const tipo = formData.get('tipo') as string
    const archivoUrl = formData.get('archivoUrl') as string

    if (!file || !tipo || !archivoUrl) {
      const ai = createAIMetadata({
        strategy: 'primary',
        used: false,
        provider: 'none',
        model: null,
        fallbackUsed: false,
        reason: 'Parametros requeridos faltantes.',
        startedAt,
      })

      return NextResponse.json<DocumentsProcessResponse>(
        { success: false, error: 'file, tipo y archivoUrl son requeridos', ai },
        { status: 400 }
      )
    }

    if (!['factura', 'remito', 'recibo'].includes(tipo)) {
      const ai = createAIMetadata({
        strategy: 'primary',
        used: false,
        provider: 'none',
        model: null,
        fallbackUsed: false,
        reason: 'Tipo de documento invalido.',
        startedAt,
      })

      return NextResponse.json<DocumentsProcessResponse>(
        {
          success: false,
          error: 'Tipo de documento invalido. Debe ser: factura, remito o recibo',
          ai,
        },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64Content = buffer.toString('base64')
    const mimeType = file.type || 'application/pdf'

    const result = await processAndSaveDocument(
      supabase,
      base64Content,
      mimeType,
      tipo as 'factura' | 'remito' | 'recibo',
      archivoUrl
    )

    const success = result.estado !== 'error'

    const ai = createAIMetadata({
      strategy: 'primary',
      used: success,
      provider: success ? 'document_ai' : 'none',
      model: success ? 'document-ai-processor' : null,
      fallbackUsed: false,
      reason: success
        ? 'Documento procesado con Document AI.'
        : result.error || 'No se pudo procesar con Document AI.',
      startedAt,
    })

    logAIUsage({
      endpoint: '/api/documents/process',
      feature: 'documents_process',
      success,
      ai,
      error: success ? undefined : result.error,
    })

    if (!success) {
      return NextResponse.json<DocumentsProcessResponse>(
        { success: false, error: result.error || 'Error al procesar documento', ai },
        { status: 500 }
      )
    }

    return NextResponse.json<DocumentsProcessResponse>({
      success: true,
      data: {
        id: result.id,
        tipo: result.tipo,
        estado: result.estado,
        datosExtraidos: result.datosExtraidos,
      },
      ai,
    })
  } catch (error: any) {
    console.error('Error al procesar documento:', error)

    const ai = createAIMetadata({
      strategy: 'primary',
      used: false,
      provider: 'none',
      model: null,
      fallbackUsed: false,
      reason: 'Error no controlado al procesar documento.',
      startedAt,
    })

    logAIUsage({
      endpoint: '/api/documents/process',
      feature: 'documents_process',
      success: false,
      ai,
      error: error.message || 'unknown',
    })

    return NextResponse.json<DocumentsProcessResponse>(
      { success: false, error: error.message || 'Error al procesar documento', ai },
      { status: 500 }
    )
  }
}
