import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Schema para validar la solicitud
const simularPesoSchema = z.object({
  presupuesto_item_id: z.string().uuid(),
  peso_simulado: z.number().positive().optional(), // Si no se proporciona, genera uno aleatorio
})

// Función para generar peso simulado basado en la cantidad solicitada
function generarPesoSimulado(cantidadSolicitada: number): number {
  // Simula variaciones realistas del peso (±10%)
  const variacion = (Math.random() - 0.5) * 0.2 // -10% a +10%
  const pesoBase = cantidadSolicitada * 1000 // Convertir a gramos (asumiendo kg)
  return Math.round((pesoBase * (1 + variacion)) * 100) / 100 // Redondear a 2 decimales
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { presupuesto_item_id, peso_simulado } = simularPesoSchema.parse(body)

    // Generar peso simulado si no se proporcionó
    const pesoFinal = peso_simulado || generarPesoSimulado(1) // Valor por defecto si no hay cantidad

    // En un escenario real, aquí se conectaría con la balanza física
    // Por ahora, solo devolvemos el peso simulado

    return NextResponse.json({
      success: true,
      peso_simulado: pesoFinal,
      mensaje: `Peso simulado: ${pesoFinal} kg`,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error en simular-peso:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Datos inválidos',
          details: error.errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    mensaje: 'Endpoint de simulación de balanza - Solo para desarrollo',
    instrucciones: 'POST con { presupuesto_item_id, peso_simulado? }',
    ejemplo: {
      presupuesto_item_id: 'uuid-del-item',
      peso_simulado: 5.25 // opcional, si no se envía genera uno aleatorio
    }
  })
}
