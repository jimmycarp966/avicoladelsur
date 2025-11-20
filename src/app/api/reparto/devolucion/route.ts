import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { registrarDevolucionAction } from '@/actions/reparto.actions'

// Schema para registrar devolución
const registrarDevolucionSchema = z.object({
  pedido_id: z.string().uuid(),
  detalle_ruta_id: z.string().uuid().optional(),
  producto_id: z.string().uuid(),
  cantidad: z.number().positive(),
  motivo: z.string().min(1),
  observaciones: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const data = registrarDevolucionSchema.parse(body)

    // Obtener usuario actual (repartidor)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { success: false, message: 'Usuario no autenticado' },
        { status: 401 }
      )
    }

    // Verificar que es repartidor
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || usuario.rol !== 'repartidor') {
      return NextResponse.json(
        { success: false, message: 'Solo repartidores pueden registrar devoluciones' },
        { status: 403 }
      )
    }

    // Crear FormData para la acción
    const formData = new FormData()
    formData.append('pedido_id', data.pedido_id)
    if (data.detalle_ruta_id) {
      formData.append('detalle_ruta_id', data.detalle_ruta_id)
    }
    formData.append('producto_id', data.producto_id)
    formData.append('cantidad', data.cantidad.toString())
    formData.append('motivo', data.motivo)
    if (data.observaciones) {
      formData.append('observaciones', data.observaciones)
    }

    // Llamar Server Action
    const result = await registrarDevolucionAction(formData)

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.error || 'Error al registrar devolución' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Devolución registrada exitosamente',
    })

  } catch (error) {
    console.error('Error en /api/reparto/devolucion:', error)

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

