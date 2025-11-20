import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { confirmarPresupuestoAction } from '@/actions/presupuestos.actions'

const facturarSchema = z.object({
  presupuesto_id: z.string().uuid(),
  caja_id: z.string().uuid().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { presupuesto_id, caja_id } = facturarSchema.parse(body)

    const formData = new FormData()
    formData.append('presupuesto_id', presupuesto_id)
    if (caja_id) {
      formData.append('caja_id', caja_id)
    }

    const result = await confirmarPresupuestoAction(formData)

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      data: result.data,
    })
  } catch (error) {
    console.error('Error al facturar presupuesto:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Datos inválidos',
          details: error.issues,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}


