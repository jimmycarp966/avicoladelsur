'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createNotification } from './index'
import { generateRutaOptimizada } from '@/lib/services/ruta-optimizer'
import { confirmarPresupuestosAgrupadosSchema } from '@/lib/schemas/presupuestos.schema'
import { getNowArgentina } from '@/lib/utils'

// Schemas de validación
const crearPresupuestoSchema = z.object({
  cliente_id: z.string().uuid(),
  zona_id: z.string().uuid().optional(),
  fecha_entrega_estimada: z.string().optional(),
  observaciones: z.string().optional(),
  lista_precio_id: z.string().uuid().optional(),
  items: z.array(z.object({
    producto_id: z.string().uuid(),
    cantidad_solicitada: z.number().positive(),
    precio_unit_est: z.number().positive(),
  })),
})

const reservarStockSchema = z.object({
  presupuesto_id: z.string().uuid(),
})

const confirmarPresupuestoSchema = z.object({
  presupuesto_id: z.string().uuid(),
  caja_id: z.string().uuid().optional(),
})

const actualizarPesoItemSchema = z.object({
  presupuesto_item_id: z.string().uuid(),
  peso_final: z.number().positive(),
})

// Acción para crear presupuesto
export async function crearPresupuestoAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, message: 'Usuario no autenticado' }
    }

    // Verificar permisos (vendedor o admin)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'vendedor'].includes(usuario.rol)) {
      return { success: false, message: 'No tienes permisos para crear presupuestos' }
    }

    // Parsear y validar datos
    const rawData = Object.fromEntries(formData)
    const data = crearPresupuestoSchema.parse({
      cliente_id: rawData.cliente_id,
      zona_id: rawData.zona_id || undefined,
      fecha_entrega_estimada: rawData.fecha_entrega_estimada || undefined,
      observaciones: rawData.observaciones || undefined,
      lista_precio_id: rawData.lista_precio_id || undefined,
      items: JSON.parse(rawData.items as string),
    })

    // Preparar items para RPC
    const itemsJson = data.items.map(item => ({
      producto_id: item.producto_id,
      cantidad: item.cantidad_solicitada,
      precio_unitario: item.precio_unit_est,
    }))

    // Llamar RPC para crear presupuesto (ahora con asignación automática de turno)
    const { data: result, error } = await supabase.rpc('fn_crear_presupuesto_desde_bot', {
      p_cliente_id: data.cliente_id,
      p_items: itemsJson,
      p_observaciones: data.observaciones,
      p_zona_id: data.zona_id,
      p_fecha_entrega_estimada: data.fecha_entrega_estimada || null,
    })

    if (error) {
      console.error('Error creando presupuesto:', error)
      return { success: false, message: 'Error al crear presupuesto' }
    }

    if (!result.success) {
      return { success: false, message: result.error || 'Error en la creación del presupuesto' }
    }

    // Asignar usuario vendedor y lista de precios
    const updateData: { usuario_vendedor: string; lista_precio_id?: string } = {
      usuario_vendedor: user.id,
    }
    if (data.lista_precio_id) {
      updateData.lista_precio_id = data.lista_precio_id
    }
    await supabase
      .from('presupuestos')
      .update(updateData)
      .eq('id', result.presupuesto_id)

    // Crear notificación para admin
    await createNotification({
      titulo: 'Nuevo presupuesto creado',
      mensaje: `Presupuesto ${result.numero_presupuesto} creado por ${usuario.rol}`,
      tipo: 'info',
      usuario_id: null, // Para todos los admins
      metadata: { presupuesto_id: result.presupuesto_id }
    })

    revalidatePath('/ventas/presupuestos')

    return {
      success: true,
      message: `Presupuesto ${result.numero_presupuesto} creado exitosamente`,
      data: result
    }

  } catch (error) {
    console.error('Error en crearPresupuestoAction:', error)
    if (error instanceof z.ZodError) {
      return { success: false, message: 'Datos inválidos: ' + error.issues[0].message }
    }
    return { success: false, message: 'Error interno del servidor' }
  }
}

