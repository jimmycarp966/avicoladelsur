import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Schema para filtrar movimientos
const movimientosQuerySchema = z.object({
  caja_id: z.string().uuid().optional(),
  fecha_desde: z.string().optional(),
  fecha_hasta: z.string().optional(),
  tipo: z.enum(['ingreso', 'egreso']).optional(),
  limite: z.number().min(1).max(100).optional().default(50),
})

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    // Parsear parámetros de consulta
    const filtros = movimientosQuerySchema.parse({
      caja_id: searchParams.get('caja_id'),
      fecha_desde: searchParams.get('fecha_desde'),
      fecha_hasta: searchParams.get('fecha_hasta'),
      tipo: searchParams.get('tipo') as 'ingreso' | 'egreso',
      limite: searchParams.get('limite') ? parseInt(searchParams.get('limite')!) : 50,
    })

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { success: false, message: 'Usuario no autenticado' },
        { status: 401 }
      )
    }

    // Verificar permisos (admin o tesorero)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'vendedor'].includes(usuario.rol)) {
      return NextResponse.json(
        { success: false, message: 'No tienes permisos para ver movimientos de tesorería' },
        { status: 403 }
      )
    }

    // Construir consulta
    let query = supabase
      .from('tesoreria_movimientos')
      .select(`
        *,
        caja:tesoreria_cajas(nombre),
        usuario:usuarios(nombre),
        pedido:pedidos(numero_pedido, cliente:clientes(nombre))
      `)
      .order('created_at', { ascending: false })
      .limit(filtros.limite)

    // Aplicar filtros
    if (filtros.caja_id) {
      query = query.eq('caja_id', filtros.caja_id)
    }
    if (filtros.tipo) {
      query = query.eq('tipo', filtros.tipo)
    }
    if (filtros.fecha_desde) {
      query = query.gte('created_at', filtros.fecha_desde)
    }
    if (filtros.fecha_hasta) {
      query = query.lte('created_at', filtros.fecha_hasta)
    }

    const { data: movimientos, error } = await query

    if (error) {
      console.error('Error obteniendo movimientos:', error)
      return NextResponse.json(
        { success: false, message: 'Error al obtener movimientos' },
        { status: 500 }
      )
    }

    // Obtener saldo actual de cajas
    const { data: cajas } = await supabase
      .from('tesoreria_cajas')
      .select('id, nombre, saldo_actual, moneda')
      .order('created_at', { ascending: false })

    return NextResponse.json({
      success: true,
      data: {
        movimientos: movimientos || [],
        cajas: cajas || [],
        total_movimientos: movimientos?.length || 0
      }
    })

  } catch (error) {
    console.error('Error en movimientos-tiempo-real:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parámetros inválidos',
          details: error.errors
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

export async function POST(request: NextRequest) {
  // Endpoint para crear movimiento manual (futuro desarrollo)
  return NextResponse.json({
    success: false,
    message: 'Endpoint POST en desarrollo - usar /api/tesoreria/movimientos para crear movimientos'
  }, { status: 501 })
}
