import { MovimientoBancarioInput, DatosComprobante } from '@/types/conciliacion'
import { parse } from 'csv-parse/sync'
import * as XLSX from 'xlsx'
import { GoogleGenerativeAI } from "@google/generative-ai"
import { config } from "@/lib/config"
import { GEMINI_MODEL_PRO, GEMINI_MODEL_FLASH } from "@/lib/constants/gemini-models"

// Instancia de Gemini para parseo visual de documentos
const apiKey = config.googleCloud.gemini.apiKey || process.env.GOOGLE_GEMINI_API_KEY
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null

/**
 * Limpia un string de monto para convertirlo a número de forma robusta.
 * Maneja formatos: "14.000,00", "14,000.00", "14000.00", "$14.000"
 */
function limpiarMonto(montoStr: string | number): number {
    if (typeof montoStr === 'number') return montoStr;
    if (!montoStr) return 0;

    // Eliminar símbolos de moneda y espacios
    let limpio = montoStr.replace(/[$€\s]/g, '');

    // Caso común en Argentina: 14.000,50 (Punto para miles, coma para decimales)
    // Si tiene coma y punto, y la coma está al final (decimal)
    if (limpio.includes(',') && limpio.includes('.')) {
        const posComa = limpio.lastIndexOf(',');
        const posPunto = limpio.lastIndexOf('.');
        if (posComa > posPunto) {
            // Estilo ES/AR: 1.000,00 -> 1000.00
            limpio = limpio.replace(/\./g, '').replace(',', '.');
        } else {
            // Estilo EN/US: 1,000.00 -> 1000.00
            limpio = limpio.replace(/,/g, '');
        }
    } else if (limpio.includes(',')) {
        // Solo tiene coma: si hay exactamente 3 dígitos después, es probable que sea miles (ej: 14,000)
        // en lugar de decimal (ej: 14,00). 
        const parts = limpio.split(',');
        const lastPart = parts[parts.length - 1];
        if (lastPart.length === 3) {
            limpio = limpio.replace(/,/g, '');
        } else {
            limpio = limpio.replace(',', '.');
        }
    } else if (limpio.includes('.')) {
        // Solo tiene punto: igual que la coma, si hay 3 dígitos es miles.
        const parts = limpio.split('.');
        const lastPart = parts[parts.length - 1];
        if (lastPart.length === 3) {
            limpio = limpio.replace(/\./g, '');
        }
    }

    const resultado = parseFloat(limpio);
    return isNaN(resultado) ? 0 : resultado;
}

// ... (resto del código)

