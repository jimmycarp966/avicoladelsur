import { NextRequest, NextResponse } from 'next/server'
import { enviarPresupuestoAlmacenAction } from '@/actions/presupuestos.actions'
import { z } from 'zod'

const enviarAlmacenSchema = z.object({
  presupuesto_id: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { presupuesto_id } = enviarAlmacenSchema.parse(body)

    const result = await enviarPresupuestoAlmacenAction(presupuesto_id)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message
      })
    } else {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Error en enviar a almacén:', error)

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
