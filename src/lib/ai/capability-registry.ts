import type { AIProvider, AIStrategy } from '@/types/ai.types'

export type AICapabilityId =
  | 'stock_prediction'
  | 'customer_risk'
  | 'expense_classification'
  | 'payment_validation'
  | 'payment_audit'
  | 'reports_chat'
  | 'document_processing'
  | 'weight_anomaly'

export interface AICapability {
  id: AICapabilityId
  name: string
  strategy: AIStrategy
  provider: AIProvider
  endpoints: string[]
  uiPaths: string[]
  description: string
}

export const AI_CAPABILITY_REGISTRY: Record<AICapabilityId, AICapability> = {
  stock_prediction: {
    id: 'stock_prediction',
    name: 'Prediccion de stock',
    strategy: 'assisted',
    provider: 'gemini',
    endpoints: ['/api/ia/prediccion-stock', '/api/predictions/stock-coverage'],
    uiPaths: ['/dashboard', '/dashboard/predicciones'],
    description: 'Motor estadistico + sugerencias de reabastecimiento con Gemini.',
  },
  customer_risk: {
    id: 'customer_risk',
    name: 'Clientes en riesgo',
    strategy: 'assisted',
    provider: 'gemini',
    endpoints: ['/api/ia/clientes-riesgo', '/api/predictions/customer-risk'],
    uiPaths: ['/dashboard'],
    description: 'Scoring de riesgo + enriquecimiento de acciones comerciales con Gemini.',
  },
  expense_classification: {
    id: 'expense_classification',
    name: 'Clasificacion de gastos',
    strategy: 'assisted',
    provider: 'gemini',
    endpoints: ['/api/tesoreria/clasificar-gasto', '/api/ia/clasificar-gasto'],
    uiPaths: ['/tesoreria/gastos'],
    description: 'Clasificacion automatica con fallback local por palabras clave.',
  },
  payment_validation: {
    id: 'payment_validation',
    name: 'Validacion de cobros',
    strategy: 'assisted',
    provider: 'gemini',
    endpoints: ['/api/tesoreria/validar-cobro', '/api/ia/validar-cobro'],
    uiPaths: ['/tesoreria/validar-rutas'],
    description: 'Reglas antifraude + sugerencia IA para casos de alto riesgo.',
  },
  payment_audit: {
    id: 'payment_audit',
    name: 'Auditoria de cobros',
    strategy: 'none',
    provider: 'none',
    endpoints: ['/api/ia/auditar-cobros'],
    uiPaths: ['/tesoreria'],
    description: 'Motor por reglas para detectar anomalias, sin IA generativa.',
  },
  reports_chat: {
    id: 'reports_chat',
    name: 'Reportes IA y chat',
    strategy: 'primary',
    provider: 'gemini',
    endpoints: ['/api/reportes/ia/generate', '/api/reportes/ia/chat'],
    uiPaths: ['/reportes/ia'],
    description: 'Generacion de reportes y respuestas en lenguaje natural.',
  },
  document_processing: {
    id: 'document_processing',
    name: 'Documentos IA',
    strategy: 'primary',
    provider: 'document_ai',
    endpoints: ['/api/documents/process'],
    uiPaths: ['/almacen/documentos'],
    description: 'Extraccion automatica de datos con Document AI.',
  },
  weight_anomaly: {
    id: 'weight_anomaly',
    name: 'Anomalias de pesaje',
    strategy: 'assisted',
    provider: 'gemini',
    endpoints: ['/api/almacen/analizar-peso'],
    uiPaths: ['/almacen/presupuesto/[id]/pesaje'],
    description: 'Deteccion de anomalias de digitacion en pesaje con fallback local.',
  },
}

export function getAICapability(id: AICapabilityId): AICapability {
  return AI_CAPABILITY_REGISTRY[id]
}
