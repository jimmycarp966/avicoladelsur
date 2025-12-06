/**
 * Speech-to-Text API Integration
 * 
 * Integración con Google Cloud Speech-to-Text para transcribir audio
 * de mensajes de voz de WhatsApp.
 */

import { getAccessToken, isGoogleCloudConfigured } from './auth'
import { config } from '@/lib/config'

export interface SpeechToTextRequest {
  audio: {
    content?: string // Base64 encoded audio
    uri?: string // GCS URI
  }
  languageCode?: string
  sampleRateHertz?: number
  encoding?: 'LINEAR16' | 'FLAC' | 'MULAW' | 'AMR' | 'AMR_WB' | 'OGG_OPUS' | 'SPEEX_WITH_HEADER_BYTE' | 'WEBM_OPUS'
  alternativeLanguageCodes?: string[]
  enableAutomaticPunctuation?: boolean
  enableWordTimeOffsets?: boolean
}

export interface SpeechToTextResponse {
  success: boolean
  transcript?: string
  confidence?: number
  alternatives?: Array<{
    transcript: string
    confidence: number
  }>
  words?: Array<{
    word: string
    startTime: string
    endTime: string
  }>
  error?: string
}

const SPEECH_TO_TEXT_API_URL = 'https://speech.googleapis.com/v1'

/**
 * Verifica si Speech-to-Text está disponible
 */
export function isSpeechToTextAvailable(): boolean {
  return (
    isGoogleCloudConfigured() &&
    config.googleCloud.speechToText.enabled &&
    !!config.googleCloud.projectId
  )
}

/**
 * Transcribe audio a texto usando Speech-to-Text API
 */
export async function transcribeAudio(
  request: SpeechToTextRequest
): Promise<SpeechToTextResponse> {
  if (!isSpeechToTextAvailable()) {
    return {
      success: false,
      error: 'Speech-to-Text no está configurado o habilitado. Verifica GOOGLE_SPEECH_TO_TEXT_ENABLED'
    }
  }

  try {
    const accessToken = await getAccessToken()
    const projectId = config.googleCloud.projectId
    const languageCode = request.languageCode || config.googleCloud.speechToText.languageCode

    // Construir request body según Speech-to-Text API
    const requestBody: any = {
      config: {
        encoding: request.encoding || 'WEBM_OPUS', // WhatsApp usa WebM Opus
        sampleRateHertz: request.sampleRateHertz || 16000,
        languageCode: languageCode,
        alternativeLanguageCodes: request.alternativeLanguageCodes || ['es-ES', 'es-MX'],
        enableAutomaticPunctuation: request.enableAutomaticPunctuation ?? true,
        enableWordTimeOffsets: request.enableWordTimeOffsets ?? false,
        model: 'latest_long', // Mejor para conversaciones largas
      },
      audio: request.audio
    }

    const response = await fetch(
      `${SPEECH_TO_TEXT_API_URL}/projects/${projectId}/locations/global:recognize`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: `Speech-to-Text API error: ${response.status} - ${errorData.error?.message || response.statusText}`
      }
    }

    const data = await response.json()

    // Parsear respuesta
    if (!data.results || data.results.length === 0) {
      return {
        success: false,
        error: 'No se pudo transcribir el audio'
      }
    }

    const result = data.results[0]
    const alternative = result.alternatives?.[0]

    if (!alternative) {
      return {
        success: false,
        error: 'No se encontró transcripción en la respuesta'
      }
    }

    const alternatives = result.alternatives?.map((alt: any) => ({
      transcript: alt.transcript || '',
      confidence: alt.confidence || 0
    })) || []

    return {
      success: true,
      transcript: alternative.transcript || '',
      confidence: alternative.confidence || 0,
      alternatives,
      words: alternative.words?.map((word: any) => ({
        word: word.word || '',
        startTime: word.startTime || '0s',
        endTime: word.endTime || '0s'
      })) || []
    }
  } catch (error: any) {
    console.error('Error al consultar Speech-to-Text API:', error)
    return {
      success: false,
      error: error.message || 'Error desconocido al consultar Speech-to-Text API'
    }
  }
}

/**
 * Transcribe audio desde base64 (útil para WhatsApp)
 */
export async function transcribeAudioFromBase64(
  base64Audio: string,
  options?: {
    languageCode?: string
    sampleRateHertz?: number
  }
): Promise<SpeechToTextResponse> {
  return transcribeAudio({
    audio: {
      content: base64Audio
    },
    languageCode: options?.languageCode,
    sampleRateHertz: options?.sampleRateHertz,
    encoding: 'WEBM_OPUS'
  })
}