// Acción para reservar stock de un presupuesto
export async function reservarStockAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, message: 'Usuario no autenticado' }
    }

    // Parsear y validar datos
    const rawData = Object.fromEntries(formData)
    const data = reservarStockSchema.parse({
      presupuesto_id: rawData.presupuesto_id,
    })

    // Llamar RPC para reservar stock
    const { data: result, error } = await supabase.rpc('fn_reservar_stock_por_presupuesto', {
      p_presupuesto_id: data.presupuesto_id,
    })

    if (error) {
      console.error('Error reservando stock:', error)
      return { success: false, message: 'Error al reservar stock' }
    }

    if (!result.success) {
      return { success: false, message: result.error || 'Error en la reserva de stock' }
    }

    // Actualizar estado del presupuesto
    await supabase
      .from('presupuestos')
      .update({
        estado: result.errores.length === 0 ? 'pendiente' : 'pendiente',
        updated_at: getNowArgentina().toISOString()
      })
      .eq('id', data.presupuesto_id)

    revalidatePath('/ventas/presupuestos')
    revalidatePath(`/ventas/presupuestos/${data.presupuesto_id}`)

    return {
      success: true,
      message: result.errores.length === 0
        ? 'Stock reservado exitosamente'
        : 'Stock reservado parcialmente. Algunos items sin stock suficiente.',
      data: result
    }

  } catch (error) {
    console.error('Error en reservarStockAction:', error)
    if (error instanceof z.ZodError) {
      return { success: false, message: 'Datos inválidos: ' + error.issues[0].message }
    }
    return { success: false, message: 'Error interno del servidor' }
  }
}

// Acción para confirmar presupuesto (convertir a pedido)
export async function confirmarPresupuestoAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, message: 'Usuario no autenticado' }
    }

    // Verificar permisos (admin, vendedor o almacenista)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'vendedor', 'almacenista'].includes(usuario.rol)) {
      return { success: false, message: 'No tienes permisos para confirmar presupuestos' }
    }

    // Parsear y validar datos
    const rawData = Object.fromEntries(formData)
    const data = confirmarPresupuestoSchema.parse({
      presupuesto_id: rawData.presupuesto_id,
      caja_id: rawData.caja_id || undefined,
    })

    // Llamar RPC para convertir presupuesto a pedido
    const { data: result, error } = await supabase.rpc('fn_convertir_presupuesto_a_pedido', {
      p_presupuesto_id: data.presupuesto_id,
      p_user_id: user.id,
      p_caja_id: data.caja_id,
    })

    if (error) {
      console.error('Error convirtiendo presupuesto:', error)
      return { success: false, message: 'Error al convertir presupuesto a pedido' }
    }

    if (!result.success) {
      return { success: false, message: result.error || 'Error en la conversión del presupuesto' }
    }

    // Crear factura interna desde el pedido generado
    if (result.pedido_id) {
      try {
        const { data: facturaResult, error: facturaError } = await supabase.rpc(
          'fn_crear_factura_desde_pedido',
          {
            p_pedido_id: result.pedido_id,
            p_user_id: user.id,
          }
        )

        if (facturaError) {
          console.error(
            'Error creando factura desde pedido (presupuesto individual):',
            facturaError
          )
        } else if (!facturaResult?.success) {
          console.error(
            'RPC fn_crear_factura_desde_pedido devolvió error:',
            facturaResult?.error
          )
        }
      } catch (factError) {
        console.error('Excepción creando factura desde pedido:', factError)
      }
    }

    if (result.ruta_id) {
      try {
        await generateRutaOptimizada({
          supabase,
          rutaId: result.ruta_id,
          usarGoogle: true,
        })
      } catch (optError) {
        console.error('No se pudo optimizar la ruta planificada automáticamente:', optError)
      }
    }

    // Crear notificación
    await createNotification({
      titulo: 'Presupuesto convertido a pedido',
      mensaje: `Pedido ${result.numero_pedido} creado desde presupuesto`,
      tipo: 'success',
      usuario_id: null,
      metadata: {
        pedido_id: result.pedido_id,
        presupuesto_id: data.presupuesto_id
      }
    })

    revalidatePath('/ventas/presupuestos')
    revalidatePath('/almacen/pedidos')
    revalidatePath('/tesoreria/cajas')
    revalidatePath('/almacen/presupuestos-dia')

    return {
      success: true,
      message: `Presupuesto convertido a pedido ${result.numero_pedido} exitosamente`,
      data: result
    }

  } catch (error) {
    console.error('Error en confirmarPresupuestoAction:', error)
    if (error instanceof z.ZodError) {
      return { success: false, message: 'Datos inválidos: ' + error.issues[0].message }
    }
    return { success: false, message: 'Error interno del servidor' }
  }
}

