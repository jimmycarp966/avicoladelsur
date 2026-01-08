/**
 * POST /api/ia/clasificar-gasto
 * 
 * Endpoint que usa Gemini AI para sugerir la categoría de un gasto
 * basándose en su descripción.
 */

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_MODEL_FLASH } from '@/lib/constants/gemini-models'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '')

interface ClasificacionRequest {
    descripcion: string
}

interface ClasificacionResponse {
    success: boolean
    categoria?: string
    confianza?: number
    razon?: string
    error?: string
    usandoIA?: boolean
}

// Categorías de gastos disponibles en el sistema
const CATEGORIAS_GASTOS = [
    'Combustible',
    'Mantenimiento vehículos',
    'Servicios (luz, gas, agua)',
    'Sueldos y jornales',
    'Impuestos y tasas',
    'Alquileres',
    'Insumos de oficina',
    'Insumos de producción',
    'Limpieza',
    'Seguridad',
    'Seguros',
    'Fletes y envíos',
    'Publicidad y marketing',
    'Telefonía e internet',
    'Gastos bancarios',
    'Honorarios profesionales',
    'Reparaciones',
    'Materiales de empaque',
    'Varios',
]

// Fallback de clasificación basada en palabras clave
function clasificarLocal(descripcion: string): ClasificacionResponse {
    const desc = descripcion.toLowerCase()

    const reglas: { palabras: string[]; categoria: string }[] = [
        { palabras: ['nafta', 'combustible', 'ypf', 'shell', 'axion', 'gnc', 'gasoil'], categoria: 'Combustible' },
        { palabras: ['taller', 'gomería', 'mecánico', 'repuesto', 'aceite', 'freno'], categoria: 'Mantenimiento vehículos' },
        { palabras: ['luz', 'edenor', 'edesur', 'gas', 'metrogas', 'agua', 'aysa'], categoria: 'Servicios (luz, gas, agua)' },
        { palabras: ['sueldo', 'jornal', 'aguinaldo', 'vacaciones', 'empleado'], categoria: 'Sueldos y jornales' },
        { palabras: ['impuesto', 'ingresos brutos', 'iva', 'afip', 'arba', 'tasa'], categoria: 'Impuestos y tasas' },
        { palabras: ['alquiler', 'renta', 'arrendamiento'], categoria: 'Alquileres' },
        { palabras: ['resma', 'papel', 'tinta', 'cartuchos', 'oficina', 'escritorio'], categoria: 'Insumos de oficina' },
        { palabras: ['bolsa', 'caja', 'empaque', 'envoltorio', 'packaging'], categoria: 'Materiales de empaque' },
        { palabras: ['limpieza', 'lavandina', 'detergente', 'desinfectante'], categoria: 'Limpieza' },
        { palabras: ['seguro', 'póliza', 'aseguradora'], categoria: 'Seguros' },
        { palabras: ['flete', 'envío', 'transporte', 'correo'], categoria: 'Fletes y envíos' },
        { palabras: ['publicidad', 'marketing', 'facebook', 'instagram', 'google ads'], categoria: 'Publicidad y marketing' },
        { palabras: ['teléfono', 'celular', 'internet', 'movistar', 'claro', 'personal'], categoria: 'Telefonía e internet' },
        { palabras: ['banco', 'comisión', 'transferencia', 'mantenimiento cuenta'], categoria: 'Gastos bancarios' },
        { palabras: ['contador', 'abogado', 'honorarios', 'profesional'], categoria: 'Honorarios profesionales' },
        { palabras: ['reparación', 'arreglo', 'service'], categoria: 'Reparaciones' },
    ]

    for (const regla of reglas) {
        if (regla.palabras.some((palabra) => desc.includes(palabra))) {
            return {
                success: true,
                categoria: regla.categoria,
                confianza: 75,
                razon: `Detectado por palabras clave`,
                usandoIA: false,
            }
        }
    }

    return {
        success: true,
        categoria: 'Varios',
        confianza: 30,
        razon: 'No se encontró una categoría clara',
        usandoIA: false,
    }
}

export async function POST(request: NextRequest): Promise<NextResponse<ClasificacionResponse>> {
    try {
        const body: ClasificacionRequest = await request.json()

        if (!body.descripcion || body.descripcion.trim().length === 0) {
            return NextResponse.json({
                success: false,
                error: 'La descripción del gasto es requerida',
            })
        }

        // Intentar con Gemini AI
        try {
            const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_FLASH })

            const prompt = `Eres un asistente de contabilidad para una empresa avícola argentina.
Debes clasificar el siguiente gasto en UNA de estas categorías:
${CATEGORIAS_GASTOS.map((c) => `- ${c}`).join('\n')}

Gasto a clasificar: "${body.descripcion}"

Responde SOLO en formato JSON con esta estructura:
{
  "categoria": "nombre de la categoría elegida",
  "confianza": número del 1 al 100 indicando tu nivel de certeza,
  "razon": "breve explicación de por qué elegiste esta categoría"
}

IMPORTANTE: La categoría debe ser EXACTAMENTE una de las listadas arriba.`

            const result = await model.generateContent(prompt)
            const responseText = result.response.text()

            // Limpiar respuesta de Gemini
            const cleanedText = responseText
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim()

            const parsed = JSON.parse(cleanedText)

            // Validar que la categoría sea válida
            if (!CATEGORIAS_GASTOS.includes(parsed.categoria)) {
                // Si Gemini da una categoría inválida, usar fallback
                return NextResponse.json(clasificarLocal(body.descripcion))
            }

            return NextResponse.json({
                success: true,
                categoria: parsed.categoria,
                confianza: parsed.confianza,
                razon: parsed.razon,
                usandoIA: true,
            })
        } catch (iaError) {
            console.error('[IA] Error con Gemini, usando fallback local:', iaError)
            return NextResponse.json(clasificarLocal(body.descripcion))
        }
    } catch (error) {
        console.error('[IA] Error en clasificar-gasto:', error)
        return NextResponse.json({
            success: false,
            error: 'Error al clasificar el gasto',
        })
    }
}
