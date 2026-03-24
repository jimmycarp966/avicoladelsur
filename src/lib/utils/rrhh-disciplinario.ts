export const DISCIPLINA_ETAPAS = ['verbal', 'advertencia_escrita', 'suspension'] as const

export type DisciplinaEtapa = (typeof DISCIPLINA_ETAPAS)[number]

export type DocumentoDisciplinaEstado = 'pendiente_firma' | 'firmado'

export type LegajoDisciplinaMetadata = {
  flujo: 'disciplinario'
  motivo: string
  etapa: DisciplinaEtapa
  documento?: {
    bucket?: string
    path?: string
    estado?: DocumentoDisciplinaEstado
    generado_at?: string
  }
  suspension?: {
    dias?: number | null
  }
  origen?: string
}

const ETAPA_LABELS: Record<DisciplinaEtapa, string> = {
  verbal: 'Primera incidencia verbal',
  advertencia_escrita: 'Advertencia escrita',
  suspension: 'Suspension',
}

const ETAPA_SHORT_LABELS: Record<DisciplinaEtapa, string> = {
  verbal: 'Verbal',
  advertencia_escrita: 'Advertencia escrita',
  suspension: 'Suspension',
}

export function getDisciplinaEtapaLabel(etapa?: string | null): string {
  if (!etapa || !DISCIPLINA_ETAPAS.includes(etapa as DisciplinaEtapa)) return 'Incidencia'
  return ETAPA_LABELS[etapa as DisciplinaEtapa]
}

export function getDisciplinaEtapaShortLabel(etapa?: string | null): string {
  if (!etapa || !DISCIPLINA_ETAPAS.includes(etapa as DisciplinaEtapa)) return 'Incidencia'
  return ETAPA_SHORT_LABELS[etapa as DisciplinaEtapa]
}

export function buildDisciplinaTitulo(etapa: DisciplinaEtapa, motivo: string): string {
  const suffix = motivo.trim() ? ` - ${motivo.trim()}` : ''
  return `${getDisciplinaEtapaLabel(etapa)}${suffix}`
}

export function buildDisciplinaDescripcion(metadata: LegajoDisciplinaMetadata, fallback?: string | null): string {
  const partes = [metadata.motivo]

  if (metadata.etapa === 'suspension' && metadata.suspension?.dias) {
    partes.push(`${metadata.suspension.dias} dia(s) de suspension`)
  }

  if (fallback) {
    partes.push(fallback)
  }

  return partes.filter(Boolean).join(' | ')
}

export function parseLegajoDisciplinaMetadata(value: unknown): LegajoDisciplinaMetadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const raw = value as Record<string, unknown>
  if (raw.flujo !== 'disciplinario') return null

  const etapa = typeof raw.etapa === 'string' ? raw.etapa : null
  const motivo = typeof raw.motivo === 'string' ? raw.motivo : ''

  if (!etapa || !DISCIPLINA_ETAPAS.includes(etapa as DisciplinaEtapa) || !motivo) {
    return null
  }

  const documentoRaw =
    raw.documento && typeof raw.documento === 'object' && !Array.isArray(raw.documento)
      ? (raw.documento as Record<string, unknown>)
      : null

  const suspensionRaw =
    raw.suspension && typeof raw.suspension === 'object' && !Array.isArray(raw.suspension)
      ? (raw.suspension as Record<string, unknown>)
      : null

  return {
    flujo: 'disciplinario',
    motivo,
    etapa: etapa as DisciplinaEtapa,
    origen: typeof raw.origen === 'string' ? raw.origen : undefined,
    documento: documentoRaw
      ? {
          bucket: typeof documentoRaw.bucket === 'string' ? documentoRaw.bucket : undefined,
          path: typeof documentoRaw.path === 'string' ? documentoRaw.path : undefined,
          estado:
            documentoRaw.estado === 'firmado' || documentoRaw.estado === 'pendiente_firma'
              ? (documentoRaw.estado as DocumentoDisciplinaEstado)
              : undefined,
          generado_at: typeof documentoRaw.generado_at === 'string' ? documentoRaw.generado_at : undefined,
        }
      : undefined,
    suspension: suspensionRaw
      ? {
          dias: typeof suspensionRaw.dias === 'number' ? suspensionRaw.dias : null,
        }
      : undefined,
  }
}