// Acción para convertir múltiples presupuestos agrupados en un solo pedido
export async function confirmarPresupuestosAgrupadosAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, message: 'Usuario no autenticado' }
    }

    // Verificar permisos (admin, vendedor o almacenista)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'vendedor', 'almacenista'].includes(usuario.rol)) {
      return { success: false, message: 'No tienes permisos para confirmar presupuestos' }
    }

    // Parsear y validar datos
    const rawData = Object.fromEntries(formData)
    const presupuestosIds = rawData.presupuestos_ids
      ? (typeof rawData.presupuestos_ids === 'string' 
          ? JSON.parse(rawData.presupuestos_ids) 
          : rawData.presupuestos_ids)
      : []

    const data = confirmarPresupuestosAgrupadosSchema.parse({
      presupuestos_ids: presupuestosIds,
      caja_id: rawData.caja_id || undefined,
    })

    // Llamar RPC para convertir presupuestos agrupados a pedido
    const { data: result, error } = await supabase.rpc('fn_convertir_presupuestos_agrupados_a_pedido', {
      p_presupuestos_ids: data.presupuestos_ids,
      p_user_id: user.id,
      p_caja_id: data.caja_id,
    })

    if (error) {
      console.error('Error convirtiendo presupuestos agrupados:', error)
      return { success: false, message: 'Error al convertir presupuestos a pedido' }
    }

    if (!result.success) {
      return { success: false, message: result.error || 'Error en la conversión de los presupuestos' }
    }

    // Crear factura interna desde el pedido consolidado
    if (result.pedido_id) {
      try {
        const { data: facturaResult, error: facturaError } = await supabase.rpc(
          'fn_crear_factura_desde_pedido',
          {
            p_pedido_id: result.pedido_id,
            p_user_id: user.id,
          }
        )

        if (facturaError) {
          console.error(
            'Error creando factura desde pedido (presupuestos agrupados):',
            facturaError
          )
        } else if (!facturaResult?.success) {
          console.error(
            'RPC fn_crear_factura_desde_pedido devolvió error:',
            facturaResult?.error
          )
        }
      } catch (factError) {
        console.error('Excepción creando factura desde pedido (agrupados):', factError)
      }
    }

    if (result.ruta_id) {
      try {
        await generateRutaOptimizada({
          supabase,
          rutaId: result.ruta_id,
          usarGoogle: true,
        })
      } catch (optError) {
        console.error('No se pudo optimizar la ruta planificada automáticamente:', optError)
      }
    }

    // Crear notificación
    await createNotification({
      titulo: 'Presupuestos convertidos a pedido',
      mensaje: `Pedido ${result.numero_pedido} creado desde ${data.presupuestos_ids.length} presupuesto(s)`,
      tipo: 'success',
      usuario_id: null,
      metadata: {
        pedido_id: result.pedido_id,
        presupuestos_ids: data.presupuestos_ids
      }
    })

    revalidatePath('/ventas/presupuestos')
    revalidatePath('/almacen/pedidos')
    revalidatePath('/tesoreria/cajas')
    revalidatePath('/almacen/presupuestos-dia')

    return {
      success: true,
      message: `${data.presupuestos_ids.length} presupuesto(s) convertido(s) a pedido ${result.numero_pedido} exitosamente`,
      data: result
    }

  } catch (error) {
    console.error('Error en confirmarPresupuestosAgrupadosAction:', error)
    if (error instanceof z.ZodError) {
      return { success: false, message: 'Datos inválidos: ' + error.issues[0].message }
    }
    return { success: false, message: 'Error interno del servidor' }
  }
}

