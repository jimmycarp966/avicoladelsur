import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Schema para guardar carrito
const guardarCarritoSchema = z.object({
  telefono: z.string().min(10),
  items: z.array(z.object({
    producto_id: z.string(),
    producto_nombre: z.string(),
    cantidad: z.number(),
    peso_aprox: z.number().optional(),
    precio_unitario: z.number(),
  })),
  total_estimado: z.number(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const data = guardarCarritoSchema.parse(body)

    // Guardar carrito usando la RPC
    const { data: resultado, error } = await supabase.rpc('fn_guardar_carrito', {
      p_telefono: data.telefono,
      p_items: JSON.stringify(data.items),
      p_total_estimado: data.total_estimado,
    })

    if (error) {
      console.error('[API/Catalogo/Carrito] Error guardando carrito:', error)
      return NextResponse.json(
        { success: false, error: 'Error al guardar carrito' },
        { status: 500 }
      )
    }

    return NextResponse.json(resultado)
  } catch (error) {
    console.error('[API/Catalogo/Carrito] Error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.issues },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    mensaje: 'Endpoint para carritos del catálogo - POST para guardar carrito',
  })
}
