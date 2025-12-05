'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

// Schemas de validación
const registrarCobroEntregaSchema = z.object({
  entrega_id: z.string().uuid(),
  metodo_pago: z.string().min(1),
  monto_cobrado: z.number().min(0),
  numero_transaccion: z.string().optional(),
  comprobante_url: z.string().optional(),
  notas: z.string().optional(),
})

const marcarEntregaCompletadaSchema = z.object({
  entrega_id: z.string().uuid(),
  firma_url: z.string().optional(),
  notas: z.string().optional(),
})

// Acción para obtener entregas de un pedido
export async function obtenerEntregasPedidoAction(pedidoId: string) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('fn_obtener_entregas_pedido', {
      p_pedido_id: pedidoId,
    })

    if (error) {
      console.error('Error obteniendo entregas:', error)
      return { success: false, message: 'Error al obtener entregas del pedido' }
    }

    return { success: true, data }

  } catch (error) {
    console.error('Error en obtenerEntregasPedidoAction:', error)
    return { success: false, message: 'Error interno del servidor' }
  }
}

// Acción para obtener detalle de una entrega
export async function obtenerEntregaAction(entregaId: string) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('entregas')
      .select(`
        *,
        cliente:clientes(*),
        presupuesto:presupuestos(numero_presupuesto),
        pedido:pedidos(numero_pedido, turno, zona_id, fecha_entrega_estimada),
        items:detalles_pedido(
          *,
          producto:productos(codigo, nombre, unidad_medida)
        )
      `)
      .eq('id', entregaId)
      .single()

    if (error) {
      console.error('Error obteniendo entrega:', error)
      return { success: false, message: 'Error al obtener entrega' }
    }

    return { success: true, data }

  } catch (error) {
    console.error('Error en obtenerEntregaAction:', error)
    return { success: false, message: 'Error interno del servidor' }
  }
}

// Acción para registrar cobro de una entrega
export async function registrarCobroEntregaAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, message: 'Usuario no autenticado' }
    }

    // Parsear y validar datos
    const rawData = Object.fromEntries(formData)
    const data = registrarCobroEntregaSchema.parse({
      entrega_id: rawData.entrega_id,
      metodo_pago: rawData.metodo_pago,
      monto_cobrado: parseFloat(rawData.monto_cobrado as string) || 0,
      numero_transaccion: rawData.numero_transaccion || undefined,
      comprobante_url: rawData.comprobante_url || undefined,
      notas: rawData.notas || undefined,
    })

    // Llamar RPC para registrar cobro
    const { data: result, error } = await supabase.rpc('fn_registrar_cobro_entrega', {
      p_entrega_id: data.entrega_id,
      p_metodo_pago: data.metodo_pago,
      p_monto_cobrado: data.monto_cobrado,
      p_repartidor_id: user.id,
      p_numero_transaccion: data.numero_transaccion || null,
      p_comprobante_url: data.comprobante_url || null,
      p_notas: data.notas || null,
    })

    if (error) {
      console.error('Error registrando cobro:', error)
      return { success: false, message: 'Error al registrar cobro' }
    }

    if (!result.success) {
      return { success: false, message: result.error || 'Error en el registro del cobro' }
    }

    revalidatePath('/repartidor')
    revalidatePath('/almacen/pedidos')
    revalidatePath('/tesoreria')

    return {
      success: true,
      message: `Cobro registrado: $${data.monto_cobrado} - ${data.metodo_pago}`,
      data: result
    }

  } catch (error) {
    console.error('Error en registrarCobroEntregaAction:', error)
    if (error instanceof z.ZodError) {
      return { success: false, message: 'Datos inválidos: ' + error.issues[0].message }
    }
    return { success: false, message: 'Error interno del servidor' }
  }
}

// Acción para marcar entrega como completada
export async function marcarEntregaCompletadaAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, message: 'Usuario no autenticado' }
    }

    // Parsear y validar datos
    const rawData = Object.fromEntries(formData)
    const data = marcarEntregaCompletadaSchema.parse({
      entrega_id: rawData.entrega_id,
      firma_url: rawData.firma_url || undefined,
      notas: rawData.notas || undefined,
    })

    // Llamar RPC para marcar entrega
    const { data: result, error } = await supabase.rpc('fn_marcar_entrega_completada', {
      p_entrega_id: data.entrega_id,
      p_firma_url: data.firma_url || null,
      p_notas: data.notas || null,
    })

    if (error) {
      console.error('Error marcando entrega:', error)
      return { success: false, message: 'Error al marcar entrega como completada' }
    }

    if (!result.success) {
      return { success: false, message: result.error || 'Error al completar entrega' }
    }

    revalidatePath('/repartidor')
    revalidatePath('/almacen/pedidos')

    return {
      success: true,
      message: result.pedido_completado 
        ? 'Entrega completada. ¡Pedido finalizado!' 
        : 'Entrega completada exitosamente',
      data: result
    }

  } catch (error) {
    console.error('Error en marcarEntregaCompletadaAction:', error)
    if (error instanceof z.ZodError) {
      return { success: false, message: 'Datos inválidos: ' + error.issues[0].message }
    }
    return { success: false, message: 'Error interno del servidor' }
  }
}

// Acción para marcar entrega como "en camino"
export async function marcarEntregaEnCaminoAction(entregaId: string) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, message: 'Usuario no autenticado' }
    }

    if (!entregaId) {
      return { success: false, message: 'ID de entrega requerido' }
    }

    // Actualizar estado de entrega
    const { error } = await supabase
      .from('entregas')
      .update({
        estado_entrega: 'en_camino',
        updated_at: new Date().toISOString(),
      })
      .eq('id', entregaId)

    if (error) {
      console.error('Error marcando entrega en camino:', error)
      return { success: false, message: 'Error al marcar entrega en camino' }
    }

    revalidatePath('/repartidor')
    revalidatePath('/almacen/pedidos')

    return {
      success: true,
      message: 'Entrega marcada como en camino'
    }

  } catch (error) {
    console.error('Error en marcarEntregaEnCaminoAction:', error)
    return { success: false, message: 'Error interno del servidor' }
  }
}

