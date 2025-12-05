import { NextRequest, NextResponse } from 'next/server'
import { confirmarPresupuestoAction } from '@/actions/presupuestos.actions'
import { z } from 'zod'

const convertirPedidoSchema = z.object({
  presupuesto_id: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const presupuesto_id = formData.get('presupuesto_id') as string

    if (!presupuesto_id) {
      return NextResponse.json(
        { success: false, message: 'ID de presupuesto requerido' },
        { status: 400 }
      )
    }

    const data = convertirPedidoSchema.parse({ presupuesto_id })

    const resultFormData = new FormData()
    resultFormData.append('presupuesto_id', data.presupuesto_id)

    const result = await confirmarPresupuestoAction(resultFormData)

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
    console.error('Error en convertir a pedido:', error)

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

