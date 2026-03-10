'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { devError } from '@/lib/utils/logger'

// Schemas de validación
const registrarCobroEntregaSchema = z.object({
  entrega_id: z.string().uuid(),
  estado_pago: z.enum(['pagado', 'parcial', 'fiado']),
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

async function obtenerUsuarioAutorizadoEntrega(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { success: false as const, error: 'Usuario no autenticado' }
  }

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!usuario || !['admin', 'repartidor'].includes(usuario.rol)) {
    return { success: false as const, error: 'No tienes permisos para registrar entregas' }
  }

  return { success: true as const, user }
}

async function obtenerEntregaBase(supabase: Awaited<ReturnType<typeof createClient>>, entregaId: string) {
  const { data: entrega, error } = await supabase
    .from('entregas')
    .select(`
      id,
      pedido_id,
      total,
      estado_entrega,
      estado_pago,
      metodo_pago,
      monto_cobrado
    `)
    .eq('id', entregaId)
    .single()

  if (error || !entrega) {
    return { success: false as const, error: 'Entrega no encontrada' }
  }

  return { success: true as const, entrega }
}

// Acción para obtener entregas de un pedido
export async function obtenerEntregasPedidoAction(pedidoId: string) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('fn_obtener_entregas_pedido', {
      p_pedido_id: pedidoId,
    })

    if (error) {
      devError('Error obteniendo entregas:', error)
      return { success: false, error: 'Error al obtener entregas del pedido' }
    }

    return { success: true, data }

  } catch (error) {
    console.error('Error en obtenerEntregasPedidoAction:', error)
    return { success: false, error: 'Error interno del servidor' }
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
      devError('Error obteniendo entrega:', error)
      return { success: false, error: 'Error al obtener entrega' }
    }

    return { success: true, data }

  } catch (error) {
    console.error('Error en obtenerEntregaAction:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Acción para registrar cobro de una entrega
export async function registrarCobroEntregaAction(formData: FormData) {
  try {
    const supabase = await createClient()

    const auth = await obtenerUsuarioAutorizadoEntrega(supabase)
    if (!auth.success) {
      return { success: false, error: auth.error }
    }

    // Parsear y validar datos
    const rawData = Object.fromEntries(formData)
    const data = registrarCobroEntregaSchema.parse({
      entrega_id: rawData.entrega_id,
      estado_pago: rawData.estado_pago,
      metodo_pago: rawData.metodo_pago,
      monto_cobrado: parseFloat(rawData.monto_cobrado as string) || 0,
      numero_transaccion: rawData.numero_transaccion || undefined,
      comprobante_url: rawData.comprobante_url || undefined,
      notas: rawData.notas || undefined,
    })

    const entregaResult = await obtenerEntregaBase(supabase, data.entrega_id)
    if (!entregaResult.success) {
      return { success: false, error: entregaResult.error }
    }

    const entrega = entregaResult.entrega
    const montoTotal = Number(entrega.total || 0)
    const montoCobrado = data.estado_pago === 'fiado' ? 0 : data.monto_cobrado
    const montoCuentaCorriente = data.estado_pago === 'fiado'
      ? montoTotal
      : data.estado_pago === 'parcial'
        ? Math.max(montoTotal - montoCobrado, 0)
        : 0

    const { data: result, error } = await supabase.rpc('fn_registrar_entrega_completa', {
      p_pedido_id: entrega.pedido_id,
      p_repartidor_id: auth.user.id,
      p_entrega_id: entrega.id,
      p_estado_entrega: entrega.estado_entrega || 'pendiente',
      p_metodo_pago: data.estado_pago === 'fiado' ? 'cuenta_corriente' : data.metodo_pago,
      p_monto_cobrado: montoCobrado,
      p_monto_cuenta_corriente: montoCuentaCorriente,
      p_es_cuenta_corriente: data.estado_pago === 'fiado',
      p_es_pago_parcial: data.estado_pago === 'parcial',
      p_numero_transaccion: data.numero_transaccion || null,
      p_comprobante_url: data.comprobante_url || null,
      p_notas_entrega: data.notas || null,
    })

    if (error) {
      devError('Error registrando cobro:', error)
      return { success: false, error: 'Error al registrar cobro' }
    }

    if (!result.success) {
      return { success: false, error: result.error || 'Error en el registro del cobro' }
    }

    revalidatePath('/repartidor')
    revalidatePath('/reparto/rutas')
    revalidatePath('/almacen/pedidos')
    revalidatePath('/tesoreria')
    revalidatePath('/tesoreria/validar-rutas')

    return {
      success: true,
      message: data.estado_pago === 'fiado'
        ? 'Cobro registrado como cuenta corriente'
        : `Cobro registrado: $${montoCobrado} - ${data.metodo_pago}`,
      data: result
    }

  } catch (error) {
    console.error('Error en registrarCobroEntregaAction:', error)
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Datos inválidos: ' + error.issues[0].message }
    }
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Acción para marcar entrega como completada
export async function marcarEntregaCompletadaAction(formData: FormData) {
  try {
    const supabase = await createClient()

    const auth = await obtenerUsuarioAutorizadoEntrega(supabase)
    if (!auth.success) {
      return { success: false, error: auth.error }
    }

    const rawData = Object.fromEntries(formData)
    const data = marcarEntregaCompletadaSchema.parse({
      entrega_id: rawData.entrega_id,
      firma_url: rawData.firma_url || undefined,
      notas: rawData.notas || undefined,
    })

    const entregaResult = await obtenerEntregaBase(supabase, data.entrega_id)
    if (!entregaResult.success) {
      return { success: false, error: entregaResult.error }
    }

    const entrega = entregaResult.entrega
    const montoCobrado = Number(entrega.monto_cobrado || 0)
    const montoTotal = Number(entrega.total || 0)
    const esCuentaCorriente = entrega.estado_pago === 'cuenta_corriente'
    const esPagoParcial = entrega.estado_pago === 'parcial'

    const { data: result, error } = await supabase.rpc('fn_registrar_entrega_completa', {
      p_pedido_id: entrega.pedido_id,
      p_repartidor_id: auth.user.id,
      p_entrega_id: entrega.id,
      p_estado_entrega: 'entregado',
      p_metodo_pago: esCuentaCorriente ? 'cuenta_corriente' : entrega.metodo_pago,
      p_monto_cobrado: esCuentaCorriente ? 0 : montoCobrado,
      p_monto_cuenta_corriente: esCuentaCorriente
        ? montoTotal
        : esPagoParcial
          ? Math.max(montoTotal - montoCobrado, 0)
          : 0,
      p_es_cuenta_corriente: esCuentaCorriente,
      p_es_pago_parcial: esPagoParcial,
      p_firma_url: data.firma_url || null,
      p_notas_entrega: data.notas || null,
    })

    if (error) {
      devError('Error marcando entrega:', error)
      return { success: false, error: 'Error al marcar entrega como completada' }
    }

    if (!result.success) {
      return { success: false, error: result.error || 'Error al completar entrega' }
    }

    revalidatePath('/repartidor')
    revalidatePath('/reparto/rutas')
    revalidatePath('/almacen/pedidos')
    revalidatePath('/tesoreria/validar-rutas')

    return {
      success: true,
      message: 'Entrega completada exitosamente',
      data: result
    }

  } catch (error) {
    console.error('Error en marcarEntregaCompletadaAction:', error)
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Datos inválidos: ' + error.issues[0].message }
    }
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Acción para marcar entrega como "en camino"
export async function marcarEntregaEnCaminoAction(entregaId: string) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    if (!entregaId) {
      return { success: false, error: 'ID de entrega requerido' }
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
      devError('Error marcando entrega en camino:', error)
      return { success: false, error: 'Error al marcar entrega en camino' }
    }

    revalidatePath('/repartidor')
    revalidatePath('/almacen/pedidos')

    return {
      success: true,
      message: 'Entrega marcada como en camino'
    }

  } catch (error) {
    console.error('Error en marcarEntregaEnCaminoAction:', error)
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Acción para marcar entrega como fallida
export async function marcarEntregaFallidaAction(formData: FormData) {
  try {
    const supabase = await createClient()

    const auth = await obtenerUsuarioAutorizadoEntrega(supabase)
    if (!auth.success) {
      return { success: false, error: auth.error }
    }

    const entregaId = formData.get('entrega_id') as string
    const notas = formData.get('notas') as string

    if (!entregaId) {
      return { success: false, error: 'ID de entrega requerido' }
    }

    const entregaResult = await obtenerEntregaBase(supabase, entregaId)
    if (!entregaResult.success) {
      return { success: false, error: entregaResult.error }
    }

    const entrega = entregaResult.entrega

    const { data: result, error } = await supabase.rpc('fn_registrar_entrega_completa', {
      p_pedido_id: entrega.pedido_id,
      p_repartidor_id: auth.user.id,
      p_entrega_id: entrega.id,
      p_estado_entrega: 'rechazado',
      p_motivo_rechazo: notas || 'Entrega fallida',
      p_notas_entrega: notas || 'Entrega fallida',
    })

    if (error) {
      devError('Error marcando entrega fallida:', error)
      return { success: false, error: 'Error al marcar entrega como fallida' }
    }

    if (!result?.success) {
      return { success: false, error: result?.error || 'Error al marcar entrega como fallida' }
    }

    revalidatePath('/repartidor')
    revalidatePath('/reparto/rutas')
    revalidatePath('/almacen/pedidos')

    return {
      success: true,
      message: 'Entrega marcada como fallida'
    }

  } catch (error) {
    console.error('Error en marcarEntregaFallidaAction:', error)
    return { success: false, error: 'Error interno del servidor' }
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
      devError('Error obteniendo resumen:', error)
      return { success: false, error: 'Error al obtener resumen' }
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
    return { success: false, error: 'Error interno del servidor' }
  }
}

// Acción para validar cobros de entregas (tesorería)
export async function validarCobrosEntregasAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Verificar permisos (admin o tesorero)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin'].includes(usuario.rol)) {
      return { success: false, error: 'No tienes permisos para validar cobros' }
    }

    const pedidoId = formData.get('pedido_id') as string
    const observaciones = formData.get('observaciones') as string

    if (!pedidoId) {
      return { success: false, error: 'ID de pedido requerido' }
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
      devError('Error validando cobros:', error)
      return { success: false, error: 'Error al validar cobros' }
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
    return { success: false, error: 'Error interno del servidor' }
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
      devError('Error obteniendo pedidos:', error)
      return { success: false, error: 'Error al obtener pedidos' }
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
    return { success: false, error: 'Error interno del servidor' }
  }
}

