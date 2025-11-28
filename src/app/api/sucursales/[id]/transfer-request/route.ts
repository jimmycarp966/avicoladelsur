import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/sucursales/[id]/transfer-request
// Crea una solicitud de transferencia de productos desde sucursal a central
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: sucursalId } = await params

    const body = await request.json()
    const { productoId, cantidadSolicitada, motivo } = body

    if (!productoId || !cantidadSolicitada || cantidadSolicitada <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Faltan campos requeridos: productoId, cantidadSolicitada (debe ser > 0)'
        },
        { status: 400 }
      )
    }

    // Verificar que la sucursal existe y está activa
    const { data: sucursal, error: sucursalError } = await supabase
      .from('sucursales')
      .select('id, nombre, active')
      .eq('id', sucursalId)
      .eq('active', true)
      .single()

    if (sucursalError || !sucursal) {
      return NextResponse.json(
        { success: false, error: 'Sucursal no encontrada o inactiva' },
        { status: 404 }
      )
    }

    // Verificar que el producto existe
    const { data: producto, error: productoError } = await supabase
      .from('productos')
      .select('id, nombre, codigo')
      .eq('id', productoId)
      .single()

    if (productoError || !producto) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    // Verificar stock actual en la sucursal
    const { data: stockData, error: stockError } = await supabase
      .rpc('fn_consultar_stock_por_lote', {
        p_sucursal_id: sucursalId,
        p_producto_id: productoId
      })

    if (stockError) {
      return NextResponse.json(
        { success: false, error: `Error al verificar stock: ${stockError.message}` },
        { status: 500 }
      )
    }

    const stockActual = stockData?.reduce((sum: number, lote: any) => sum + lote.cantidad_disponible, 0) || 0

    if (stockActual < cantidadSolicitada) {
      return NextResponse.json(
        {
          success: false,
          error: `Stock insuficiente. Actual: ${stockActual}, Solicitado: ${cantidadSolicitada}`
        },
        { status: 400 }
      )
    }

    // Crear reserva temporal del stock (stock_reservations)
    const { data: reserva, error: reservaError } = await supabase
      .from('stock_reservations')
      .insert({
        sucursal_id: sucursalId,
        producto_id: productoId,
        cantidad_reservada: cantidadSolicitada,
        tipo_reserva: 'transfer_request',
        descripcion: `Solicitud de transferencia: ${motivo || 'Sin motivo especificado'}`,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 horas
      })
      .select('id')
      .single()

    if (reservaError) {
      return NextResponse.json(
        { success: false, error: `Error al crear reserva: ${reservaError.message}` },
        { status: 500 }
      )
    }

    // TODO: En futura implementación, crear registro en tabla transfer_requests
    // Por ahora, solo registramos la reserva y notificamos

    // Crear notificación para admins
    const { error: notifError } = await supabase
      .rpc('crear_notificacion', {
        p_tipo: 'transfer_request',
        p_titulo: `Solicitud de Transferencia - ${sucursal.nombre}`,
        p_mensaje: `${sucursal.nombre} solicita ${cantidadSolicitada} unidades de ${producto.nombre} (${producto.codigo}). ${motivo || ''}`,
        p_prioridad: 'alta',
        p_destinatarios: ['admin']
      })

    if (notifError) {
      console.warn('Error al crear notificación:', notifError)
      // No fallar la solicitud por esto
    }

    return NextResponse.json({
      success: true,
      data: {
        reservaId: reserva.id,
        mensaje: 'Solicitud de transferencia creada exitosamente',
        detalles: {
          sucursal: sucursal.nombre,
          producto: `${producto.nombre} (${producto.codigo})`,
          cantidad: cantidadSolicitada,
          stockActual: stockActual,
          reservaExpira: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
      }
    })

  } catch (error) {
    console.error('Error en POST /api/sucursales/[id]/transfer-request:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}

// GET /api/sucursales/[id]/transfer-request
// Obtiene solicitudes de transferencia pendientes de una sucursal
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: sucursalId } = await params

    // Verificar que la sucursal existe
    const { data: sucursal, error: sucursalError } = await supabase
      .from('sucursales')
      .select('id, nombre')
      .eq('id', sucursalId)
      .single()

    if (sucursalError || !sucursal) {
      return NextResponse.json(
        { success: false, error: 'Sucursal no encontrada' },
        { status: 404 }
      )
    }

    // Obtener reservas de transfer_request activas
    const { data: reservas, error: reservasError } = await supabase
      .from('stock_reservations')
      .select(`
        id,
        cantidad_reservada,
        descripcion,
        created_at,
        expires_at,
        productos (
          id,
          nombre,
          codigo
        )
      `)
      .eq('sucursal_id', sucursalId)
      .eq('tipo_reserva', 'transfer_request')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (reservasError) {
      return NextResponse.json(
        { success: false, error: `Error al obtener solicitudes: ${reservasError.message}` },
        { status: 500 }
      )
    }

    const solicitudes = reservas?.map(reserva => ({
      id: reserva.id,
      producto: {
        id: (reserva as any).productos?.id,
        nombre: (reserva as any).productos?.nombre,
        codigo: (reserva as any).productos?.codigo
      },
      cantidadSolicitada: reserva.cantidad_reservada,
      motivo: reserva.descripcion?.replace('Solicitud de transferencia: ', '') || '',
      fechaSolicitud: reserva.created_at,
      expiraEn: reserva.expires_at
    })) || []

    return NextResponse.json({
      success: true,
      data: {
        sucursal: {
          id: sucursal.id,
          nombre: sucursal.nombre
        },
        solicitudes,
        total: solicitudes.length
      }
    })

  } catch (error) {
    console.error('Error en GET /api/sucursales/[id]/transfer-request:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}
