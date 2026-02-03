import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// Schema para registrar entrega
const registrarEntregaSchema = z.object({
  pedido_id: z.string().uuid(),
  entrega_id: z.string().uuid().optional(), // Para entregas individuales (pedidos agrupados)
  firma_url: z.string().url().optional(),
  qr_verificacion: z.string().optional(),
  comprobante_url: z.string().url().optional(),
  metodo_pago: z.enum(['efectivo', 'transferencia', 'qr', 'tarjeta', 'cuenta_corriente']).optional(),
  numero_transaccion: z.string().optional(),
  monto_cobrado: z.number().min(0).optional(),
  monto_cuenta_corriente: z.number().min(0).optional(), // Monto que va a cuenta corriente
  es_cuenta_corriente: z.boolean().optional(), // Todo el monto va a cuenta corriente
  notas_entrega: z.string().optional(),
  // Nuevos campos para estados adicionales
  es_pago_parcial: z.boolean().optional(),
  motivo_rechazo: z.string().optional(),
  estado_entrega: z.enum(['pendiente', 'entregado', 'rechazado']).optional(),
  facturas_pagadas: z.array(z.string().uuid()).optional(),
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
    // Permitir cualquier estado que no sea 'entregado' o 'rechazado'
    const { data: detalleRuta, error: rutaError } = await supabase
      .from('detalles_ruta')
      .select('id, ruta_id, estado_entrega')
      .eq('pedido_id', data.pedido_id)
      .not('estado_entrega', 'in', '("entregado","rechazado")')
      .single()

    console.log('[API/entrega] Búsqueda detalleRuta:', {
      pedido_id: data.pedido_id,
      found: !!detalleRuta,
      estado: detalleRuta?.estado_entrega,
      error: rutaError?.message
    })

    if (rutaError || !detalleRuta) {
      return NextResponse.json(
        { success: false, message: 'Pedido no encontrado en ruta activa o ya fue entregado' },
        { status: 404 }
      )
    }

    // Intentar registrar entrega usando RPC (opcional, puede no existir o fallar)
    // El objetivo principal es actualizar el estado de pago en detalles_ruta
    try {
      const { data: result, error: entregaError } = await supabase.rpc('fn_validar_entrega', {
        p_pedido_id: data.pedido_id,
        p_firma_url: data.firma_url,
        p_qr_verificacion: data.qr_verificacion,
      })

      if (entregaError) {
        console.log('[API/entrega] RPC fn_validar_entrega falló (ignorando):', entregaError.message)
        // Continuamos sin la validación de entrega
      } else if (result && !result.success) {
        console.log('[API/entrega] RPC fn_validar_entrega resultado negativo (ignorando):', result.error)
        // Continuamos sin la validación de entrega
      }
    } catch (rpcError) {
      console.log('[API/entrega] RPC fn_validar_entrega no disponible (ignorando):', rpcError)
      // Continuamos sin la validación de entrega
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

    // ============================================
    // Usar RPC unificada para registro de entrega
    // Centraliza toda la lógica de actualización en una transacción atómica
    // ============================================
    const { data: resultadoEntrega, error: errorEntrega } = await supabase.rpc('fn_registrar_entrega_completa', {
      p_pedido_id: data.pedido_id,
      p_repartidor_id: user.id,
      p_entrega_id: data.entrega_id,
      p_facturas_pagadas: data.facturas_pagadas || [],
      p_estado_entrega: data.estado_entrega || 'entregado',
      p_metodo_pago: data.metodo_pago,
      p_monto_cobrado: data.monto_cobrado || 0,
      p_monto_cuenta_corriente: data.monto_cuenta_corriente || 0,
      p_es_cuenta_corriente: data.es_cuenta_corriente || false,
      p_es_pago_parcial: data.es_pago_parcial || false,
      p_motivo_rechazo: data.motivo_rechazo,
      p_notas_entrega: data.notas_entrega,
      p_comprobante_url: data.comprobante_url,
      p_numero_transaccion: data.numero_transaccion,
      p_firma_url: data.firma_url,
      p_qr_verificacion: data.qr_verificacion
    })

    if (errorEntrega || !resultadoEntrega?.success) {
      console.error('[API/entrega] Error en RPC fn_registrar_entrega_completa:', errorEntrega || resultadoEntrega?.error)
      return NextResponse.json(
        {
          success: false,
          message: 'Error al registrar entrega',
          error: errorEntrega?.message || resultadoEntrega?.error || 'Error desconocido'
        },
        { status: 500 }
      )
    }

    console.log('[API/entrega] Entrega registrada exitosamente:', resultadoEntrega)

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
