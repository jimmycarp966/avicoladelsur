import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
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
    let shouldRevalidateTesoreria = false

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
      // Validar número de transacción BNA si es transferencia
      if (data.metodo_pago === 'transferencia' && data.numero_transaccion) {
        // Validar que no empiece con 0
        if (data.numero_transaccion.startsWith('0')) {
          return NextResponse.json(
            { success: false, message: 'El número de transacción BNA no debe empezar con 0' },
            { status: 400 }
          )
        }

        // Validar que sea numérico
        if (!/^\d+$/.test(data.numero_transaccion)) {
          return NextResponse.json(
            { success: false, message: 'El número de transacción debe contener solo dígitos' },
            { status: 400 }
          )
        }
      }

      // Buscar caja central
      const { data: cajaCentral } = await supabase
        .from('tesoreria_cajas')
        .select('id, saldo_actual')
        .eq('nombre', 'Caja Central')
        .single()

        if (!cajaCentral) {
        // Si no existe Caja Central, usar la primera disponible
        const { data: cajas } = await supabase
          .from('tesoreria_cajas')
          .select('id')
          .limit(1)
          .single()

        if (cajas) {
          // Crear movimiento de ingreso
          const { data: movimiento, error: movimientoError } = await supabase
            .from('tesoreria_movimientos')
            .insert({
              caja_id: cajas.id,
              tipo: 'ingreso',
              monto: data.monto_cobrado,
              descripcion: `Cobro por entrega de pedido ${data.pedido_id}${data.numero_transaccion ? ` - Transacción: ${data.numero_transaccion}` : ''}`,
              origen_tipo: 'pedido',
              origen_id: data.pedido_id,
              metodo_pago: data.metodo_pago || 'efectivo',
              user_id: user.id,
            })
            .select()
            .single()

          if (!movimientoError && movimiento) {
            // Actualizar saldo de caja
            await supabase.rpc('fn_actualizar_saldo_caja', {
              p_caja_id: cajas.id,
              p_monto: data.monto_cobrado,
            })

            // Actualizar pedido con información de pago
            await supabase
              .from('pedidos')
              .update({
                pago_estado: 'pagado',
                caja_movimiento_id: movimiento.id,
              })
              .eq('id', data.pedido_id)

            shouldRevalidateTesoreria = true
          }
        }
      } else {
        // Crear movimiento de ingreso en caja central
        const { data: movimiento, error: movimientoError } = await supabase
          .from('tesoreria_movimientos')
          .insert({
            caja_id: cajaCentral.id,
            tipo: 'ingreso',
            monto: data.monto_cobrado,
            descripcion: `Cobro por entrega de pedido ${data.pedido_id}${data.numero_transaccion ? ` - Transacción: ${data.numero_transaccion}` : ''}`,
            origen_tipo: 'pedido',
            origen_id: data.pedido_id,
            metodo_pago: data.metodo_pago || 'efectivo',
            user_id: user.id,
          })
          .select()
          .single()

        if (!movimientoError && movimiento) {
          // Actualizar saldo de caja
          await supabase
            .from('tesoreria_cajas')
            .update({
              saldo_actual: (cajaCentral.saldo_actual || 0) + data.monto_cobrado,
              updated_at: new Date().toISOString(),
            })
            .eq('id', cajaCentral.id)

          // Actualizar pedido con información de pago
          await supabase
            .from('pedidos')
            .update({
              pago_estado: 'pagado',
              caja_movimiento_id: movimiento.id,
            })
            .eq('id', data.pedido_id)

          shouldRevalidateTesoreria = true
        }
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

    if (shouldRevalidateTesoreria) {
      revalidatePath('/(admin)/(dominios)/tesoreria/movimientos')
      revalidatePath('/(admin)/(dominios)/tesoreria')
      revalidatePath('/(admin)/(dominios)/tesoreria/tesoro')
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