// Modelo PRO para análisis profundo de documentos (PDFs, imágenes complejas)
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
    console.log('[Parsers] ========== parsearSabanaBancaria ==========')
    console.log('[Parsers] Archivo:', file.name, 'Tamaño:', file.size, 'Tipo:', file.type)

    if (!genAI) {
        console.error('[Parsers] ERROR: Gemini API Key no configurada')
        throw new Error("Gemini API Key no configurada para procesar documentos")
    }

    console.log('[Parsers] Convirtiendo archivo a base64...')
    const buffer = await file.arrayBuffer()
    const base64Data = Buffer.from(buffer).toString('base64')
    console.log('[Parsers] Base64 length:', base64Data.length)

    const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
    })
    console.log('[Parsers] Modelo Gemini:', modelName)

    const mimeType = file.type || 'application/pdf'
    console.log('[Parsers] MIME type usado:', mimeType)

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

    console.log('[Parsers] Enviando petición a Gemini...')
    const tiempoInicio = Date.now()

    let result
    try {
        result = await model.generateContent([
            prompt,
            { inlineData: { data: base64Data, mimeType } }
        ])
        console.log('[Parsers] Respuesta recibida en', Date.now() - tiempoInicio, 'ms')
    } catch (geminiError) {
        console.error('[Parsers] ERROR en llamada a Gemini:', geminiError)
        throw new Error(`Error en Gemini API: ${geminiError instanceof Error ? geminiError.message : 'Error desconocido'}`)
    }

    const response = result.response
    const text = response.text()
    console.log('[Parsers] Texto respuesta Gemini (primeros 500 chars):', text.substring(0, 500))

    try {
        const data = JSON.parse(text)
        console.log('[Parsers] JSON parseado correctamente, elementos:', Array.isArray(data) ? data.length : 'no es array')

        const movimientos = data.map((d: Record<string, unknown>) => ({
            fecha: new Date(d.fecha as string),
            monto: limpiarMonto(d.monto as string | number),
            referencia: d.referencia as string || '',
            dni_cuit: d.dni_cuit ? String(d.dni_cuit).replace(/\D/g, '') : '',
            descripcion: d.descripcion as string || ''
        }))

        console.log('[Parsers] Movimientos procesados:', movimientos.length)
        movimientos.forEach((m: MovimientoBancarioInput, i: number) => {
            console.log(`[Parsers]   ${i + 1}. $${m.monto} - ${m.descripcion?.substring(0, 30)} - DNI: ${m.dni_cuit}`)
        })

        return movimientos
    } catch (parseError) {
        console.error('[Parsers] ERROR parseando JSON de Gemini:', parseError)
        console.error('[Parsers] Respuesta completa:', text)
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
    console.log('[Parsers] ========== parsearComprobante ==========')
    console.log('[Parsers] Archivo:', file.name, 'Tamaño:', file.size, 'Tipo:', file.type)

    if (!genAI) {
        console.error('[Parsers] ERROR: Gemini API Key no configurada')
        throw new Error("Gemini API Key no configurada para procesar documentos")
    }

    const buffer = await file.arrayBuffer()
    const base64Data = Buffer.from(buffer).toString('base64')
    console.log('[Parsers] Base64 length:', base64Data.length)

    const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL_FLASH, // Usar Flash para comprobantes (más rápido y mayor límite)
        generationConfig: { responseMimeType: "application/json" }
    })

    const mimeType = file.type || 'image/jpeg'
    console.log('[Parsers] MIME type usado:', mimeType)

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

    console.log('[Parsers] Enviando petición a Gemini...')
    const tiempoInicio = Date.now()

    let result
    try {
        result = await model.generateContent([
            prompt,
            { inlineData: { data: base64Data, mimeType } }
        ])
        console.log('[Parsers] Respuesta recibida en', Date.now() - tiempoInicio, 'ms')
    } catch (geminiError) {
        console.error('[Parsers] ERROR en llamada a Gemini:', geminiError)
        throw new Error(`Error en Gemini API: ${geminiError instanceof Error ? geminiError.message : 'Error desconocido'}`)
    }

    const response = result.response
    const text = response.text()
    console.log('[Parsers] Texto respuesta Gemini:', text.substring(0, 300))

    try {
        const data = JSON.parse(text)
        const comprobante = {
            fecha: data.fecha || undefined,
            monto: limpiarMonto(data.monto),
            dni_cuit: data.dni_cuit ? String(data.dni_cuit).replace(/\D/g, '') : undefined,
            referencia: data.referencia || undefined,
            descripcion: data.descripcion || undefined,
            confianza_extraccion: data.confianza_extraccion || 0.5,
            campos_detectados: data.campos_detectados || [],
            archivo_origen: file.name
        }
        console.log('[Parsers] Comprobante parseado:', JSON.stringify(comprobante))
        return comprobante
    } catch (parseError) {
        console.error('[Parsers] ERROR parseando JSON de Gemini (comprobante):', parseError)
        console.error('[Parsers] Respuesta completa:', text)
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
    console.log('[Parsers] ========== parsearComprobantesEnLote ==========')
    console.log('[Parsers] Total archivos a procesar:', files.length)

    const resultados: { datos: DatosComprobante; archivo: string; error?: string }[] = []
    const BATCH_SIZE = 5

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, Math.min(i + BATCH_SIZE, files.length))
        console.log(`[Parsers] Procesando batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} archivos (${i + 1}-${Math.min(i + BATCH_SIZE, files.length)} de ${files.length})`)

        // Procesar batch en paralelo
        const promesas = batch.map(async (file) => {
            try {
                const datos = await parsearComprobante(file)
                console.log(`[Parsers] ✅ ${file.name}: $${datos.monto} - DNI: ${datos.dni_cuit}`)
                return { datos, archivo: file.name }
            } catch (e) {
                console.error(`[Parsers] ❌ ${file.name}:`, e)
                return {
                    datos: { monto: 0, archivo_origen: file.name } as DatosComprobante,
                    archivo: file.name,
                    error: e instanceof Error ? e.message : 'Error desconocido'
                }
            }
        })

        const resultadosBatch = await Promise.all(promesas)
        resultados.push(...resultadosBatch)
        console.log(`[Parsers] Batch completado. Total procesados: ${resultados.length}/${files.length}`)

        // Notificar progreso
        if (onProgress) {
            onProgress(Math.min(i + BATCH_SIZE, files.length), files.length)
        }

        // Pausa entre batches para evitar rate limiting
        if (i + BATCH_SIZE < files.length) {
            console.log('[Parsers] Esperando 2000ms antes del siguiente batch...')
            await new Promise(resolve => setTimeout(resolve, 2000))
        }
    }

    console.log('[Parsers] ========== FIN parsearComprobantesEnLote ==========')
    console.log('[Parsers] Resultados finales:', resultados.length)
    const exitosos = resultados.filter(r => !r.error).length
    const fallidos = resultados.filter(r => r.error).length
    console.log('[Parsers] Exitosos:', exitosos, 'Fallidos:', fallidos)

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

    return (records as any[]).map((row: any) => ({
        fecha: new Date(String(row.fecha || row.Fecha || row.Date)),
        monto: limpiarMonto(row.monto || row.Monto || row.Amount || row.Importe),
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
