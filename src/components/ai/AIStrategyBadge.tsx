import { Badge } from '@/components/ui/badge'
import type { AIMetadata } from '@/types/ai.types'

function getStrategyLabel(ai?: AIMetadata): string {
  if (!ai) return 'Sin datos IA'
  if (ai.strategy === 'primary') return 'IA primaria'
  if (ai.strategy === 'assisted') return 'IA asistida'
  return 'Sin IA'
}

function getStrategyClassName(ai?: AIMetadata): string {
  if (!ai) return 'bg-slate-100 text-slate-700 border-slate-300'

  if (ai.strategy === 'primary') {
    return ai.used
      ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
      : 'bg-amber-100 text-amber-700 border-amber-300'
  }

  if (ai.strategy === 'assisted') {
    return ai.used
      ? 'bg-blue-100 text-blue-700 border-blue-300'
      : 'bg-slate-100 text-slate-700 border-slate-300'
  }

  return 'bg-slate-100 text-slate-700 border-slate-300'
}

export function AIStrategyBadge({ ai }: { ai?: AIMetadata | null }) {
  const label = getStrategyLabel(ai ?? undefined)
  const suffix = ai?.fallbackUsed ? ' - fallback' : ''

  return (
    <Badge variant="outline" className={getStrategyClassName(ai ?? undefined)}>
      {label}
      {suffix}
    </Badge>
  )
}
