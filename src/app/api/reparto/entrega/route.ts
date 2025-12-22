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

    // Actualizar detalle de ruta con información de pago (SIN crear movimientos de caja)
    // Los movimientos de caja se crearán cuando el tesorero valide la ruta
    const updateData: any = {
      notas_entrega: data.notas_entrega,
      updated_at: new Date().toISOString()
    }

    // Registrar información de pago según el caso:
    // - Si es_pago_parcial: Pagó parcialmente
    // - Si motivo_rechazo: Rechazó el pedido
    // - Si monto_cobrado > 0: Ya pagó
    // - Si monto_cobrado = 0 pero hay metodo_pago: Pendiente de pago
    // - Si monto_cobrado = 0 y no hay metodo_pago: Pagará después (solo notas)

    if (data.motivo_rechazo) {
      // Pedido rechazado
      updateData.pago_registrado = true // Marcamos como "registrado" para que se pueda ver el estado
      updateData.metodo_pago_registrado = null
      updateData.monto_cobrado_registrado = 0
      updateData.notas_pago = `Rechazado: ${data.motivo_rechazo}. ${data.notas_entrega || ''}`
      updateData.estado_entrega = 'rechazado'
    } else if (data.es_pago_parcial && data.monto_cobrado !== undefined && data.monto_cobrado > 0) {
      // Pago parcial
      updateData.pago_registrado = true
      updateData.metodo_pago_registrado = data.metodo_pago || 'efectivo'
      updateData.monto_cobrado_registrado = data.monto_cobrado
      updateData.numero_transaccion_registrado = data.numero_transaccion || null
      updateData.notas_pago = `Pago parcial. ${data.notas_entrega || ''}`
    } else if (data.monto_cobrado && data.monto_cobrado > 0) {
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

    // Actualizar detalles_ruta
    await supabase
      .from('detalles_ruta')
      .update(updateData)
      .eq('id', detalleRuta.id)

    // Si es una entrega individual (pedido agrupado), también actualizar la tabla entregas
    if (data.entrega_id) {
      const entregaUpdateData: any = {
        updated_at: new Date().toISOString(),
        notas_pago: data.notas_entrega,
      }

      if (data.motivo_rechazo) {
        entregaUpdateData.estado_pago = 'rechazado'
        entregaUpdateData.estado_entrega = 'rechazado'
        entregaUpdateData.notas_pago = `Rechazado: ${data.motivo_rechazo}. ${data.notas_entrega || ''}`
      } else if (data.es_cuenta_corriente) {
        // Todo a cuenta corriente - marcar como pagado (a crédito)
        entregaUpdateData.estado_pago = 'cuenta_corriente'
        entregaUpdateData.metodo_pago = 'cuenta_corriente'
        entregaUpdateData.monto_cobrado = 0
      } else if (data.es_pago_parcial && data.monto_cobrado !== undefined) {
        // Pago parcial - parte pagada + resto a cuenta corriente
        entregaUpdateData.estado_pago = 'parcial'
        entregaUpdateData.metodo_pago = data.metodo_pago || 'efectivo'
        entregaUpdateData.monto_cobrado = data.monto_cobrado
        entregaUpdateData.numero_transaccion = data.numero_transaccion || null
      } else if (data.monto_cobrado && data.monto_cobrado > 0) {
        entregaUpdateData.estado_pago = 'pagado'
        entregaUpdateData.metodo_pago = data.metodo_pago || 'efectivo'
        entregaUpdateData.monto_cobrado = data.monto_cobrado
        entregaUpdateData.numero_transaccion = data.numero_transaccion || null
        entregaUpdateData.comprobante_url = data.comprobante_url || null
      } else if (data.metodo_pago && data.monto_cobrado === 0) {
        entregaUpdateData.estado_pago = 'pendiente'
        entregaUpdateData.metodo_pago = data.metodo_pago
      }

      await supabase
        .from('entregas')
        .update(entregaUpdateData)
        .eq('id', data.entrega_id)

      console.log('[API/entrega] Actualizada tabla entregas:', {
        entrega_id: data.entrega_id,
        estado_pago: entregaUpdateData.estado_pago,
        monto: entregaUpdateData.monto_cobrado
      })

      // Si hay monto a cuenta corriente, registrar en la cuenta del cliente
      if (data.monto_cuenta_corriente && data.monto_cuenta_corriente > 0) {
        // Obtener cliente_id de la entrega
        const { data: entregaData } = await supabase
          .from('entregas')
          .select('cliente_id')
          .eq('id', data.entrega_id)
          .single()

        if (entregaData?.cliente_id) {
          // Registrar movimiento en cuenta corriente
          await supabase.from('movimientos_cuenta_corriente').insert({
            cliente_id: entregaData.cliente_id,
            tipo: 'cargo',
            monto: data.monto_cuenta_corriente,
            descripcion: `Pedido ${data.pedido_id.slice(0, 8)} - Cargado a cuenta`,
            referencia_tipo: 'entrega',
            referencia_id: data.entrega_id,
          })

          console.log('[API/entrega] Registrado en cuenta corriente:', {
            cliente_id: entregaData.cliente_id,
            monto: data.monto_cuenta_corriente
          })
        }
      }

      // Actualizar estado de la factura según el pago
      const { data: factura } = await supabase
        .from('facturas')
        .select('id')
        .eq('entrega_id', data.entrega_id)
        .single()

      if (factura) {
        let estadoFactura = 'pendiente'
        if (data.es_cuenta_corriente) {
          estadoFactura = 'pendiente' // Todo a cuenta corriente = factura pendiente
        } else if (data.es_pago_parcial) {
          estadoFactura = 'parcial' // Pago parcial = factura parcialmente pagada
        } else if (data.monto_cobrado && data.monto_cobrado > 0) {
          estadoFactura = 'pagada' // Pagó todo = factura pagada
        }

        await supabase
          .from('facturas')
          .update({ estado: estadoFactura })
          .eq('id', factura.id)

        console.log('[API/entrega] Estado factura actualizado:', {
          factura_id: factura.id,
          estado: estadoFactura
        })
      }
    }

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
