import { MovimientoBancarioInput, DatosComprobante } from '@/types/conciliacion'
import { parse } from 'csv-parse/sync'
import * as XLSX from 'xlsx'
import { GoogleGenerativeAI } from "@google/generative-ai"
import { config } from "@/lib/config"
import { GEMINI_MODEL_PRO } from "@/lib/constants/gemini-models"

// Instancia de Gemini para parseo visual de documentos
const apiKey = config.googleCloud.gemini.apiKey || process.env.GOOGLE_GEMINI_API_KEY
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null
// Modelo PRO para análisis profundo de documentos (PDFs, imágenes)
const modelName = GEMINI_MODEL_PRO

// Configuración de tolerancia (configurable)
export const TOLERANCIA_MONTO_PORCENTAJE = 2 // 2% de diferencia aceptable

// ===========================================
// PARSEO DE SÁBANA BANCARIA (PDF)
// ===========================================

/**
 * Parsea un PDF de sábana bancaria y extrae todos los movimientos.
 * Usa Gemini Vision para extraer datos estructurados.
 */
export async function parsearSabanaBancaria(file: File): Promise<MovimientoBancarioInput[]> {
    if (!genAI) throw new Error("Gemini API Key no configurada para procesar documentos")

    const buffer = await file.arrayBuffer()
    const base64Data = Buffer.from(buffer).toString('base64')

    const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
    })

    const mimeType = file.type || 'application/pdf'

    const prompt = `
    Analiza este extracto bancario (sábana) y extrae TODOS los movimientos de CRÉDITO (depósitos, transferencias recibidas).
    
    Para cada movimiento, extrae:
    - fecha: fecha de la operación (formato ISO YYYY-MM-DD)
    - monto: importe de la transacción (positivo, número flotante, sin símbolos de moneda)
    - referencia: código o número de referencia/operación si existe
    - dni_cuit: CUIT o DNI del ordenante si aparece (solo números, sin guiones)
    - descripcion: detalle o concepto de la transacción
    
    IMPORTANTE:
    - Solo incluye movimientos de CRÉDITO (dinero que ENTRA)
    - Ignora débitos, comisiones, saldos iniciales/finales
    - Normaliza los montos a números positivos
    - Si hay múltiples páginas, extrae de todas
    
    Responde exclusivamente con un ARRAY JSON:
    [
      { "fecha": "2026-01-05", "monto": 15000.00, "referencia": "TRF123", "dni_cuit": "20123456789", "descripcion": "Transferencia recibida" },
      ...
    ]
    
    Si no encuentras movimientos, devuelve un array vacío: []
    `

    const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64Data, mimeType } }
    ])

    const response = result.response
    const text = response.text()

    try {
        const data = JSON.parse(text)
        return data.map((d: Record<string, unknown>) => ({
            fecha: new Date(d.fecha as string),
            monto: typeof d.monto === 'number' ? d.monto : parseFloat(String(d.monto)),
            referencia: d.referencia as string || '',
            dni_cuit: d.dni_cuit ? String(d.dni_cuit).replace(/\D/g, '') : '',
            descripcion: d.descripcion as string || ''
        }))
    } catch {
        console.error("Error parseando respuesta de Gemini (sábana):", text)
        throw new Error("La IA no pudo estructurar los datos de la sábana bancaria correctamente.")
    }
}

// ===========================================
// PARSEO DE COMPROBANTES (IMÁGENES)
// ===========================================

/**
 * Parsea una imagen de comprobante de pago y extrae los datos.
 * Usa Gemini Vision para extraer datos estructurados.
 */
export async function parsearComprobante(file: File): Promise<DatosComprobante> {
    if (!genAI) throw new Error("Gemini API Key no configurada para procesar documentos")

    const buffer = await file.arrayBuffer()
    const base64Data = Buffer.from(buffer).toString('base64')

    const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
    })

    const mimeType = file.type || 'image/jpeg'

    const prompt = `
    Analiza esta imagen de comprobante de pago (puede ser captura de Mercado Pago, transferencia bancaria, depósito, etc).
    
    Extrae la siguiente información:
    - fecha: fecha de la operación (formato ISO YYYY-MM-DD). Si no está clara, usa la fecha actual.
    - monto: importe de la transacción (número positivo, sin símbolos de moneda)
    - dni_cuit: CUIT o DNI del ordenante/pagador si aparece (solo números, sin guiones)
    - referencia: código de operación, número de transacción, o referencia
    - descripcion: concepto o detalle de la transferencia
    
    IMPORTANTE:
    - Busca el monto principal de la transacción
    - El DNI/CUIT puede aparecer como "CUIT", "DNI", "Documento" o similar
    - La referencia puede ser "Número de operación", "Código de transacción", etc.
    - Si un campo no se puede determinar, déjalo vacío o null
    
    Responde exclusivamente con un objeto JSON:
    {
      "fecha": "2026-01-05",
      "monto": 15000.00,
      "dni_cuit": "20123456789",
      "referencia": "ABC123",
      "descripcion": "Pago de factura",
      "confianza_extraccion": 0.85,
      "campos_detectados": ["monto", "fecha", "dni_cuit"]
    }
    `

    const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64Data, mimeType } }
    ])

    const response = result.response
    const text = response.text()

    try {
        const data = JSON.parse(text)
        return {
            fecha: data.fecha || undefined,
            monto: typeof data.monto === 'number' ? data.monto : parseFloat(String(data.monto)) || 0,
            dni_cuit: data.dni_cuit ? String(data.dni_cuit).replace(/\D/g, '') : undefined,
            referencia: data.referencia || undefined,
            descripcion: data.descripcion || undefined,
            confianza_extraccion: data.confianza_extraccion || 0.5,
            campos_detectados: data.campos_detectados || []
        }
    } catch {
        console.error("Error parseando respuesta de Gemini (comprobante):", text)
        throw new Error("La IA no pudo extraer los datos del comprobante correctamente.")
    }
}

