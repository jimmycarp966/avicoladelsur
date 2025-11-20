import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Schema para registrar entrega
const registrarEntregaSchema = z.object({
  pedido_id: z.string().uuid(),
  firma_url: z.string().url().optional(),
  qr_verificacion: z.string().optional(),
  comprobante_url: z.string().url().optional(),
  metodo_pago: z.enum(['efectivo', 'transferencia', 'qr', 'tarjeta', 'cuenta_corriente']).optional(),
  numero_transaccion: z.string().optional(),
  monto_cobrado: z.number().positive().optional(),
  notas_entrega: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const data = registrarEntregaSchema.parse(body)

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
        { success: false, message: 'Solo repartidores pueden registrar entregas' },
        { status: 403 }
      )
    }

    // Buscar el detalle de ruta correspondiente
    const { data: detalleRuta, error: rutaError } = await supabase
      .from('detalles_ruta')
      .select('id, ruta_id')
      .eq('pedido_id', data.pedido_id)
      .eq('estado_entrega', 'en_camino')
      .single()

    if (rutaError || !detalleRuta) {
      return NextResponse.json(
        { success: false, message: 'Pedido no encontrado en ruta activa' },
        { status: 404 }
      )
    }

    // Registrar entrega usando RPC existente
    const { data: result, error: entregaError } = await supabase.rpc('fn_validar_entrega', {
      p_pedido_id: data.pedido_id,
      p_firma_url: data.firma_url,
      p_qr_verificacion: data.qr_verificacion,
    })

    if (entregaError || !result?.success) {
      return NextResponse.json(
        { success: false, message: result?.error || 'Error al registrar entrega' },
        { status: 500 }
      )
    }

    // Actualizar detalle de ruta con información adicional
    await supabase
      .from('detalles_ruta')
      .update({
        notas_entrega: data.notas_entrega,
        updated_at: new Date().toISOString()
      })
      .eq('id', detalleRuta.id)

    // Si hay cobro, registrar movimiento de tesorería
    if (data.monto_cobrado && data.monto_cobrado > 0) {
      // Buscar caja asociada al repartidor (simplificado - en producción buscar caja de ruta)
      const { data: cajas } = await supabase
        .from('tesoreria_cajas')
        .select('id')
        .limit(1)
        .single()

      if (cajas) {
        // Crear movimiento de ingreso
        await supabase.rpc('fn_crear_movimiento_caja', {
          p_caja_id: cajas.id,
          p_tipo: 'ingreso',
          p_monto: data.monto_cobrado,
          p_descripcion: `Cobro por entrega de pedido ${data.pedido_id}`,
          p_origen_tipo: 'pedido',
          p_origen_id: data.pedido_id,
          p_user_id: user.id,
        })

        // Actualizar pedido con información de pago
        await supabase
          .from('pedidos')
          .update({
            pago_estado: 'pagado',
            caja_movimiento_id: (
              await supabase
                .from('tesoreria_movimientos')
                .select('id')
                .eq('origen_id', data.pedido_id)
                .single()
            ).data?.id
          })
          .eq('id', data.pedido_id)
      }
    }

    // Subir comprobante si se proporcionó
    if (data.comprobante_url) {
      // En una implementación real, aquí se subiría el archivo a Storage
      // Por ahora, solo guardamos la URL
      await supabase
        .from('detalles_ruta')
        .update({ comprobante_url: data.comprobante_url })
        .eq('id', detalleRuta.id)
    }

    return NextResponse.json({
      success: true,
      message: 'Entrega registrada exitosamente',
      data: {
        pedido_id: data.pedido_id,
        entrega_registrada: true,
        cobro_registrado: !!data.monto_cobrado
      }
    })

  } catch (error) {
    console.error('Error en registrar entrega:', error)

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

export async function GET() {
  return NextResponse.json({
    success: true,
    mensaje: 'Endpoint para registro de entregas - PWA Repartidor',
    instrucciones: 'POST con datos de entrega',
    campos_requeridos: ['pedido_id'],
    campos_opcionales: [
      'firma_url',
      'qr_verificacion',
      'comprobante_url',
      'metodo_pago',
      'numero_transaccion',
      'monto_cobrado',
      'notas_entrega'
    ]
  })
}