// Acción para marcar entrega como fallida
export async function marcarEntregaFallidaAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, message: 'Usuario no autenticado' }
    }

    const entregaId = formData.get('entrega_id') as string
    const notas = formData.get('notas') as string

    if (!entregaId) {
      return { success: false, message: 'ID de entrega requerido' }
    }

    // Actualizar estado de entrega
    const { error } = await supabase
      .from('entregas')
      .update({
        estado_entrega: 'fallido',
        notas_entrega: notas,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entregaId)

    if (error) {
      console.error('Error marcando entrega fallida:', error)
      return { success: false, message: 'Error al marcar entrega como fallida' }
    }

    revalidatePath('/repartidor')
    revalidatePath('/almacen/pedidos')

    return {
      success: true,
      message: 'Entrega marcada como fallida'
    }

  } catch (error) {
    console.error('Error en marcarEntregaFallidaAction:', error)
    return { success: false, message: 'Error interno del servidor' }
  }
}

// Acción para obtener resumen de entregas por pedido
export async function obtenerResumenEntregasAction(pedidoId: string) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('entregas')
      .select('estado_entrega, estado_pago, total, monto_cobrado')
      .eq('pedido_id', pedidoId)

    if (error) {
      console.error('Error obteniendo resumen:', error)
      return { success: false, message: 'Error al obtener resumen' }
    }

    const resumen = {
      total_entregas: data.length,
      pendientes: data.filter(e => e.estado_entrega === 'pendiente').length,
      entregados: data.filter(e => e.estado_entrega === 'entregado').length,
      fallidos: data.filter(e => e.estado_entrega === 'fallido').length,
      total_a_cobrar: data.reduce((sum, e) => sum + (e.total || 0), 0),
      total_cobrado: data.reduce((sum, e) => sum + (e.monto_cobrado || 0), 0),
      pagados: data.filter(e => e.estado_pago === 'pagado').length,
      fiados: data.filter(e => e.estado_pago === 'fiado').length,
    }

    return { success: true, data: resumen }

  } catch (error) {
    console.error('Error en obtenerResumenEntregasAction:', error)
    return { success: false, message: 'Error interno del servidor' }
  }
}

// Acción para validar cobros de entregas (tesorería)
export async function validarCobrosEntregasAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, message: 'Usuario no autenticado' }
    }

    // Verificar permisos (admin o tesorero)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin'].includes(usuario.rol)) {
      return { success: false, message: 'No tienes permisos para validar cobros' }
    }

    const pedidoId = formData.get('pedido_id') as string
    const observaciones = formData.get('observaciones') as string

    if (!pedidoId) {
      return { success: false, message: 'ID de pedido requerido' }
    }

    // Marcar todas las entregas del pedido como validadas
    const { error } = await supabase
      .from('entregas')
      .update({
        pago_validado: true,
        updated_at: new Date().toISOString(),
      })
      .eq('pedido_id', pedidoId)
      .neq('estado_pago', 'pendiente')

    if (error) {
      console.error('Error validando cobros:', error)
      return { success: false, message: 'Error al validar cobros' }
    }

    // Actualizar pedido con observaciones de validación
    await supabase
      .from('pedidos')
      .update({
        observaciones: observaciones ? `[VALIDACIÓN] ${observaciones}` : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pedidoId)

    revalidatePath('/tesoreria')
    revalidatePath('/almacen/pedidos')

    return {
      success: true,
      message: 'Cobros validados exitosamente'
    }

  } catch (error) {
    console.error('Error en validarCobrosEntregasAction:', error)
    return { success: false, message: 'Error interno del servidor' }
  }
}

// Acción para obtener pedidos con entregas pendientes de validación
export async function obtenerPedidosPendientesValidacionAction() {
  try {
    const supabase = await createClient()

    // Obtener pedidos que tienen entregas con pagos no validados
    const { data, error } = await supabase
      .from('pedidos')
      .select(`
        id,
        numero_pedido,
        total,
        turno,
        fecha_entrega_estimada,
        estado,
        estado_cierre,
        zona:zonas(nombre),
        entregas(
          id,
          cliente_id,
          subtotal,
          recargo,
          total,
          estado_pago,
          metodo_pago,
          monto_cobrado,
          pago_validado,
          referencia_pago,
          cliente:clientes(nombre)
        )
      `)
      .eq('estado', 'entregado')
      .order('fecha_entrega_estimada', { ascending: false })

    if (error) {
      console.error('Error obteniendo pedidos:', error)
      return { success: false, message: 'Error al obtener pedidos' }
    }

    // Filtrar pedidos que tienen entregas con pagos no validados
    const pedidosPendientes = (data || []).filter((pedido: any) => {
      const entregas = pedido.entregas || []
      // Tiene entregas y al menos una tiene pago no validado
      return entregas.length > 0 && entregas.some((e: any) => 
        e.estado_pago !== 'pendiente' && !e.pago_validado
      )
    }).map((pedido: any) => ({
      ...pedido,
      entregas: (pedido.entregas || []).map((e: any) => ({
        ...e,
        cliente_nombre: e.cliente?.nombre
      }))
    }))

    return { success: true, data: pedidosPendientes }

  } catch (error) {
    console.error('Error en obtenerPedidosPendientesValidacionAction:', error)
    return { success: false, message: 'Error interno del servidor' }
  }
}

