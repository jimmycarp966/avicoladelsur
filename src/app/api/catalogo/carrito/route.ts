import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Schema para crear pedido desde el catálogo
const crearPedidoSchema = z.object({
  telefono: z.string().min(10),
  token: z.string(),
  items: z.array(z.object({
    producto_id: z.string(),
    cantidad: z.number(),
    peso_aprox: z.number().optional(),
  })),
  total_estimado: z.number(),
})

// Función para validar token (misma lógica)
function validarToken(token: string): { valido: boolean; telefono?: string } {
  try {
    const decoded = Buffer.from(token, 'base64').toString()
    const parts = decoded.split('_')
    if (parts.length < 2) return { valido: false }
    const telefono = parts.slice(0, -1).join('_')
    const timestamp = parseInt(parts[parts.length - 1])
    const edad = Date.now() - timestamp
    if (edad > 86400000) return { valido: false }
    return { valido: true, telefono }
  } catch {
    return { valido: false }
  }
}

// Lista de precios mayorista
const LISTA_PRECIO_MAYORISTA = 'a0d2f9cb-08d2-4c4d-8e87-f2bc39d2b351'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const data = crearPedidoSchema.parse(body)

    // Validar token
    const { valido, telefono: telefonoDelToken } = validarToken(data.token)

    if (!valido || !telefonoDelToken) {
      return NextResponse.json(
        { success: false, error: 'Token inválido o expirado' },
        { status: 401 }
      )
    }

    // Verificar que el teléfono coincida
    if (telefonoDelToken !== data.telefono) {
      return NextResponse.json(
        { success: false, error: 'El teléfono no coincide con el token' },
        { status: 403 }
      )
    }

    // Buscar cliente
    const normalizedPhone = telefonoDelToken.replace(/[\s\-\(\)]/g, '')
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id')
      .or(`telefono.ilike.%${normalizedPhone}%,whatsapp.ilike.%${normalizedPhone}%`)
      .eq('activo', true)
      .single()

    if (!cliente) {
      return NextResponse.json(
        { success: false, error: 'Cliente no encontrado. Debes estar registrado para hacer pedidos.' },
        { status: 404 }
      )
    }

    // Preparar items para crear presupuesto
    const itemsPresupuesto = data.items.map(item => ({
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      lista_precio_id: LISTA_PRECIO_MAYORISTA,
    }))

    // Crear el presupuesto
    const { data: resultado, error } = await supabase.rpc('fn_crear_presupuesto_desde_bot', {
      p_cliente_id: cliente.id,
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
    mensaje: 'Endpoint para crear pedidos desde el catálogo (usa token de autenticación)'
  })
}
