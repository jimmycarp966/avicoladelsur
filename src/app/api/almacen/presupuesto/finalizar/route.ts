import { NextRequest, NextResponse } from 'next/server'
import { confirmarPresupuestoAction } from '@/actions/presupuestos.actions'
import { z } from 'zod'

const finalizarPresupuestoSchema = z.object({
  presupuesto_id: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { presupuesto_id } = finalizarPresupuestoSchema.parse(body)

    const formData = new FormData()
    formData.append('presupuesto_id', presupuesto_id)

    const result = await confirmarPresupuestoAction(formData)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        data: result.data
      })
    } else {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Error en finalizar presupuesto:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Datos inválidos',
          details: error.issues
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
