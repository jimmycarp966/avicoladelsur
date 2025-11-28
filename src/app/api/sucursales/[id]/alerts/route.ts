import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/sucursales/[id]/alerts
// Obtiene alertas de stock de una sucursal específica
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

    // Obtener alertas con información del producto
    const { data: alertas, error: alertasError } = await supabase
      .from('alertas_stock')
      .select(`
        id,
        cantidad_actual,
        umbral,
        estado,
        created_at,
        productos (
          id,
          nombre,
          codigo
        )
      `)
      .eq('sucursal_id', sucursalId)
      .order('created_at', { ascending: false })

    if (alertasError) {
      return NextResponse.json(
        { success: false, error: `Error al obtener alertas: ${alertasError.message}` },
        { status: 500 }
      )
    }

    // Formatear respuesta
    const alertasFormateadas = alertas?.map(alerta => ({
      id: alerta.id,
      producto: {
        id: (alerta as any).productos?.id,
        nombre: (alerta as any).productos?.nombre,
        codigo: (alerta as any).productos?.codigo
      },
      cantidadActual: alerta.cantidad_actual,
      umbral: alerta.umbral,
      estado: alerta.estado,
      fechaCreacion: alerta.created_at
    })) || []

    return NextResponse.json({
      success: true,
      data: {
        sucursal: {
          id: sucursal.id,
          nombre: sucursal.nombre
        },
        alertas: alertasFormateadas,
        total: alertasFormateadas.length
      }
    })

  } catch (error) {
    console.error('Error en GET /api/sucursales/[id]/alerts:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}

// POST /api/sucursales/[id]/alerts
// Crea una nueva alerta manual para una sucursal
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: sucursalId } = await params

    const body = await request.json()
    const { productoId, cantidadActual, umbral } = body

    if (!productoId || cantidadActual === undefined || !umbral) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos: productoId, cantidadActual, umbral' },
        { status: 400 }
      )
    }

    // Verificar que la sucursal existe
    const { data: sucursal, error: sucursalError } = await supabase
      .from('sucursales')
      .select('id')
      .eq('id', sucursalId)
      .single()

    if (sucursalError || !sucursal) {
      return NextResponse.json(
        { success: false, error: 'Sucursal no encontrada' },
        { status: 404 }
      )
    }

    // Verificar que el producto existe
    const { data: producto, error: productoError } = await supabase
      .from('productos')
      .select('id, nombre')
      .eq('id', productoId)
      .single()

    if (productoError || !producto) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    // Crear alerta
    const { data: alerta, error: alertaError } = await supabase
      .from('alertas_stock')
      .insert({
        sucursal_id: sucursalId,
        producto_id: productoId,
        cantidad_actual: cantidadActual,
        umbral: umbral,
        estado: 'pendiente'
      })
      .select('id')
      .single()

    if (alertaError) {
      return NextResponse.json(
        { success: false, error: `Error al crear alerta: ${alertaError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        alertaId: alerta.id,
        mensaje: 'Alerta creada exitosamente'
      }
    })

  } catch (error) {
    console.error('Error en POST /api/sucursales/[id]/alerts:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}
