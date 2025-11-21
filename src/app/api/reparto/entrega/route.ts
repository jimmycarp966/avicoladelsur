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

    // Actualizar detalle de ruta con información de pago (SIN crear movimientos de caja)
    // Los movimientos de caja se crearán cuando el tesorero valide la ruta
    const updateData: any = {
      notas_entrega: data.notas_entrega,
      updated_at: new Date().toISOString()
    }

    // Registrar información de pago según el caso:
    // - Si monto_cobrado > 0: Ya pagó
    // - Si monto_cobrado = 0 pero hay metodo_pago: Pendiente de pago
    // - Si monto_cobrado = 0 y no hay metodo_pago: Pagará después (solo notas)
    if (data.monto_cobrado && data.monto_cobrado > 0) {
      // Ya pagó - registrar monto y método
      updateData.pago_registrado = true
      updateData.metodo_pago_registrado = data.metodo_pago || 'efectivo'
      updateData.monto_cobrado_registrado = data.monto_cobrado
      updateData.numero_transaccion_registrado = data.numero_transaccion || null
      updateData.comprobante_url_registrado = data.comprobante_url || null
      updateData.notas_pago = data.notas_entrega || null
    } else if (data.metodo_pago && data.monto_cobrado === 0) {
      // Pendiente de pago - registrar método futuro pero sin monto
      updateData.pago_registrado = false
      updateData.metodo_pago_registrado = data.metodo_pago
      updateData.monto_cobrado_registrado = null
      updateData.notas_pago = data.notas_entrega || 'Pendiente de pago'
    } else if (data.monto_cobrado === 0) {
      // Pagará después - solo registrar notas
      updateData.pago_registrado = false
      updateData.metodo_pago_registrado = null
      updateData.monto_cobrado_registrado = null
      updateData.notas_pago = data.notas_entrega || 'Pagará después'
    }

    await supabase
      .from('detalles_ruta')
      .update(updateData)
      .eq('id', detalleRuta.id)

    // La función trigger actualizará automáticamente recaudacion_total_registrada en rutas_reparto
    // NO actualizamos pago_estado en pedidos hasta que el tesorero valide

    // Revalidar rutas para mostrar recaudación actualizada
    revalidatePath('/(repartidor)/ruta')
    revalidatePath('/(admin)/(dominios)/reparto/rutas')

    return NextResponse.json({
      success: true,
      message: 'Entrega registrada exitosamente',
      data: {
        pedido_id: data.pedido_id,
        entrega_registrada: true,
        cobro_registrado: !!data.monto_cobrado,
        nota: data.monto_cobrado ? 'El cobro quedará pendiente de validación por tesorería' : null
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
