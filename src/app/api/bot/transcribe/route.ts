/**
 * POST /api/bot/transcribe
 * 
 * Endpoint para transcribir audio de WhatsApp usando Speech-to-Text
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { transcribeAudioFromBase64 } from '@/lib/services/google-cloud/speech-to-text'

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

    const body = await request.json()
    const { audioBase64, clienteId, conversacionId, languageCode, sampleRateHertz } = body as {
      audioBase64: string
      clienteId: string
      conversacionId?: string
      languageCode?: string
      sampleRateHertz?: number
    }

    if (!audioBase64) {
      return NextResponse.json(
        { success: false, error: 'audioBase64 es requerido' },
        { status: 400 }
      )
    }

    if (!clienteId) {
      return NextResponse.json(
        { success: false, error: 'clienteId es requerido' },
        { status: 400 }
      )
    }

    // Transcribir audio
    const transcriptionResult = await transcribeAudioFromBase64(audioBase64, {
      languageCode,
      sampleRateHertz
    })

    if (!transcriptionResult.success) {
      return NextResponse.json(
        { success: false, error: transcriptionResult.error || 'Error al transcribir audio' },
        { status: 500 }
      )
    }

    // Registrar transcripción en base de datos
    const { error: transError } = await supabase.rpc('fn_registrar_transcripcion_audio', {
      p_conversacion_id: conversacionId || null,
      p_cliente_id: clienteId,
      p_audio_url: null, // Se puede subir a Storage después
      p_transcripcion: transcriptionResult.transcript || '',
      p_confianza: transcriptionResult.confidence || null,
      p_idioma_detectado: 'es-AR',
      p_palabras: transcriptionResult.words ? JSON.stringify(transcriptionResult.words) : null,
      p_alternativas: transcriptionResult.alternatives ? JSON.stringify(transcriptionResult.alternatives) : null
    })

    if (transError) {
      console.error('Error al registrar transcripción:', transError)
      // No fallar la request, solo loguear
    }

    return NextResponse.json({
      success: true,
      data: {
        transcript: transcriptionResult.transcript,
        confidence: transcriptionResult.confidence,
        alternatives: transcriptionResult.alternatives,
        words: transcriptionResult.words
      }
    })
  } catch (error: any) {
    console.error('Error al transcribir audio:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Error al transcribir audio' },
      { status: 500 }
    )
  }
}

