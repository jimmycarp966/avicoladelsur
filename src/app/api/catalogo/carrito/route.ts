import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Schema para crear presupuesto desde el catálogo
const crearPresupuestoSchema = z.object({
  telefono: z.string().min(10),
  items: z.array(z.object({
    producto_id: z.string(),
    cantidad: z.number(),
    peso_aprox: z.number().optional(),
  })),
  total_estimado: z.number(),
})

// Lista de precios mayorista (la que está cargada en el sistema)
const LISTA_PRECIO_MAYORISTA = 'a0d2f9cb-08d2-4c4d-8e87-f2bc39d2b351'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const data = crearPresupuestoSchema.parse(body)

    // Buscar cliente por teléfono
    const { data: cliente, error: errorCliente } = await supabase
      .from('clientes')
      .select('id')
      .eq('telefono', data.telefono)
      .single()

    let clienteId = cliente?.id

    // Si no existe el cliente, crear uno nuevo
    if (errorCliente || !cliente) {
      const { data: nuevoCliente, error: errorNuevo } = await supabase
        .from('clientes')
        .insert({
          telefono: data.telefono,
          nombre: 'Cliente Catálogo Web',
          activo: true,
        })
        .select('id')
        .single()

      if (errorNuevo) {
        console.error('[API/Catalogo/Carrito] Error creando cliente:', errorNuevo)
        return NextResponse.json(
          { success: false, error: 'Error al crear cliente' },
          { status: 500 }
        )
      }
      clienteId = nuevoCliente.id
    }

    if (!clienteId) {
      return NextResponse.json(
        { success: false, error: 'No se pudo identificar al cliente' },
        { status: 400 }
      )
    }

    // Preparar items para la función de crear presupuesto
    const itemsPresupuesto = data.items.map(item => ({
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      lista_precio_id: LISTA_PRECIO_MAYORISTA,
    }))

    // Crear el presupuesto usando la RPC
    const { data: resultado, error } = await supabase.rpc('fn_crear_presupuesto_desde_bot', {
      p_cliente_id: clienteId,
      p_items: JSON.stringify(itemsPresupuesto),
      p_observaciones: 'Pedido desde catálogo web',
    })

    if (error) {
      console.error('[API/Catalogo/Carrito] Error creando presupuesto:', error)
      return NextResponse.json(
        { success: false, error: 'Error al crear presupuesto' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      presupuesto_id: resultado?.presupuesto_id,
      codigo: resultado?.codigo,
      mensaje: '¡Pedido creado correctamente!'
    })
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
    mensaje: 'Endpoint para crear presupuestos desde el catálogo',
  })
}