/**
 * Parsea múltiples imágenes de comprobantes en lotes.
 * Procesa en lotes de 5 para evitar límites de rate de Gemini.
 */
export async function parsearComprobantesEnLote(
    files: File[],
    onProgress?: (processed: number, total: number) => void
): Promise<{ datos: DatosComprobante; archivo: string; error?: string }[]> {
    const resultados: { datos: DatosComprobante; archivo: string; error?: string }[] = []
    const BATCH_SIZE = 5

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, Math.min(i + BATCH_SIZE, files.length))

        // Procesar batch en paralelo
        const promesas = batch.map(async (file) => {
            try {
                const datos = await parsearComprobante(file)
                return { datos, archivo: file.name }
            } catch (e) {
                return {
                    datos: { monto: 0 } as DatosComprobante,
                    archivo: file.name,
                    error: e instanceof Error ? e.message : 'Error desconocido'
                }
            }
        })

        const resultadosBatch = await Promise.all(promesas)
        resultados.push(...resultadosBatch)

        // Notificar progreso
        if (onProgress) {
            onProgress(Math.min(i + BATCH_SIZE, files.length), files.length)
        }

        // Pequeña pausa entre batches para evitar rate limiting
        if (i + BATCH_SIZE < files.length) {
            await new Promise(resolve => setTimeout(resolve, 500))
        }
    }

    return resultados
}

// ===========================================
// FUNCIONES LEGACY (para compatibilidad)
// ===========================================

export async function parsearArchivo(
    file: File,
    tipo: 'csv' | 'excel' | 'pdf' | 'imagen'
): Promise<MovimientoBancarioInput[]> {
    if (tipo === 'csv') {
        return parsearCSV(file)
    } else if (tipo === 'excel') {
        return parsearExcel(file)
    } else if (tipo === 'pdf') {
        return parsearSabanaBancaria(file)
    } else if (tipo === 'imagen') {
        // Para una sola imagen, retorna como array de un elemento
        const datos = await parsearComprobante(file)
        return [{
            fecha: datos.fecha ? new Date(datos.fecha) : new Date(),
            monto: datos.monto,
            referencia: datos.referencia || '',
            dni_cuit: datos.dni_cuit || '',
            descripcion: datos.descripcion || ''
        }]
    }

    throw new Error(`Tipo de archivo no soportado: ${tipo}`)
}

async function parsearCSV(file: File): Promise<MovimientoBancarioInput[]> {
    const text = await file.text()
    const records = parse(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true
    })

    return records.map((row: Record<string, unknown>) => ({
        fecha: new Date(String(row.fecha || row.Fecha || row.Date)),
        monto: parseFloat(String(row.monto || row.Monto || row.Amount || row.Importe)),
        referencia: String(row.referencia || row.Referencia || row.Ref || ''),
        dni_cuit: String(row.dni || row.cuit || row.dni_cuit || ''),
        descripcion: String(row.descripcion || row.Descripcion || row.Concepto || '')
    }))
}

async function parsearExcel(file: File): Promise<MovimientoBancarioInput[]> {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer)
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const records = XLSX.utils.sheet_to_json(sheet)

    return records.map((row: unknown) => {
        const r = row as Record<string, unknown>
        return {
            fecha: new Date(String(r.fecha || r.Fecha || r.Date || r['F. Operación'])),
            monto: typeof r.monto === 'number' ? r.monto : parseFloat(String(r.monto || r.Monto || r.Importe)),
            referencia: String(r.referencia || r.Referencia || ''),
            dni_cuit: String(r.dni || r.cuit || ''),
            descripcion: String(r.descripcion || r.Descripcion || r.Concepto || '')
        }
    }) as MovimientoBancarioInput[]
}
