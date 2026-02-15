import type { AIMetadata, AIProvider, AIStrategy } from '@/types/ai.types'

interface CreateAIMetadataInput {
  strategy: AIStrategy
  used: boolean
  provider?: AIProvider
  model?: string | null
  fallbackUsed?: boolean
  reason: string
  latencyMs?: number | null
  startedAt?: number
  deprecated?: boolean
  deprecatedMessage?: string
}

export function createAIMetadata(input: CreateAIMetadataInput): AIMetadata {
  const latencyMs =
    typeof input.latencyMs === 'number'
      ? input.latencyMs
      : typeof input.startedAt === 'number'
      ? Date.now() - input.startedAt
      : null

  return {
    strategy: input.strategy,
    used: input.used,
    provider: input.provider ?? (input.used ? 'gemini' : 'none'),
    model: input.model ?? null,
    fallbackUsed: input.fallbackUsed ?? false,
    reason: input.reason,
    latencyMs,
    deprecated: input.deprecated,
    deprecatedMessage: input.deprecatedMessage,
  }
}

