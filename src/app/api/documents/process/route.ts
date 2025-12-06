/**
 * POST /api/documents/process
 * 
 * Endpoint para procesar documentos usando Document AI
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { processAndSaveDocument } from '@/lib/services/documents/processor'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const tipo = formData.get('tipo') as string
    const archivoUrl = formData.get('archivoUrl') as string

    if (!file || !tipo || !archivoUrl) {
      return NextResponse.json(
        { success: false, error: 'file, tipo y archivoUrl son requeridos' },
        { status: 400 }
      )
    }

    if (!['factura', 'remito', 'recibo'].includes(tipo)) {
      return NextResponse.json(
        { success: false, error: 'Tipo de documento inválido. Debe ser: factura, remito o recibo' },
        { status: 400 }
      )
    }

    // Convertir archivo a base64
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64Content = buffer.toString('base64')
    const mimeType = file.type || 'application/pdf'

    // Procesar documento
    const result = await processAndSaveDocument(
      supabase,
      base64Content,
      mimeType,
      tipo as 'factura' | 'remito' | 'recibo',
      archivoUrl
    )

    if (result.estado === 'error') {
      return NextResponse.json(
        { success: false, error: result.error || 'Error al procesar documento' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        id: result.id,
        tipo: result.tipo,
        estado: result.estado,
        datosExtraidos: result.datosExtraidos
      }
    })
  } catch (error: any) {
    console.error('Error al procesar documento:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al procesar documento' },
      { status: 500 }
    )
  }
}

