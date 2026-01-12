import { NextRequest, NextResponse } from 'next/server'
import { analizarPesoConIA, DatosPesaje } from '@/lib/gemini'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as DatosPesaje

        // Validar campos requeridos
        if (!body.productoNombre || body.pesoSolicitado === undefined || body.pesoIngresado === undefined) {
            return NextResponse.json(
                { error: 'Faltan campos requeridos: productoNombre, pesoSolicitado, pesoIngresado' },
                { status: 400 }
            )
        }

        console.log(`[API analizar-peso] Iniciando análisis para: ${body.productoNombre} (Ingresado: ${body.pesoIngresado}, Solicitado: ${body.pesoSolicitado})`)

        // Analizar con Gemini AI
        const resultado = await analizarPesoConIA({
            productoNombre: body.productoNombre,
            pesoSolicitado: body.pesoSolicitado,
            pesoIngresado: body.pesoIngresado,
            unidad: body.unidad || 'kg'
        })

        console.log(`[API analizar-peso] Resultado para ${body.productoNombre}:`, resultado)

        return NextResponse.json({
            success: true,
            ...resultado
        })

    } catch (error) {
        console.error('[API analizar-peso] Error:', error)
        return NextResponse.json(
            { error: 'Error al analizar el peso', details: String(error) },
            { status: 500 }
        )
    }
}
