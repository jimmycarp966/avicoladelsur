import { NextRequest, NextResponse } from 'next/server'
import { actualizarPesoItemAction } from '@/actions/presupuestos.actions'
import { z } from 'zod'

const actualizarPesoSchema = z.object({
  presupuesto_item_id: z.string().uuid(),
  peso_final: z.number().positive(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { presupuesto_item_id, peso_final } = actualizarPesoSchema.parse(body)

    const formData = new FormData()
    formData.append('presupuesto_item_id', presupuesto_item_id)
    formData.append('peso_final', peso_final.toString())

    const result = await actualizarPesoItemAction(formData)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Peso actualizado exitosamente',
        data: result.data
      })
    } else {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Error en actualizar peso:', error)

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
