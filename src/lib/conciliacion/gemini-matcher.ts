import { GoogleGenerativeAI } from "@google/generative-ai"
import { config } from "@/lib/config"
import { MovimientoBancario, PagoEsperado } from "@/types/conciliacion"

// Initialize Gemini
const apiKey = config.googleCloud.gemini.apiKey || process.env.GOOGLE_GEMINI_API_KEY
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null
// Usar modelo flash para rapidez y costo
const modelName = "gemini-1.5-flash"

interface GeminiMatchResponse {
    match_id: string | null
    confianza: number // 0.0 - 1.0
    razon: string
}

export async function analizarMatchConGemini(
    movimiento: MovimientoBancario,
    candidatos: PagoEsperado[]
): Promise<GeminiMatchResponse> {
    if (!genAI) {
        console.error("Gemini API Key no configurada")
        return { match_id: null, confianza: 0, razon: "API Key no configurada" }
    }

    if (candidatos.length === 0) {
        return { match_id: null, confianza: 0, razon: "No hay candidatos para analizar" }
    }

    const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
    })

    // Preparar prompt
    const candidatosTexto = candidatos.map((p, i) =>
        `${i + 1}. ID: ${p.id} | Cliente: ${p.cliente?.nombre || 'N/A'} (CUIT: ${p.cliente?.cuit || 'N/A'}) | Monto: $${p.monto_esperado} | Fecha: ${p.fecha_esperada || 'N/A'} | Ref: ${p.referencia || 'N/A'}`
    ).join('\n')

    const prompt = `
    Eres un experto contable y auditor. Tu tarea es analizar un movimiento bancario y encontrar si corresponde a alguno de los pagos esperados (deuda de clientes).
    
    MOVIMIENTO BANCARIO:
    - Fecha: ${movimiento.fecha}
    - Monto: $${movimiento.monto}
    - Descripción/Ref: ${movimiento.referencia || ''} ${movimiento.descripcion || ''}
    - CUIT/DNI origen: ${movimiento.dni_cuit || 'No disponible'}

    CANDIDATOS (Pagos esperados):
    ${candidatosTexto}

    REGLAS:
    1. El monto puede variar levemente (retenciones, comisiones).
    2. Las fechas suelen ser cercanas pero no necesariamente exactas.
    3. Busca similitudes en nombres de clientes (abreviaciones, errores de tipeo) en la descripción del movimiento.
    4. Si hay coincidencia de CUIT, es un match muy fuerte.

    Responde ESTRICTAMENTE en JSON con este formato:
    {
      "match_id": "UUID del pago esperado o null si ninguno coincide",
      "confianza": 0.0 a 1.0 (número flotante, ej: 0.95),
      "razon": "Explicación breve de por qué es match o por qué no se encontró ninguno"
    }
  `

    try {
        const result = await model.generateContent(prompt)
        const response = result.response
        const text = response.text()

        const jsonInicio = text.indexOf('{')
        const jsonFin = text.lastIndexOf('}') + 1
        const jsonStr = text.substring(jsonInicio, jsonFin)

        const data = JSON.parse(jsonStr) as GeminiMatchResponse
        return data
    } catch (error) {
        console.error("Error consultando Gemini:", error)
        return { match_id: null, confianza: 0, razon: "Error al procesar con IA" }
    }
}
