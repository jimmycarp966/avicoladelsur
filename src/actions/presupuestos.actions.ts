'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createNotification } from './index'

// Schemas de validación
const crearPresupuestoSchema = z.object({
  cliente_id: z.string().uuid(),
  zona_id: z.string().uuid().optional(),
  fecha_entrega_estimada: z.string().optional(),
  observaciones: z.string().optional(),
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
      items: JSON.parse(rawData.items as string),
    })

    // Preparar items para RPC
    const itemsJson = data.items.map(item => ({
      producto_id: item.producto_id,
      cantidad: item.cantidad_solicitada,
      precio_unitario: item.precio_unit_est,
    }))

    // Llamar RPC para crear presupuesto
    const { data: result, error } = await supabase.rpc('fn_crear_presupuesto_desde_bot', {
      p_cliente_id: data.cliente_id,
      p_items: itemsJson,
      p_observaciones: data.observaciones,
      p_zona_id: data.zona_id,
    })

    if (error) {
      console.error('Error creando presupuesto:', error)
      return { success: false, message: 'Error al crear presupuesto' }
    }

    if (!result.success) {
      return { success: false, message: result.error || 'Error en la creación del presupuesto' }
    }

    // Asignar usuario vendedor
    await supabase
      .from('presupuestos')
      .update({ usuario_vendedor: user.id })
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
        updated_at: new Date().toISOString()
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
    revalidatePath('/ventas/pedidos')
    revalidatePath('/tesoreria/cajas')

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
        cliente:clientes(nombre, telefono, zona_entrega),
        zona:zonas(nombre),
        usuario_vendedor:usuarios(nombre),
        items:presupuesto_items(
          id,
          producto:productos(codigo, nombre),
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
      return { success: false, message: 'Error al obtener presupuestos' }
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

    const { data, error } = await supabase
      .from('presupuestos')
      .select(`
        *,
        cliente:clientes(*),
        zona:zonas(nombre),
        usuario_vendedor:usuarios(nombre),
        usuario_almacen:usuarios(nombre),
        items:presupuesto_items(
          *,
          producto:productos(*),
          lote_reservado:lotes(*),
          reservas:stock_reservations(
            cantidad,
            expires_at,
            estado
          )
        )
      `)
      .eq('id', presupuestoId)
      .single()

    if (error) {
      console.error('Error obteniendo presupuesto:', error)
      return { success: false, message: 'Presupuesto no encontrado' }
    }

    return { success: true, data }

  } catch (error) {
    console.error('Error en obtenerPresupuestoAction:', error)
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

    // Actualizar estado y usuario almacén
    const { error } = await supabase
      .from('presupuestos')
      .update({
        estado: 'en_almacen',
        usuario_almacen: user.id,
        updated_at: new Date().toISOString()
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