// Acción para actualizar peso de item de presupuesto
export async function actualizarPesoItemAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, message: 'Usuario no autenticado' }
    }

    // Verificar permisos (almacenista o admin)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'almacenista'].includes(usuario.rol)) {
      return { success: false, message: 'No tienes permisos para actualizar pesos' }
    }

    // Parsear y validar datos
    const rawData = Object.fromEntries(formData)
    const data = actualizarPesoItemSchema.parse({
      presupuesto_item_id: rawData.presupuesto_item_id,
      peso_final: parseFloat(rawData.peso_final as string),
    })

    // Llamar RPC para actualizar peso
    const { data: result, error } = await supabase.rpc('fn_actualizar_peso_item_presupuesto', {
      p_presupuesto_item_id: data.presupuesto_item_id,
      p_peso_final: data.peso_final,
    })

    if (error) {
      console.error('Error actualizando peso:', error)
      return { success: false, message: 'Error al actualizar peso del item' }
    }

    if (!result.success) {
      return { success: false, message: result.error || 'Error en la actualización del peso' }
    }

    revalidatePath(`/almacen/presupuesto/*`)

    return {
      success: true,
      message: 'Peso actualizado exitosamente',
      data: result
    }

  } catch (error) {
    console.error('Error en actualizarPesoItemAction:', error)
    if (error instanceof z.ZodError) {
      return { success: false, message: 'Datos inválidos: ' + error.issues[0].message }
    }
    return { success: false, message: 'Error interno del servidor' }
  }
}

// Acción para obtener lista de presupuestos
export async function obtenerPresupuestosAction(filtros?: {
  estado?: string
  zona_id?: string
  fecha_desde?: string
  fecha_hasta?: string
}) {
  try {
    const supabase = await createClient()

    let query = supabase
      .from('presupuestos')
      .select(`
        *,
        cliente:clientes!presupuestos_cliente_id_fkey(nombre, telefono, zona_entrega),
        zona:zonas!presupuestos_zona_id_fkey(nombre),
        usuario_vendedor_obj:usuarios!presupuestos_usuario_vendedor_fkey(nombre),
        items:presupuesto_items(
          id,
          producto:productos!presupuesto_items_producto_id_fkey(codigo, nombre),
          cantidad_solicitada,
          cantidad_reservada,
          precio_unit_est,
          precio_unit_final,
          pesable,
          peso_final,
          subtotal_est,
          subtotal_final
        )
      `)
      .order('created_at', { ascending: false })

    // Aplicar filtros
    if (filtros?.estado) {
      query = query.eq('estado', filtros.estado)
    }
    if (filtros?.zona_id) {
      query = query.eq('zona_id', filtros.zona_id)
    }
    if (filtros?.fecha_desde) {
      query = query.gte('fecha_entrega_estimada', filtros.fecha_desde)
    }
    if (filtros?.fecha_hasta) {
      query = query.lte('fecha_entrega_estimada', filtros.fecha_hasta)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error obteniendo presupuestos:', error)
      // Mostrar el error real para debugging
      return { 
        success: false, 
        message: `Error al obtener presupuestos: ${error.message || error.code || 'Error desconocido'}`,
        error: error
      }
    }

    return { success: true, data }

  } catch (error) {
    console.error('Error en obtenerPresupuestosAction:', error)
    return { success: false, message: 'Error interno del servidor' }
  }
}

// Acción para obtener detalle de un presupuesto
export async function obtenerPresupuestoAction(presupuestoId: string) {
  try {
    const supabase = await createClient()

    // OPTIMIZADO: Una sola query con todos los joins en lugar de 7 queries separadas
    const { data: presupuestoData, error: presupuestoError } = await supabase
      .from('presupuestos')
      .select(`
        *,
        cliente:clientes(*),
        zona:zonas(nombre),
        usuario_vendedor_obj:usuarios!presupuestos_usuario_vendedor_fkey(nombre),
        usuario_almacen_obj:usuarios!presupuestos_usuario_almacen_fkey(nombre),
        usuario_repartidor_obj:usuarios!presupuestos_usuario_repartidor_fkey(nombre),
        pedido_convertido:pedidos(numero_pedido),
        items:presupuesto_items(
          *,
          producto:productos(*),
          lote_reservado:lotes(*)
        )
      `)
      .eq('id', presupuestoId)
      .single()

    if (presupuestoError) {
      // Si el error es "no encontrado", dar mensaje más claro
      if (presupuestoError.code === 'PGRST116' || presupuestoError.message?.includes('No rows')) {
        return { 
          success: false, 
          message: `Presupuesto con ID ${presupuestoId} no encontrado en la base de datos`,
          error: presupuestoError
        }
      }
      return { 
        success: false, 
        message: `Error al obtener presupuesto: ${presupuestoError.message || presupuestoError.code || 'Error desconocido'}`,
        error: presupuestoError
      }
    }

    if (!presupuestoData) {
      return { 
        success: false, 
        message: `Presupuesto con ID ${presupuestoId} no encontrado`
      }
    }

    // Obtener reservas de stock (query separada porque no hay relación directa)
    const { data: reservasData } = await supabase
      .from('stock_reservations')
      .select('cantidad, expires_at, estado, producto_id')
      .eq('presupuesto_id', presupuestoId)

    // Construir objeto de respuesta con reservas agrupadas por producto
    const reservasPorProducto = (reservasData || []).reduce((acc: any, r: any) => {
      if (!acc[r.producto_id]) acc[r.producto_id] = []
      acc[r.producto_id].push(r)
      return acc
    }, {})

    const data = {
      ...presupuestoData,
      items: (presupuestoData.items || []).map((item: any) => ({
        ...item,
        reservas: reservasPorProducto[item.producto_id] || []
      }))
    }

    return { success: true, data }

  } catch (error) {
    console.error('Error en obtenerPresupuestoAction:', error)
    return { success: false, message: 'Error interno del servidor' }
  }
}

