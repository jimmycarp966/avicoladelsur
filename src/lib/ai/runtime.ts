import { GoogleGenerativeAI } from '@google/generative-ai'
import { config } from '@/lib/config'
import { GEMINI_MODEL_DEFAULT } from '@/lib/constants/gemini-models'

type GeminiApiKeySource = 'GOOGLE_GEMINI_API_KEY' | 'GEMINI_API_KEY' | 'GOOGLE_AI_API_KEY' | null

let warnedLegacyGoogleAiKey = false

export interface GeminiRuntimeInfo {
  available: boolean
  apiKeySource: GeminiApiKeySource
  model: string
}

function resolveGeminiApiKey(): { apiKey: string | null; source: GeminiApiKeySource } {
  if (config.googleCloud.gemini.apiKey) {
    return { apiKey: config.googleCloud.gemini.apiKey, source: 'GOOGLE_GEMINI_API_KEY' }
  }

  if (process.env.GEMINI_API_KEY) {
    return { apiKey: process.env.GEMINI_API_KEY, source: 'GEMINI_API_KEY' }
  }

  if (process.env.GOOGLE_AI_API_KEY) {
    if (!warnedLegacyGoogleAiKey) {
      console.warn(
        '[AI Runtime] Usando GOOGLE_AI_API_KEY (legacy). Se recomienda GOOGLE_GEMINI_API_KEY.'
      )
      warnedLegacyGoogleAiKey = true
    }
    return { apiKey: process.env.GOOGLE_AI_API_KEY, source: 'GOOGLE_AI_API_KEY' }
  }

  return { apiKey: null, source: null }
}

export function getGeminiModelName(model?: string): string {
  return model || config.googleCloud.gemini.model || GEMINI_MODEL_DEFAULT
}

export function getGeminiRuntimeInfo(model?: string): GeminiRuntimeInfo {
  const { apiKey, source } = resolveGeminiApiKey()
  return {
    available: Boolean(apiKey),
    apiKeySource: source,
    model: getGeminiModelName(model),
  }
}

export function getGeminiClient(): GoogleGenerativeAI | null {
  const { apiKey } = resolveGeminiApiKey()
  if (!apiKey) return null
  return new GoogleGenerativeAI(apiKey)
}

export function getGeminiModel(
  model?: string,
  generationConfig?: {
    temperature?: number
    maxOutputTokens?: number
    topP?: number
    topK?: number
  }
) {
  const client = getGeminiClient()
  if (!client) return null
  return client.getGenerativeModel({
    model: getGeminiModelName(model),
    generationConfig,
  })
}
