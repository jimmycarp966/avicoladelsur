/**
 * POST /api/documents/upload
 * 
 * Endpoint para subir documentos a Supabase Storage
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Archivo es requerido' },
        { status: 400 }
      )
    }

    if (!tipo || !['factura', 'remito', 'recibo'].includes(tipo)) {
      return NextResponse.json(
        { success: false, error: 'Tipo de documento inválido' },
        { status: 400 }
      )
    }

    // Generar nombre único para el archivo
    const timestamp = Date.now()
    const fileName = `${tipo}-${timestamp}-${file.name}`
    const filePath = `documentos/${tipo}/${fileName}`

    // Convertir archivo a ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Subir a Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(filePath, buffer, {
        contentType: file.type || 'application/pdf',
        upsert: false
      })

    if (uploadError) {
      console.error('Error al subir archivo:', uploadError)
      return NextResponse.json(
        { success: false, error: uploadError.message || 'Error al subir archivo' },
        { status: 500 }
      )
    }

    // Obtener URL pública
    const { data: urlData } = supabase.storage
      .from('documentos')
      .getPublicUrl(filePath)

    return NextResponse.json({
      success: true,
      data: {
        url: urlData.publicUrl,
        path: filePath,
        fileName: fileName
      }
    })
  } catch (error: any) {
    console.error('Error al subir documento:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al subir documento' },
      { status: 500 }
    )
  }
}

