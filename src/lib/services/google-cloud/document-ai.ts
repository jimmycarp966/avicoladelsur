/**
 * Document AI API Integration
 * 
 * Integración con Google Document AI para procesar y extraer información
 * de documentos (facturas, remitos, recibos).
 */

import { getAccessToken, isGoogleCloudConfigured } from './auth'
import { config } from '@/lib/config'

export interface DocumentAIRequest {
  fileContent: string // Base64 encoded file
  mimeType: string // 'application/pdf', 'image/png', 'image/jpeg'
  processorId: string // ID del procesador (facturas o remitos)
}

export interface DocumentAIResponse {
  success: boolean
  document?: {
    text?: string // Texto completo extraído
    entities?: Array<{
      type: string
      value: string
      confidence: number
      normalizedValue?: any
    }>
    pages?: Array<{
      pageNumber: number
      text?: string
      formFields?: Record<string, {
        fieldName: string
        fieldValue: string
        confidence: number
      }>
    }>
  }
  extractedData?: {
    numero?: string
    fecha?: string
    proveedor?: string
    total?: number
    productos?: Array<{
      nombre: string
      cantidad: number
      precio: number
      subtotal: number
    }>
    [key: string]: any
  }
  error?: string
}

const DOCUMENT_AI_API_URL = 'https://documentai.googleapis.com/v1'

/**
 * Verifica si Document AI está disponible
 */
export function isDocumentAIAvailable(): boolean {
  return (
    isGoogleCloudConfigured() &&
    !!config.googleCloud.documentAI.projectId &&
    !!config.googleCloud.documentAI.location
  )
}

/**
 * Procesa un documento usando Document AI
 */
export async function processDocument(
  request: DocumentAIRequest
): Promise<DocumentAIResponse> {
  if (!isDocumentAIAvailable()) {
    return {
      success: false,
      error: 'Document AI no está configurado. Verifica GOOGLE_DOCUMENT_AI_PROJECT_ID y GOOGLE_DOCUMENT_AI_LOCATION'
    }
  }

  try {
    const accessToken = await getAccessToken()
    const projectId = config.googleCloud.documentAI.projectId
    const location = config.googleCloud.documentAI.location
    const processorId = request.processorId

    // Construir request body según Document AI API
    const requestBody = {
      rawDocument: {
        content: request.fileContent,
        mimeType: request.mimeType
      }
    }

    const response = await fetch(
      `${DOCUMENT_AI_API_URL}/projects/${projectId}/locations/${location}/processors/${processorId}:process`,
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
        error: `Document AI API error: ${response.status} - ${errorData.error?.message || response.statusText}`
      }
    }

    const data = await response.json()

    // Parsear respuesta
    const document = data.document
    if (!document) {
      return {
        success: false,
        error: 'Respuesta inválida de Document AI'
      }
    }

    // Extraer entidades (campos estructurados)
    const entities = document.entities?.map((entity: any) => ({
      type: entity.type || '',
      value: entity.textAnchor?.content || entity.mentionText || '',
      confidence: entity.confidence || 0,
      normalizedValue: entity.normalizedValue
    })) || []

    // Extraer datos estructurados según el tipo de documento
    const extractedData = extractStructuredData(document, entities)

    return {
      success: true,
      document: {
        text: document.text || '',
        entities,
        pages: document.pages?.map((page: any) => ({
          pageNumber: page.pageNumber || 0,
          text: page.layout?.textAnchor?.content || '',
          formFields: page.formFields ? 
            Object.fromEntries(
              Object.entries(page.formFields).map(([key, field]: [string, any]) => [
                key,
                {
                  fieldName: field.fieldName?.textAnchor?.content || key,
                  fieldValue: field.fieldValue?.textAnchor?.content || '',
                  confidence: field.fieldValue?.confidence || 0
                }
              ])
            ) : undefined
        })) || []
      },
      extractedData
    }
  } catch (error: any) {
    console.error('Error al procesar documento con Document AI:', error)
    return {
      success: false,
      error: error.message || 'Error desconocido al procesar documento con Document AI'
    }
  }
}

/**
 * Extrae datos estructurados del documento según su tipo
 */
function extractStructuredData(document: any, entities: any[]): DocumentAIResponse['extractedData'] {
  const data: DocumentAIResponse['extractedData'] = {}

  // Buscar entidades comunes
  const numeroEntity = entities.find(e => 
    e.type.includes('invoice_id') || 
    e.type.includes('receipt_id') ||
    e.type.includes('document_number')
  )
  if (numeroEntity) {
    data.numero = numeroEntity.value
  }

  const fechaEntity = entities.find(e => 
    e.type.includes('invoice_date') || 
    e.type.includes('receipt_date') ||
    e.type.includes('date')
  )
  if (fechaEntity) {
    data.fecha = fechaEntity.value
  }

  const proveedorEntity = entities.find(e => 
    e.type.includes('supplier_name') || 
    e.type.includes('vendor_name') ||
    e.type.includes('merchant_name')
  )
  if (proveedorEntity) {
    data.proveedor = proveedorEntity.value
  }

  const totalEntity = entities.find(e => 
    e.type.includes('total_amount') || 
    e.type.includes('invoice_amount') ||
    e.type.includes('total')
  )
  if (totalEntity) {
    const totalValue = totalEntity.normalizedValue?.moneyValue?.currencyCode === 'ARS' 
      ? totalEntity.normalizedValue.moneyValue.nanos / 1000000000 + totalEntity.normalizedValue.moneyValue.units
      : parseFloat(totalEntity.value.replace(/[^0-9.,]/g, '').replace(',', '.'))
    data.total = totalValue
  }

  // Extraer productos/items (si están disponibles)
  const lineItems = entities.filter(e => 
    e.type.includes('line_item') || 
    e.type.includes('item')
  )
  
  if (lineItems.length > 0) {
    data.productos = lineItems.map(item => ({
      nombre: item.value,
      cantidad: 1,
      precio: 0,
      subtotal: 0
    }))
  }

  return data
}

/**
 * Procesa una factura de proveedor
 */
export async function processFactura(
  fileContent: string,
  mimeType: string = 'application/pdf'
): Promise<DocumentAIResponse> {
  const processorId = config.googleCloud.documentAI.processors.facturas
  if (!processorId) {
    return {
      success: false,
      error: 'Processor ID de facturas no configurado'
    }
  }

  return processDocument({
    fileContent,
    mimeType,
    processorId
  })
}

/**
 * Procesa un remito de entrega
 */
export async function processRemito(
  fileContent: string,
  mimeType: string = 'application/pdf'
): Promise<DocumentAIResponse> {
  const processorId = config.googleCloud.documentAI.processors.remitos
  if (!processorId) {
    return {
      success: false,
      error: 'Processor ID de remitos no configurado'
    }
  }

  return processDocument({
    fileContent,
    mimeType,
    processorId
  })
}

