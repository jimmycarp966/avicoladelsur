import { MovimientoBancarioInput } from '@/types/conciliacion'
import { parse } from 'csv-parse/sync'
import * as XLSX from 'xlsx'
import { GoogleGenerativeAI } from "@google/generative-ai"
import { config } from "@/lib/config"

// Instancia de Gemini para parseo visual
const apiKey = config.googleCloud.gemini.apiKey || process.env.GOOGLE_GEMINI_API_KEY
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null
const modelName = "gemini-1.5-flash" // Flash es ideal para documentos/imágenes

export async function parsearArchivo(
    file: File,
    tipo: 'csv' | 'excel' | 'pdf' | 'imagen'
): Promise<MovimientoBancarioInput[]> {

    if (tipo === 'csv') {
        return parsearCSV(file)
    } else if (tipo === 'excel') {
        return parsearExcel(file)
    } else if (tipo === 'pdf' || tipo === 'imagen') {
        return parsearVisualConGemini(file)
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

    // Mapeo simple (esto idealmente sería configurable)
    return records.map((row: any) => ({
        fecha: new Date(row.fecha || row.Fecha || row.Date),
        monto: parseFloat(row.monto || row.Monto || row.Amount || row.Importe),
        referencia: row.referencia || row.Referencia || row.Ref || '',
        dni_cuit: row.dni || row.cuit || row.dni_cuit || '',
        descripcion: row.descripcion || row.Descripcion || row.Concepto || ''
    }))
}

async function parsearExcel(file: File): Promise<MovimientoBancarioInput[]> {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer)
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const records = XLSX.utils.sheet_to_json(sheet)

    return records.map((row: any) => ({
        fecha: new Date(row.fecha || row.Fecha || row.Date || row['F. Operación']), // Adaptar según formato Excel fecha
        monto: typeof row.monto === 'number' ? row.monto : parseFloat(row.monto || row.Monto || row.Importe),
        referencia: row.referencia || row.Referencia || '',
        dni_cuit: row.dni || row.cuit || '',
        descripcion: row.descripcion || row.Descripcion || row.Concepto || ''
    })) as MovimientoBancarioInput[]
}

async function parsearVisualConGemini(file: File): Promise<MovimientoBancarioInput[]> {
    if (!genAI) throw new Error("Gemini API Key no configurada para procesar documentos")

    const buffer = await file.arrayBuffer()
    const base64Data = Buffer.from(buffer).toString('base64')

    const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
    })

    // Determinar mime type
    const mimeType = file.type

    const prompt = `
    Analiza este documento bancario (resumen, listado de movimientos o comprobante).
    Extrae TODOS los movimientos o transacciones que encuentres en una lista estructurada.
    
    Para cada movimiento, extrae:
    - fecha: fecha de la operación (formato ISO YYYY-MM-DD)
    - monto: importe de la transacción (positivo, número flotante)
    - referencia: código o número de referencia si existe
    - dni_cuit: CUIT o DNI asociado si aparece
    - descripcion: detalle o concepto de la transacción
    
    Ignora saldos iniciales/finales, solo lista los movimientos.
    
    Responde exlusivamente con un ARRAY JSON:
    [
      { "fecha": "...", "monto": 100.50, "referencia": "...", "dni_cuit": "...", "descripcion": "..." },
      ...
    ]
  `

    const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64Data, mimeType } }
    ])

    const response = result.response
    const text = response.text()

    try {
        const data = JSON.parse(text)
        // Validar y convertir fechas
        return data.map((d: any) => ({
            fecha: new Date(d.fecha),
            monto: d.monto,
            referencia: d.referencia,
            dni_cuit: d.dni_cuit,
            descripcion: d.descripcion
        }))
    } catch (e) {
        console.error("Error parseando respuesta de Gemini:", text)
        throw new Error("La IA no pudo estructurar los datos del archivo correctamente.")
    }
}
