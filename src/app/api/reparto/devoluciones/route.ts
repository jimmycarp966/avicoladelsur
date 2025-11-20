import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { registrarDevolucionAction } from '@/actions/reparto.actions'

const devolucionSchema = z.object({
  pedido_id: z.string().uuid(),
  detalle_ruta_id: z.string().uuid().optional(),
  producto_id: z.string().uuid(),
  cantidad: z.number().positive(),
  motivo: z.string().min(3),
  observaciones: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pedido_id, detalle_ruta_id, producto_id, cantidad, motivo, observaciones } =
      devolucionSchema.parse(body)

    const formData = new FormData()
    formData.append('pedido_id', pedido_id)
    if (detalle_ruta_id) {
      formData.append('detalle_ruta_id', detalle_ruta_id)
    }
    formData.append('producto_id', producto_id)
    formData.append('cantidad', cantidad.toString())
    formData.append('motivo', motivo)
    if (observaciones) {
      formData.append('observaciones', observaciones)
    }

    const result = await registrarDevolucionAction(formData)

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: result.message || 'Devolución registrada exitosamente',
    })
  } catch (error) {
    console.error('Error al registrar devolución:', error)

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


