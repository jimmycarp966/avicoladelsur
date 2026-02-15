export type AIStrategy = 'none' | 'assisted' | 'primary'

export type AIProvider = 'none' | 'gemini' | 'vertex' | 'document_ai'

export interface AIMetadata {
  strategy: AIStrategy
  used: boolean
  provider: AIProvider
  model: string | null
  fallbackUsed: boolean
  reason: string
  latencyMs: number | null
  deprecated?: boolean
  deprecatedMessage?: string
}