// Acción para recalcular presupuesto (actualizar precios y totales)
export async function recalcularPresupuestoAction(presupuestoId: string) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, message: 'Usuario no autenticado' }
    }

    // Obtener presupuesto con items
    const { data: presupuesto, error: presupuestoError } = await supabase
      .from('presupuestos')
      .select(`
        *,
        items:presupuesto_items(
          id,
          producto_id,
          cantidad_solicitada,
          producto:productos(precio_venta)
        )
      `)
      .eq('id', presupuestoId)
      .single()

    if (presupuestoError || !presupuesto) {
      return { success: false, message: 'Presupuesto no encontrado' }
    }

    // Solo se puede recalcular si está pendiente
    if (presupuesto.estado !== 'pendiente') {
      return { success: false, message: 'Solo se pueden recalcular presupuestos pendientes' }
    }

    let totalEstimado = 0

    // Recalcular cada item con precios actuales
    for (const item of presupuesto.items || []) {
      let precioActual = item.producto?.precio_venta || 0

      // Si el presupuesto tiene lista de precios, usar precio de la lista
      if (presupuesto.lista_precio_id) {
        const { data: precioLista } = await supabase.rpc('fn_obtener_precio_producto', {
          p_lista_precio_id: presupuesto.lista_precio_id,
          p_producto_id: item.producto_id,
        })
        if (precioLista && precioLista > 0) {
          precioActual = precioLista
        }
      }

      const subtotalEst = item.cantidad_solicitada * precioActual

      // Actualizar item
      await supabase
        .from('presupuesto_items')
        .update({
          precio_unit_est: precioActual,
          subtotal_est: subtotalEst,
          updated_at: getNowArgentina().toISOString(),
        })
        .eq('id', item.id)

      totalEstimado += subtotalEst
    }

    // Actualizar total del presupuesto
    const { error: updateError } = await supabase
      .from('presupuestos')
      .update({
        total_estimado: totalEstimado,
        updated_at: getNowArgentina().toISOString(),
      })
      .eq('id', presupuestoId)

    if (updateError) {
      console.error('Error actualizando presupuesto:', updateError)
      return { success: false, message: 'Error al actualizar presupuesto' }
    }

    revalidatePath('/ventas/presupuestos')
    revalidatePath(`/ventas/presupuestos/${presupuestoId}`)

    return {
      success: true,
      message: 'Presupuesto recalculado exitosamente',
      data: { total_estimado: totalEstimado }
    }

  } catch (error) {
    console.error('Error en recalcularPresupuestoAction:', error)
    return { success: false, message: 'Error interno del servidor' }
  }
}

