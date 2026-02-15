import type { AIMetadata } from '@/types/ai.types'

interface AIUsageEvent {
  endpoint: string
  feature: string
  success: boolean
  ai: AIMetadata
  error?: string
}

export function logAIUsage(event: AIUsageEvent): void {
  console.info(
    '[AI_USAGE]',
    JSON.stringify({
      endpoint: event.endpoint,
      feature: event.feature,
      success: event.success,
      ai: event.ai,
      error: event.error,
      ts: new Date().toISOString(),
    })
  )
}