// Acción para actualizar presupuesto
export async function actualizarPresupuestoAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, message: 'Usuario no autenticado' }
    }

    const presupuestoId = formData.get('presupuesto_id') as string
    const observaciones = formData.get('observaciones') as string
    const fecha_entrega_estimada = formData.get('fecha_entrega_estimada') as string

    if (!presupuestoId) {
      return { success: false, message: 'ID de presupuesto requerido' }
    }

    // Verificar que el presupuesto existe y está en estado pendiente
    const { data: presupuesto, error: presupuestoError } = await supabase
      .from('presupuestos')
      .select('estado')
      .eq('id', presupuestoId)
      .single()

    if (presupuestoError || !presupuesto) {
      return { success: false, message: 'Presupuesto no encontrado' }
    }

    if (presupuesto.estado !== 'pendiente') {
      return { success: false, message: 'Solo se pueden editar presupuestos pendientes' }
    }

    // Actualizar presupuesto
    const updateData: any = {
          updated_at: getNowArgentina().toISOString(),
    }

    if (observaciones !== null) {
      updateData.observaciones = observaciones
    }

    if (fecha_entrega_estimada) {
      updateData.fecha_entrega_estimada = fecha_entrega_estimada
    }

    const { error: updateError } = await supabase
      .from('presupuestos')
      .update(updateData)
      .eq('id', presupuestoId)

    if (updateError) {
      console.error('Error actualizando presupuesto:', updateError)
      return { success: false, message: 'Error al actualizar presupuesto' }
    }

    revalidatePath('/ventas/presupuestos')
    revalidatePath(`/ventas/presupuestos/${presupuestoId}`)

    return {
      success: true,
      message: 'Presupuesto actualizado exitosamente',
      data: { presupuesto_id: presupuestoId }
    }

  } catch (error) {
    console.error('Error en actualizarPresupuestoAction:', error)
    return { success: false, message: 'Error interno del servidor' }
  }
}

// Acción para enviar presupuesto a almacén
export async function enviarPresupuestoAlmacenAction(presupuestoId: string) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, message: 'Usuario no autenticado' }
    }

    // Verificar que el presupuesto tenga turno y zona antes de enviar
    const { data: presupuesto, error: presupuestoError } = await supabase
      .from('presupuestos')
      .select('turno, zona_id, estado')
      .eq('id', presupuestoId)
      .single()

    if (presupuestoError || !presupuesto) {
      return { success: false, message: 'Presupuesto no encontrado' }
    }

    if (presupuesto.estado !== 'pendiente') {
      return { success: false, message: 'Solo se pueden enviar presupuestos pendientes a almacén' }
    }

    if (!presupuesto.zona_id) {
      return { success: false, message: 'El presupuesto debe tener una zona asignada antes de enviar a almacén' }
    }

    // Actualizar estado y usuario almacén
    const { error } = await supabase
      .from('presupuestos')
      .update({
        estado: 'en_almacen',
        usuario_almacen: user.id,
        updated_at: getNowArgentina().toISOString()
      })
      .eq('id', presupuestoId)
      .eq('estado', 'pendiente')

    if (error) {
      console.error('Error enviando presupuesto a almacén:', error)
      return { success: false, message: 'Error al enviar presupuesto a almacén' }
    }

    // Crear notificación para almacenistas
    await createNotification({
      titulo: 'Presupuesto enviado a almacén',
      mensaje: `Presupuesto ${presupuestoId} requiere pesaje`,
      tipo: 'warning',
      usuario_id: null, // Para almacenistas
      metadata: { presupuesto_id: presupuestoId }
    })

    revalidatePath('/ventas/presupuestos')
    revalidatePath(`/ventas/presupuestos/${presupuestoId}`)
    revalidatePath('/almacen/presupuestos-dia')

    return { success: true, message: 'Presupuesto enviado a almacén exitosamente' }

  } catch (error) {
    console.error('Error en enviarPresupuestoAlmacenAction:', error)
    return { success: false, message: 'Error interno del servidor' }
  }
}

// Acción para asignar turno y zona a presupuesto
export async function asignarTurnoZonaPresupuestoAction(formData: FormData) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, message: 'Usuario no autenticado' }
    }

    // Verificar permisos (vendedor o admin)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'vendedor'].includes(usuario.rol)) {
      return { success: false, message: 'No tienes permisos para asignar turno y zona' }
    }

    // Parsear datos
    const presupuesto_id = formData.get('presupuesto_id') as string
    const turno = formData.get('turno') as string
    const zona_id = formData.get('zona_id') as string
    const metodos_pago = formData.get('metodos_pago') ? JSON.parse(formData.get('metodos_pago') as string) : null
    const recargo_total = formData.get('recargo_total') ? parseFloat(formData.get('recargo_total') as string) : 0

    if (!presupuesto_id || !turno || !zona_id) {
      return { success: false, message: 'Faltan datos requeridos: presupuesto_id, turno, zona_id' }
    }

    if (!['mañana', 'tarde'].includes(turno)) {
      return { success: false, message: 'Turno inválido. Debe ser "mañana" o "tarde"' }
    }

    // Llamar RPC para asignar turno y zona
    const { data: result, error } = await supabase.rpc('fn_asignar_turno_zona_presupuesto', {
      p_presupuesto_id: presupuesto_id,
      p_turno: turno,
      p_zona_id: zona_id,
      p_metodos_pago: metodos_pago,
      p_recargo_total: recargo_total,
    })

    if (error) {
      console.error('Error asignando turno y zona:', error)
      return { success: false, message: 'Error al asignar turno y zona' }
    }

    if (!result.success) {
      return { success: false, message: result.error || 'Error en la asignación' }
    }

    revalidatePath('/ventas/presupuestos')
    revalidatePath(`/ventas/presupuestos/${presupuesto_id}`)

    return {
      success: true,
      message: 'Turno y zona asignados exitosamente',
      data: result
    }

  } catch (error) {
    console.error('Error en asignarTurnoZonaPresupuestoAction:', error)
    return { success: false, message: 'Error interno del servidor' }
  }
}

// Acción para convertir presupuesto a cotización
export async function convertirPresupuestoACotizacionAction(presupuestoId: string) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, message: 'Usuario no autenticado' }
    }

    // Verificar permisos (vendedor o admin)
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (!usuario || !['admin', 'vendedor'].includes(usuario.rol)) {
      return { success: false, message: 'No tienes permisos para convertir presupuestos' }
    }

    // Llamar RPC para convertir a cotización
    const { data: result, error } = await supabase.rpc('fn_convertir_presupuesto_a_cotizacion', {
      p_presupuesto_id: presupuestoId,
    })

    if (error) {
      console.error('Error convirtiendo presupuesto a cotización:', error)
      return { success: false, message: 'Error al convertir presupuesto a cotización' }
    }

    if (!result.success) {
      return { success: false, message: result.error || 'Error en la conversión' }
    }

    revalidatePath('/ventas/presupuestos')
    revalidatePath(`/ventas/presupuestos/${presupuestoId}`)

    return {
      success: true,
      message: `Presupuesto convertido a cotización ${result.numero_cotizacion} exitosamente`,
      data: result
    }

  } catch (error) {
    console.error('Error en convertirPresupuestoACotizacionAction:', error)
    return { success: false, message: 'Error interno del servidor' }
  }
}

// Acción para recalcular recargos por métodos de pago
export async function recalcularRecargosAction(presupuestoId: string) {
  try {
    const supabase = await createClient()

    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, message: 'Usuario no autenticado' }
    }

    // Obtener presupuesto con métodos de pago
    const { data: presupuesto, error: presupuestoError } = await supabase
      .from('presupuestos')
      .select('metodos_pago, total_estimado, recargo_total')
      .eq('id', presupuestoId)
      .single()

    if (presupuestoError || !presupuesto) {
      return { success: false, message: 'Presupuesto no encontrado' }
    }

    // Calcular recargos según métodos de pago
    let recargoTotal = 0
    const metodosPago = presupuesto.metodos_pago as any

    if (metodosPago && Array.isArray(metodosPago)) {
      for (const metodo of metodosPago) {
        if (metodo.recargo) {
          recargoTotal += metodo.recargo
        }
      }
    }

    // Actualizar recargo total
    const { error: updateError } = await supabase
      .from('presupuestos')
      .update({
        recargo_total: recargoTotal,
        updated_at: getNowArgentina().toISOString()
      })
      .eq('id', presupuestoId)

    if (updateError) {
      console.error('Error actualizando recargos:', updateError)
      return { success: false, message: 'Error al recalcular recargos' }
    }

    revalidatePath('/ventas/presupuestos')
    revalidatePath(`/ventas/presupuestos/${presupuestoId}`)

    return {
      success: true,
      message: 'Recargos recalculados exitosamente',
      data: { recargo_total: recargoTotal }
    }

  } catch (error) {
    console.error('Error en recalcularRecargosAction:', error)
    return { success: false, message: 'Error interno del servidor' }
  }
}
